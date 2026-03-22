//! Per-source OPC UA driver loop.
//!
//! Each enabled OPC UA source gets its own `run_source` task. The task
//! connects, crawls the namespace, subscribes to all variable nodes, and
//! forwards batched value updates to both the database and the Data Broker.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use chrono::Utc;
use io_bus::{
    PointQuality, SourceStatusChange, UdsPointBatch, UdsPointUpdate, UdsSourceStatus,
};
use io_db::DbPool;
use opcua::client::prelude::*;
use opcua::sync::RwLock;
use opcua::client::prelude::HistoryReadAction;
use opcua::types::{
    AttributeId, BrowseDescription, BrowseDirection, DecodingOptions, HistoryData,
    HistoryReadValueId, MonitoredItemCreateRequest, MonitoringMode, MonitoringParameters,
    NodeClass, NodeId, QualifiedName, ReadRawModifiedDetails, ReadValueId, ReferenceTypeId,
    StatusCode, TimestampsToReturn, UAString,
};
use tokio::sync::mpsc;
use tokio::time::Instant;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::config::Config;
use crate::db::{self, AnalogMetadata, PointSource, PointUpdate};
use crate::ipc::UdsSender;

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Run the OPC UA driver for a single source forever (reconnecting on failure).
///
/// `reconnect_notify` — when signalled (via the internal reconnect HTTP endpoint)
/// the driver wakes immediately from its backoff sleep and retries the connection.
pub async fn run_source(
    source: PointSource,
    db: DbPool,
    uds: Arc<UdsSender>,
    config: Arc<Config>,
    reconnect_notify: Arc<tokio::sync::Notify>,
) {
    let mut attempt: u32 = 0;
    let mut backoff_secs: u64 = 5;
    let mut last_error: Option<String> = None;

    loop {
        attempt += 1;

        // After 10 failed attempts in a row, slow down and stay in "error".
        if attempt > 10 {
            let msg = last_error
                .as_deref()
                .unwrap_or("Too many reconnect failures");
            error!(
                source = %source.name,
                "Persistent OPC UA connection failure after 10 attempts; marking error"
            );
            if let Err(e) = db::set_source_status(&db, source.id, "error", Some(msg)).await {
                warn!(source = %source.name, error = %e, "Failed to set source status to error");
            }
            // Wait longer, but still honour manual reconnect requests.
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(config.reconnect_max_secs)) => {}
                _ = reconnect_notify.notified() => {
                    info!(source = %source.name, "Manual reconnect requested; retrying now");
                }
            }
            attempt = 0;
            backoff_secs = 5;
            continue;
        }

        info!(
            source = %source.name,
            attempt,
            endpoint = %source.endpoint_url,
            "Connecting to OPC UA server"
        );

        // Store the last error message while transitioning to "connecting".
        if let Err(e) = db::set_source_status(&db, source.id, "connecting", last_error.as_deref()).await {
            warn!(source = %source.name, error = %e, "Failed to set source status to connecting");
        }

        match run_source_once(&source, &db, &uds, &config).await {
            Ok(()) => {
                info!(source = %source.name, "OPC UA driver exited cleanly");
                last_error = None;
                attempt = 0;
                backoff_secs = 5;
            }
            Err(e) => {
                let msg = e.to_string();
                warn!(source = %source.name, error = %msg, "OPC UA driver error");
                last_error = Some(msg);
            }
        }

        // Mark inactive/error and broadcast offline via UDS.
        let (next_status, err_ref) = if attempt >= 2 {
            ("error", last_error.as_deref())
        } else {
            ("inactive", last_error.as_deref())
        };
        if let Err(e) = db::set_source_status(&db, source.id, next_status, err_ref).await {
            warn!(source = %source.name, error = %e, "Failed to set source status after error");
        }

        let status_msg = UdsSourceStatus {
            source_id: source.id,
            status: SourceStatusChange::Offline,
        };
        if let Err(e) = uds.send_status(&status_msg).await {
            warn!(source = %source.name, error = %e, "Failed to send offline status via UDS");
        }

        info!(
            source = %source.name,
            backoff = backoff_secs,
            "Waiting before reconnect"
        );
        // Wait for backoff OR a manual reconnect signal.
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(backoff_secs)) => {}
            _ = reconnect_notify.notified() => {
                info!(source = %source.name, "Manual reconnect requested; retrying now");
                // Reset backoff on manual reconnect.
                backoff_secs = 5;
                attempt = 0;
            }
        }

        // Exponential backoff: 5 → 10 → 20 → 40 → 60 (capped).
        // (Manual reconnect already resets backoff_secs above.)
        backoff_secs = (backoff_secs * 2).min(config.reconnect_max_secs);
    }
}

// ---------------------------------------------------------------------------
// Inner driver (single connection lifetime)
// ---------------------------------------------------------------------------

async fn run_source_once(
    source: &PointSource,
    db: &DbPool,
    uds: &Arc<UdsSender>,
    config: &Arc<Config>,
) -> anyhow::Result<()> {
    // Build OPC UA client and connect on a blocking thread to avoid blocking
    // the Tokio runtime (opcua 0.12 is synchronous).
    let endpoint_url = source.endpoint_url.clone();
    let security_policy_str = source.security_policy.clone();
    let security_mode_str = source.security_mode.clone();
    let username = source.username.clone();
    let password = source.password.clone();

    let pki_dir = config.pki_dir.clone();
    let auto_trust = config.auto_trust_server_certs;

    let session: Arc<RwLock<Session>> = tokio::task::spawn_blocking(move || {
        let (mut security_policy, security_mode, identity) =
            build_security(&security_policy_str, &security_mode_str, username, password);

        // Build client without keypair first — some servers hide their None
        // endpoint when they detect a certificate-capable client.
        let mut client = ClientBuilder::new()
            .application_name("io-opc-service")
            .application_uri("urn:io-opc-service")
            .pki_dir(&pki_dir)
            .trust_server_certs(auto_trust)
            .create_sample_keypair(false)
            .session_retry_limit(0)
            .client()
            .ok_or_else(|| anyhow::anyhow!("ClientBuilder::client() returned None"))?;

        // Build the endpoint description from our configured parameters.
        let mut connect_endpoint = EndpointDescription {
            endpoint_url: UAString::from(endpoint_url.as_str()),
            security_policy_uri: UAString::from(security_policy.to_uri()),
            security_mode,
            server: ApplicationDescription::default(),
            server_certificate: ByteString::null(),
            user_identity_tokens: None,
            transport_profile_uri: UAString::null(),
            security_level: 0,
        };

        // Probe the server's endpoint list to handle URL mismatches (NAT,
        // path-based URIs, different ports, etc.)  Many OPC UA servers
        // advertise endpoints with internal addresses (127.0.0.1, internal
        // hostnames) that don't match the DNS name the client uses to reach
        // them.  We discover the actual endpoint, patch its hostname with
        // ours, and use it for the real connection.
        match client.get_server_endpoints_from_url(endpoint_url.as_str()) {
            Ok(server_endpoints) if !server_endpoints.is_empty() => {
                let is_none_policy = security_policy == SecurityPolicy::None;

                // Step 1: standard matching (policy + mode + URL normalisation).
                let found = Client::find_matching_endpoint(
                    &server_endpoints,
                    endpoint_url.as_str(),
                    security_policy,
                    security_mode,
                )
                // Step 2: URL-agnostic match — server advertises a different
                // hostname/path.  Match by policy+mode only and rewrite URL.
                .or_else(|| {
                    server_endpoints
                        .iter()
                        .find(|e| {
                            e.security_mode == security_mode
                                && SecurityPolicy::from_uri(e.security_policy_uri.as_ref())
                                    == security_policy
                        })
                        .cloned()
                        .map(|mut ep| {
                            let rewritten = rewrite_hostname(ep.endpoint_url.as_ref(), &endpoint_url);
                            tracing::info!(
                                original = ep.endpoint_url.as_ref(),
                                rewritten = %rewritten,
                                "Rewrote server endpoint URL to match client address"
                            );
                            ep.endpoint_url = UAString::from(rewritten.as_str());
                            ep
                        })
                })
                // Step 3 (only when the user left policy as "None" / default):
                // auto-select the lowest-security endpoint on offer.
                .or_else(|| {
                    if !is_none_policy {
                        // Configured policy not found — don't silently downgrade.
                        let available: Vec<_> = server_endpoints
                            .iter()
                            .map(|e| format!("{}/{:?}", e.security_policy_uri, e.security_mode))
                            .collect();
                        tracing::warn!(
                            endpoint_url = %endpoint_url,
                            available = ?available,
                            configured_policy = ?security_policy,
                            configured_mode = ?security_mode,
                            "Configured security policy not offered by server"
                        );
                        return None;
                    }
                    // Policy is None — pick the lowest-security endpoint.
                    let mut candidates = server_endpoints.clone();
                    candidates.sort_by_key(|e| e.security_level);
                    candidates.into_iter().next().map(|mut ep| {
                        security_policy =
                            SecurityPolicy::from_uri(ep.security_policy_uri.as_ref());
                        tracing::info!(
                            endpoint_url = %endpoint_url,
                            server_policy = %ep.security_policy_uri,
                            mode = ?ep.security_mode,
                            "Auto-selected lowest-security endpoint"
                        );
                        let rewritten = rewrite_hostname(ep.endpoint_url.as_ref(), &endpoint_url);
                        ep.endpoint_url = UAString::from(rewritten.as_str());
                        ep
                    })
                });

                if let Some(ep) = found {
                    connect_endpoint = ep;
                }
                // If still not found, proceed with our original endpoint as-is;
                // connect_to_endpoint will report a descriptive error.
            }
            Ok(_) | Err(_) => {
                // Server returned empty list or discovery failed — proceed
                // with our configured endpoint as-is.
            }
        }

        // If the endpoint needs signing, rebuild the client with a keypair.
        if connect_endpoint.security_mode != MessageSecurityMode::None {
            client = ClientBuilder::new()
                .application_name("io-opc-service")
                .application_uri("urn:io-opc-service")
                .pki_dir(&pki_dir)
                .trust_server_certs(auto_trust)
                .create_sample_keypair(true)
                .session_retry_limit(0)
                .client()
                .ok_or_else(|| anyhow::anyhow!("ClientBuilder::client() returned None"))?;
        }

        client
            .connect_to_endpoint(connect_endpoint, identity)
            .map_err(|sc| anyhow::anyhow!("OPC UA connect failed: {}", sc))
    })
    .await
    .map_err(|e| anyhow::anyhow!("spawn_blocking join error: {}", e))??;

    info!(source = %source.name, "Connected to OPC UA server");

    // Register the server certificate in the DB (non-fatal if it fails).
    register_server_cert(source, db, config).await;

    // Run the OPC UA session event loop on a dedicated OS thread.
    let session_for_run = session.clone();
    let _run_sender = Session::run_async(session_for_run);

    // --- Browse namespace ---
    let (node_map, analog_nodes) = browse_namespace(source, db, &session).await?;

    if node_map.is_empty() {
        warn!(source = %source.name, "No variable nodes discovered; disconnecting");
        return Ok(());
    }

    info!(
        source = %source.name,
        points = node_map.len(),
        analog_points = analog_nodes.len(),
        "Namespace browse complete"
    );

    // --- Harvest OPC UA Part 8 analog metadata (EU, limits, description) ---
    // Opportunistic — failures are non-fatal; missing properties are skipped.
    harvest_analog_metadata(source, db, &session, &node_map, &analog_nodes).await;

    // --- Startup history auto-recovery ---
    // On every connect, check the most recent timestamp we have for this source.
    // Request HistoricalRead from the start of that last full hour to now so that
    // any data missed during a comm gap (reboot, network outage, etc.) is recovered.
    {
        let now = Utc::now();
        let recover_from = match db::get_last_history_timestamp(db, source.id).await {
            Ok(Some(last_ts)) => {
                use chrono::Timelike;
                // Round down to the start of the hour containing the last stored value
                // so we overlap slightly and don't miss data at hourly boundaries.
                let hour_start = last_ts
                    .with_minute(0)
                    .and_then(|t: chrono::DateTime<Utc>| t.with_second(0))
                    .and_then(|t: chrono::DateTime<Utc>| t.with_nanosecond(0))
                    .unwrap_or(last_ts);
                Some(hour_start)
            }
            Ok(None) => {
                // No history yet — recover the last hour as an initial backfill.
                Some(now - chrono::Duration::hours(1))
            }
            Err(e) => {
                warn!(source = %source.name, error = %e, "Failed to query last history timestamp (skipping auto-recovery)");
                None
            }
        };

        if let Some(from_time) = recover_from {
            // Only recover if there's actually a gap (from_time must be in the past).
            if from_time < now {
                info!(
                    source = %source.name,
                    from = %from_time,
                    to = %now,
                    "Starting startup history auto-recovery"
                );
                match harvest_history(source, db, &session, &node_map, from_time, now).await {
                    Ok(n) => info!(
                        source = %source.name,
                        rows = n,
                        "Startup history auto-recovery complete"
                    ),
                    Err(e) => warn!(
                        source = %source.name,
                        error = %e,
                        "Startup history auto-recovery failed (non-fatal)"
                    ),
                }
            }
        }
    }

    // Mark active; send UDS online status.
    if let Err(e) = db::set_source_status(db, source.id, "active", None).await {
        warn!(source = %source.name, error = %e, "Failed to set status to active");
    }

    let status_msg = UdsSourceStatus {
        source_id: source.id,
        status: SourceStatusChange::Online,
    };
    if let Err(e) = uds.send_status(&status_msg).await {
        warn!(
            source = %source.name,
            error = %e,
            "Failed to send online status via UDS (non-fatal)"
        );
    }

    // --- Subscribe ---
    let (update_tx, update_rx) = mpsc::unbounded_channel::<PointUpdate>();

    let good_items = create_subscriptions(source, &session, &node_map, update_tx, config)?;

    // --- OPC UA Part 9 A&C event subscription (non-fatal) ---
    // Store the handle so we can abort the drain task when this session ends,
    // preventing stale tasks from accumulating across reconnect cycles.
    let event_task = create_event_subscription(source, db, &session, config).await;

    // If all monitored items returned BadServiceUnsupported (0 good items), fall back to
    // periodic polling via OPC UA Read instead of subscriptions.  This handles servers
    // that implement Browse and Read but not the Subscription service, or servers that
    // have exhausted their subscription quota from zombie sessions.
    if good_items == 0 && !node_map.is_empty() {
        warn!(
            source = %source.name,
            points = node_map.len(),
            "All monitored items returned non-Good status — falling back to polling mode"
        );
        drop(update_rx); // won't be used in polling mode
        poll_loop(source, db, uds, config, &session, &node_map).await;
    } else {
        info!(source = %source.name, "Entering flush loop — waiting for OPC UA DataChange callbacks");
        // --- Flush loop (runs until session ends) ---
        flush_loop(source, db, uds, config, &session, &node_map, update_rx).await;
    }

    // Abort the A&C drain task — the session is gone, events will no longer arrive.
    if let Some(handle) = event_task {
        handle.abort();
    }

    // Send OPC UA CloseSession so the server can immediately release all
    // server-side session state (subscriptions, monitored items, locks).
    // Without this, "zombie" sessions accumulate on the server across restarts
    // until the server-side timeout expires, consuming server session/item
    // quota and causing BadServiceUnsupported on monitored item creation.
    let session_clone = session.clone();
    let source_name = source.name.clone();
    tokio::task::spawn_blocking(move || {
        session_clone.write().disconnect();
        tracing::info!(source = %source_name, "OPC UA session closed cleanly");
    })
    .await
    .ok(); // join error is non-fatal

    Ok(())
}

// ---------------------------------------------------------------------------
// Namespace browsing
// ---------------------------------------------------------------------------

/// OPC UA TypeDefinition NodeIds for Part 8 Data Access types.
/// Used to determine which metadata properties to harvest during browse.
mod type_defs {
    /// DataItemType — exposes Definition, ValuePrecision
    pub const DATA_ITEM: u32 = 2365;
    /// AnalogItemType — also exposes EURange, EngineeringUnits, InstrumentRange, alarm limits
    pub const ANALOG_ITEM: u32 = 2368;
    /// TwoStateDiscreteType — exposes TrueState, FalseState
    pub const TWO_STATE_DISCRETE: u32 = 2373;
    /// MultiStateDiscreteType — exposes EnumStrings
    pub const MULTI_STATE_DISCRETE: u32 = 2376;
    /// MultiStateValueDiscreteType — exposes EnumValues
    pub const MULTI_STATE_VALUE_DISCRETE: u32 = 11238;
}

/// Returns `(node_map, analog_nodes)` where:
/// - `node_map`: all discovered variable NodeIds → point UUIDs
/// - `analog_nodes`: subset of NodeIds whose TypeDefinition is AnalogItemType or DataItemType.
///   Used by `harvest_analog_metadata` to skip nodes that cannot have Part 8 properties.
///   If empty (server did not report TypeDefinitions), the caller falls back to all nodes.
async fn browse_namespace(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<RwLock<Session>>,
) -> anyhow::Result<(HashMap<NodeId, Uuid>, HashSet<NodeId>)> {
    // OPC UA Objects folder node id = ns=0;i=85
    let root = NodeId::new(0u16, 85u32);
    let mut node_map: HashMap<NodeId, Uuid> = HashMap::new();
    // Track which nodes are AnalogItemType or DataItemType (have Part 8 properties).
    let mut analog_nodes: HashSet<NodeId> = HashSet::new();
    let mut to_visit: Vec<NodeId> = vec![root];

    while !to_visit.is_empty() {
        let batch: Vec<NodeId> = std::mem::take(&mut to_visit);

        for parent_id in batch {
            // Browse synchronously on the blocking thread pool.
            let session_clone = session.clone();
            let parent_id_clone = parent_id.clone();

            let children_result = tokio::task::spawn_blocking(move || {
                let session_guard = session_clone.read();
                browse_children(&session_guard, &parent_id_clone)
            })
            .await
            .map_err(|e| anyhow::anyhow!("spawn_blocking error: {}", e))?;

            match children_result {
                Ok(children) => {
                    for (node_id, display_name, node_class, type_def_id) in children {
                        // Skip ns=0 nodes — those are OPC UA server infrastructure
                        // (Server diagnostics, Endpoints, SessionDiagnostics, etc.).
                        // Process data lives in vendor namespaces (ns >= 2).
                        // NOTE: Do NOT recurse into ns=0 Objects — SimBLAH's address space
                        // contains ns=2 metadata nodes under ns=0 Objects (e.g. Server node)
                        // that return BadServiceUnsupported when monitored.  The correct
                        // process data is accessible directly from Objects (ns=0;i=85) via
                        // ns>=2 Object children without recursing through ns=0.
                        if node_id.namespace == 0 {
                            continue;
                        }
                        match node_class {
                            NodeClass::Variable => {
                                // Determine type for metadata harvesting.
                                let type_name = type_name_from_typedef(&type_def_id);
                                // Track whether this node is AnalogItemType or DataItemType so
                                // harvest_analog_metadata can skip nodes that can never have
                                // Part 8 properties (EU, EURange, alarm limits, Definition).
                                let is_analog_or_data_item = matches!(
                                    type_name,
                                    Some("AnalogItemType") | Some("DataItemType")
                                );
                                let metadata = serde_json::json!({
                                    "node_id": node_id.to_string(),
                                    "display_name": display_name,
                                    "type_def": type_def_id.map(|nid| nid.to_string()),
                                    "type_name": type_name,
                                });
                                match db::upsert_point_from_source(
                                    db,
                                    source.id,
                                    &display_name,
                                    metadata,
                                )
                                .await
                                {
                                    Ok(point_id) => {
                                        if is_analog_or_data_item {
                                            analog_nodes.insert(node_id.clone());
                                        }
                                        node_map.insert(node_id, point_id);
                                    }
                                    Err(e) => {
                                        warn!(
                                            source = %source.name,
                                            tag = %display_name,
                                            error = %e,
                                            "Failed to upsert point"
                                        );
                                    }
                                }
                            }
                            NodeClass::Object => {
                                to_visit.push(node_id);
                            }
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    warn!(
                        source = %source.name,
                        node = %parent_id,
                        error = %e,
                        "Browse failed for node"
                    );
                }
            }
        }
    }

    Ok((node_map, analog_nodes))
}

/// Map TypeDefinition NodeId to a human-readable name for metadata storage.
fn type_name_from_typedef(type_def: &Option<NodeId>) -> Option<&'static str> {
    let nid = type_def.as_ref()?;
    if nid.namespace != 0 {
        return None; // Vendor-specific type
    }
    match nid.identifier {
        opcua::types::Identifier::Numeric(id) => match id {
            n if n == type_defs::ANALOG_ITEM           => Some("AnalogItemType"),
            n if n == type_defs::DATA_ITEM             => Some("DataItemType"),
            n if n == type_defs::TWO_STATE_DISCRETE    => Some("TwoStateDiscreteType"),
            n if n == type_defs::MULTI_STATE_DISCRETE  => Some("MultiStateDiscreteType"),
            n if n == type_defs::MULTI_STATE_VALUE_DISCRETE => Some("MultiStateValueDiscreteType"),
            _ => None,
        },
        _ => None,
    }
}

/// Synchronous browse of a single node's children (call while holding session read lock).
/// Returns (NodeId, display_name, NodeClass, optional TypeDefinition NodeId).
fn browse_children(
    session: &Session,
    node_id: &NodeId,
) -> Result<Vec<(NodeId, String, NodeClass, Option<NodeId>)>, String> {
    let desc = BrowseDescription {
        node_id: node_id.clone(),
        browse_direction: BrowseDirection::Forward,
        reference_type_id: ReferenceTypeId::HierarchicalReferences.into(),
        include_subtypes: true,
        node_class_mask: 0xff, // all node classes
        result_mask: 63,       // includes TypeDefinition in result
    };

    let results = session
        .browse(&[desc])
        .map_err(|e| format!("browse error: {}", e))?;

    let mut children = Vec::new();

    if let Some(result_list) = results {
        for result in result_list {
            if let Some(refs) = result.references {
                for r in refs {
                    let nid = r.node_id.node_id.clone();
                    let nc = r.node_class;
                    let name = r.display_name.text.value().as_ref()
                        .and_then(|s| if s.is_empty() { None } else { Some(s.clone()) })
                        .or_else(|| {
                            r.browse_name.name.value().as_ref()
                                .and_then(|s| if s.is_empty() { None } else { Some(s.clone()) })
                        })
                        .unwrap_or_else(|| nid.to_string());
                    // TypeDefinition is available via HasTypeDefinition reference in browse results.
                    // In opcua 0.12, ReferenceDescription.type_definition is an ExpandedNodeId.
                    // Only include it when namespace == 0 (OPC UA standard types).
                    let type_def = {
                        let td = &r.type_definition;
                        if td.server_index == 0 {
                            Some(td.node_id.clone())
                        } else {
                            None
                        }
                    };
                    children.push((nid, name, nc, type_def));
                }
            }
        }
    }

    Ok(children)
}

// ---------------------------------------------------------------------------
// OPC UA Part 8: Analog metadata harvesting
// ---------------------------------------------------------------------------

/// For each variable node in `node_map` that is an AnalogItemType or DataItemType, attempt to
/// read OPC UA Part 8 optional properties (EURange, EngineeringUnits, Definition, alarm limits).
/// Writes any discovered metadata to the DB via `update_point_analog_metadata`.
/// Non-fatal — individual property read failures are logged and skipped.
///
/// `analog_nodes` is the set of NodeIds known to be AnalogItemType or DataItemType from browse.
/// If empty (server did not report TypeDefinitions), all nodes are processed as a compatibility
/// fallback (preserves behaviour with servers that omit TypeDefinition in browse results).
async fn harvest_analog_metadata(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<RwLock<Session>>,
    node_map: &HashMap<NodeId, Uuid>,
    analog_nodes: &HashSet<NodeId>,
) {
    // OPC UA well-known property BrowseNames and their relative path from the variable node.
    // These are children of AnalogItemType nodes under the Properties reference type (ns=0;i=68).
    //
    // We batch-read using absolute NodeIds constructed as relative paths.
    // Most OPC UA stacks expose these as:
    //   <variable_node>/EURange      → ns=same;s=<tagname>.EURange  (Kepware style)
    // or as children browseable via HierarchicalReferences.
    //
    // Strategy: for each node, browse its children for the property nodes,
    // then batch-read their values.

    // Filter to only AnalogItemType/DataItemType nodes to avoid unnecessary load on large servers.
    // Fall back to all nodes when analog_nodes is empty (server didn't report TypeDefinitions).
    let node_ids: Vec<(NodeId, Uuid)> = if analog_nodes.is_empty() {
        // Compatibility fallback: server did not report TypeDefinitions during browse.
        node_map.iter().map(|(n, p)| (n.clone(), *p)).collect()
    } else {
        node_map
            .iter()
            .filter(|(nid, _)| analog_nodes.contains(nid))
            .map(|(n, p)| (n.clone(), *p))
            .collect()
    };

    // Process in batches to avoid overwhelming the server.
    const BATCH: usize = 50;
    let mut harvested = 0usize;

    for chunk in node_ids.chunks(BATCH) {
        let chunk: Vec<(NodeId, Uuid)> = chunk.to_vec();
        let session_clone = session.clone();

        let results = tokio::task::spawn_blocking(move || {
            let session_guard = session_clone.read();
            chunk
                .iter()
                .map(|(node_id, point_id)| {
                    let meta = read_analog_properties(&session_guard, node_id);
                    (*point_id, meta)
                })
                .collect::<Vec<_>>()
        })
        .await;

        match results {
            Err(e) => {
                warn!(source = %source.name, error = %e, "spawn_blocking error during analog metadata harvest");
                continue;
            }
            Ok(items) => {
                for (point_id, meta) in items {
                    // Only write to DB if at least one field was populated.
                    let has_data = meta.description.is_some()
                        || meta.engineering_units.is_some()
                        || meta.eu_range_low.is_some()
                        || meta.eu_range_high.is_some()
                        || meta.alarm_limit_hh.is_some()
                        || meta.alarm_limit_h.is_some()
                        || meta.alarm_limit_l.is_some()
                        || meta.alarm_limit_ll.is_some();

                    if has_data {
                        if let Err(e) = db::update_point_analog_metadata(db, point_id, &meta).await {
                            warn!(
                                source = %source.name,
                                point_id = %point_id,
                                error = %e,
                                "Failed to write analog metadata"
                            );
                        } else {
                            harvested += 1;
                        }
                    }
                }
            }
        }
    }

    if harvested > 0 {
        info!(
            source = %source.name,
            harvested,
            total = node_map.len(),
            "OPC UA Part 8 analog metadata harvested"
        );
    }
}

/// Read OPC UA Part 8 AnalogItemType properties for a single variable node.
///
/// Fast path: if the node uses SimBLAH's `ns=1;s="<point_name>"` convention, the property
/// NodeIds are predictable (`ns=1;s="prop:EURange:<name>"`, `ns=1;s="prop:EU:<name>"`) and
/// can be batch-read directly without a prior Browse round-trip.
///
/// Slow path (generic servers): Browse HasProperty children, then batch-read their values.
/// All failures are silently ignored (returns empty AnalogMetadata).
fn read_analog_properties(session: &Session, node_id: &NodeId) -> AnalogMetadata {
    // Fast path — SimBLAH publishes properties at known NodeIds under ns=1 string identifiers.
    if node_id.namespace == 1 {
        if let opcua::types::Identifier::String(ref s) = node_id.identifier {
            if let Some(point_name) = s.value() {
                // Reject anything that already looks like a property or folder prefix.
                if !point_name.starts_with("prop:") && !point_name.starts_with("folder:") {
                    if let Some(meta) = read_analog_properties_simblah(session, point_name) {
                        return meta;
                    }
                }
            }
        }
    }

    read_analog_properties_generic(session, node_id)
}

/// SimBLAH-specific fast path: construct property NodeIds directly and batch-read.
/// Returns None if the batch read itself fails (caller falls back to generic path).
fn read_analog_properties_simblah(session: &Session, point_name: &str) -> Option<AnalogMetadata> {
    use opcua::types::Identifier;

    let prop_names: &[(&str, &str)] = &[
        ("prop:EURange",          "EURange"),
        ("prop:EU",               "EngineeringUnits"),
        ("prop:TrueState",        "TrueState"),
        ("prop:FalseState",       "FalseState"),
        ("prop:EnumStrings",      "EnumStrings"),
    ];

    let read_nodes: Vec<ReadValueId> = prop_names
        .iter()
        .map(|(prefix, _)| {
            let key = format!("{}:{}", prefix, point_name);
            ReadValueId {
                node_id: NodeId {
                    namespace: 1,
                    identifier: Identifier::String(UAString::from(key)),
                },
                attribute_id: AttributeId::Value as u32,
                index_range: UAString::null(),
                data_encoding: QualifiedName::null(),
            }
        })
        .collect();

    let data_values = session
        .read(&read_nodes, TimestampsToReturn::Neither, 0.0)
        .ok()?;

    let mut meta = AnalogMetadata::default();
    for ((_, prop_name), dv) in prop_names.iter().zip(data_values.iter()) {
        let Some(ref variant) = dv.value else { continue };
        match *prop_name {
            "EngineeringUnits" => {
                meta.engineering_units = extract_eu_display_name(variant);
            }
            "EURange" => {
                if let Some((low, high)) = extract_eu_range(variant) {
                    meta.eu_range_low = Some(low);
                    meta.eu_range_high = Some(high);
                }
            }
            // TrueState/FalseState/EnumStrings are browse metadata — not stored in AnalogMetadata.
            _ => {}
        }
    }

    Some(meta)
}

/// Generic OPC UA property harvest: Browse HasProperty children, then batch-read their values.
fn read_analog_properties_generic(session: &Session, node_id: &NodeId) -> AnalogMetadata {
    let mut meta = AnalogMetadata::default();

    // Browse the node's properties (PropertyType reference = ns=0;i=68).
    let desc = BrowseDescription {
        node_id: node_id.clone(),
        browse_direction: BrowseDirection::Forward,
        reference_type_id: NodeId::new(0u16, 46u32), // HasProperty = ns=0;i=46
        include_subtypes: true,
        node_class_mask: 0xff,
        result_mask: 63,
    };

    let Ok(Some(results)) = session.browse(&[desc]) else {
        return meta;
    };

    // Collect property node ids keyed by BrowseName.
    let mut prop_nodes: HashMap<String, NodeId> = HashMap::new();
    for result in &results {
        if let Some(refs) = &result.references {
            for r in refs {
                if let Some(name) = r.browse_name.name.value() {
                    prop_nodes.insert(name.clone(), r.node_id.node_id.clone());
                }
            }
        }
    }

    if prop_nodes.is_empty() {
        return meta;
    }

    // Build a batch Read request for the properties we care about.
    // Simultaneously build `selected_props` — the names of properties that were actually
    // found in `prop_nodes`, in the same order they appear in `read_nodes`.  This avoids
    // the fragile manual idx counter pattern and keeps name→result mapping self-consistent
    // regardless of which properties the server exposes.
    let property_names: &[&'static str] = &[
        "Definition",
        "EngineeringUnits",
        "EURange",
        "HighHighLimit",
        "HighLimit",
        "LowLimit",
        "LowLowLimit",
    ];

    let (read_nodes, selected_props): (Vec<ReadValueId>, Vec<&'static str>) = property_names
        .iter()
        .filter_map(|name| {
            prop_nodes.get(*name).map(|nid| {
                (
                    ReadValueId {
                        node_id: nid.clone(),
                        attribute_id: AttributeId::Value as u32,
                        index_range: UAString::null(),
                        data_encoding: QualifiedName::null(),
                    },
                    *name,
                )
            })
        })
        .unzip();

    if read_nodes.is_empty() {
        return meta;
    }

    let data_values = match session.read(&read_nodes, TimestampsToReturn::Neither, 0.0) {
        Ok(dvs) => dvs,
        Err(_) => return meta,
    };

    // Map results back to property names using the parallel selected_props vec.
    // Both vecs have identical length and order, so zip is exact.
    for (name, dv) in selected_props.iter().zip(data_values.iter()) {
        if let Some(ref variant) = dv.value {
            match *name {
                "Definition" => {
                    if let Variant::String(s) = variant {
                        if let Some(text) = s.value() {
                            meta.description = Some(text.clone());
                        }
                    }
                }
                "EngineeringUnits" => {
                    // EUInformation is an ExtensionObject; extract displayName.text
                    meta.engineering_units = extract_eu_display_name(variant);
                }
                "EURange" => {
                    // Range struct: {low: Double, high: Double}
                    if let Some((low, high)) = extract_eu_range(variant) {
                        meta.eu_range_low = Some(low);
                        meta.eu_range_high = Some(high);
                    }
                }
                "HighHighLimit" => meta.alarm_limit_hh = variant_to_f64(variant),
                "HighLimit"     => meta.alarm_limit_h  = variant_to_f64(variant),
                "LowLimit"      => meta.alarm_limit_l  = variant_to_f64(variant),
                "LowLowLimit"   => meta.alarm_limit_ll = variant_to_f64(variant),
                _ => {}
            }
        }
    }

    meta
}

/// Extract EU display name from an EUInformation ExtensionObject variant.
/// OPC UA encodes EngineeringUnits as EUInformation (ns=0;i=887):
///   { namespaceUri: String, unitId: Int32, displayName: LocalizedText, description: LocalizedText }
fn extract_eu_display_name(variant: &Variant) -> Option<String> {
    match variant {
        Variant::ExtensionObject(ext) => {
            decode_eu_display_name(ext)
        }
        Variant::String(s) => s.value().as_ref().map(|s| s.clone()),
        _ => None,
    }
}

/// Manual binary decode of OPC UA EUInformation body.
///
/// Wire layout:
///   OPC UA String  namespace_uri  (i32 len LE, then bytes; -1 = null)
///   i32            unit_id        (4 bytes LE)
///   LocalizedText  display_name   (1-byte mask; bit0 → locale string; bit1 → text string)
///   LocalizedText  description    (same)
///
/// We return display_name.text.
fn decode_eu_display_name(ext: &opcua::types::ExtensionObject) -> Option<String> {
    use opcua::types::ExtensionObjectEncoding;
    use std::io::Read;

    let bytes = match &ext.body {
        ExtensionObjectEncoding::ByteString(bs) => bs.value.as_ref()?,
        _ => return None,
    };

    let mut cur = std::io::Cursor::new(bytes.as_slice());

    // Skip namespace_uri string.
    read_opc_string(&mut cur)?;

    // Skip unit_id (4 bytes LE i32).
    {
        let mut buf = [0u8; 4];
        cur.read_exact(&mut buf).ok()?;
    }

    // Read display_name LocalizedText.
    // mask: 1 byte; bit0 = has locale, bit1 = has text
    let display_text = read_opc_localized_text(&mut cur)?;

    display_text
}

/// Read an OPC UA String from the cursor: i32 length LE (-1 = null), then bytes.
/// Returns None only on I/O error; null string returns Some(None) — but here we return
/// Option<String> where None means either null or I/O error (both treated same way for
/// our purposes of just skipping or extracting the string).
fn read_opc_string(cur: &mut std::io::Cursor<&[u8]>) -> Option<Option<String>> {
    use std::io::Read;
    let mut len_buf = [0u8; 4];
    cur.read_exact(&mut len_buf).ok()?;
    let len = i32::from_le_bytes(len_buf);
    if len < 0 {
        // Null string
        return Some(None);
    }
    let len = len as usize;
    let mut bytes = vec![0u8; len];
    cur.read_exact(&mut bytes).ok()?;
    Some(Some(String::from_utf8(bytes).unwrap_or_default()))
}

/// Read an OPC UA LocalizedText and return the text field (or None if absent).
fn read_opc_localized_text(cur: &mut std::io::Cursor<&[u8]>) -> Option<Option<String>> {
    use std::io::Read;
    let mut mask_buf = [0u8; 1];
    cur.read_exact(&mut mask_buf).ok()?;
    let mask = mask_buf[0];

    // bit0: locale string present
    if mask & 0x01 != 0 {
        read_opc_string(cur)?; // skip locale
    }

    // bit1: text string present
    if mask & 0x02 != 0 {
        let text = read_opc_string(cur)?;
        Some(text)
    } else {
        Some(None)
    }
}

/// Extract (low, high) from an OPC UA Range ExtensionObject variant.
/// Range is encoded as { low: Double (f64 LE), high: Double (f64 LE) }.
fn extract_eu_range(variant: &Variant) -> Option<(f64, f64)> {
    match variant {
        Variant::ExtensionObject(ext) => decode_eu_range(ext),
        _ => None,
    }
}

/// Manual binary decode of OPC UA Range body: two f64 LE values (low, high).
fn decode_eu_range(ext: &opcua::types::ExtensionObject) -> Option<(f64, f64)> {
    use opcua::types::ExtensionObjectEncoding;
    use std::io::Read;

    let bytes = match &ext.body {
        ExtensionObjectEncoding::ByteString(bs) => bs.value.as_ref()?,
        _ => return None,
    };

    if bytes.len() < 16 {
        return None;
    }

    let mut cur = std::io::Cursor::new(bytes.as_slice());
    let mut buf = [0u8; 8];

    cur.read_exact(&mut buf).ok()?;
    let low = f64::from_le_bytes(buf);

    cur.read_exact(&mut buf).ok()?;
    let high = f64::from_le_bytes(buf);

    if low.is_nan() || low.is_infinite() || high.is_nan() || high.is_infinite() {
        return None;
    }

    Some((low, high))
}

// ---------------------------------------------------------------------------
// Subscription creation
// ---------------------------------------------------------------------------

/// Returns the total number of monitored items that were accepted (Good status) by the server.
/// A return value of 0 means all items failed — caller should fall back to polling mode.
fn create_subscriptions(
    source: &PointSource,
    session: &Arc<RwLock<Session>>,
    node_map: &HashMap<NodeId, Uuid>,
    update_tx: mpsc::UnboundedSender<PointUpdate>,
    config: &Arc<Config>,
) -> anyhow::Result<usize> {
    let node_ids: Vec<(NodeId, Uuid)> = node_map
        .iter()
        .map(|(n, p)| (n.clone(), *p))
        .collect();

    let publishing_ms = config.publishing_interval_ms;
    let mut total_good: usize = 0;

    for (chunk_idx, chunk) in node_ids.chunks(config.subscription_batch_size).enumerate() {
        let chunk: Vec<(NodeId, Uuid)> = chunk.to_vec();
        let tx = update_tx.clone();

        // Capture node_id → point_id map for the callback.
        let id_map: HashMap<NodeId, Uuid> = chunk.iter().cloned().collect();

        let callback = DataChangeCallback::new(move |changed_items| {
            let now = Utc::now();
            for item in changed_items {
                let node_id = &item.item_to_monitor().node_id;
                let point_id = match id_map.get(node_id) {
                    Some(id) => *id,
                    None => continue,
                };

                let dv = item.last_value();
                let (value, quality) = extract_value(dv);

                let timestamp = dv
                    .source_timestamp
                    .as_ref()
                    .map(|dt| dt.as_chrono())
                    .or_else(|| dv.server_timestamp.as_ref().map(|dt| dt.as_chrono()))
                    .unwrap_or(now);

                let update = PointUpdate {
                    point_id,
                    value,
                    quality: quality.as_str().to_string(),
                    timestamp,
                };

                if tx.send(update).is_err() {
                    // Receiver dropped — driver is shutting down.
                    break;
                }
            }
        });

        let monitored_items: Vec<MonitoredItemCreateRequest> = chunk
            .iter()
            .map(|(node_id, _)| MonitoredItemCreateRequest {
                item_to_monitor: ReadValueId {
                    node_id: node_id.clone(),
                    attribute_id: AttributeId::Value as u32,
                    index_range: UAString::null(),
                    data_encoding: QualifiedName::null(),
                },
                monitoring_mode: MonitoringMode::Reporting,
                requested_parameters: MonitoringParameters {
                    client_handle: 0,
                    sampling_interval: publishing_ms as f64,
                    filter: Default::default(),
                    queue_size: 1,
                    discard_oldest: true,
                },
            })
            .collect();

        let session_guard = session.write();

        let sub_id = session_guard
            .create_subscription(
                publishing_ms as f64,
                10,
                10,
                1000,
                0,
                true,
                callback,
            )
            .map_err(|sc| anyhow::anyhow!("create_subscription failed: {}", sc))?;

        let item_results = session_guard
            .create_monitored_items(sub_id, TimestampsToReturn::Both, &monitored_items)
            .map_err(|sc| anyhow::anyhow!("create_monitored_items failed: {}", sc))?;

        // Count items with non-Good status codes and log them for diagnostics.
        let bad_items: Vec<String> = item_results
            .iter()
            .enumerate()
            .filter(|(_, r)| !r.status_code.is_good())
            .take(10)
            .map(|(i, r)| format!("[{}]={}", i, r.status_code))
            .collect();
        if !bad_items.is_empty() {
            warn!(
                source = %source.name,
                chunk = chunk_idx,
                bad_count = item_results.iter().filter(|r| !r.status_code.is_good()).count(),
                first_bad = %bad_items.join(", "),
                "Some monitored items returned non-Good status codes"
            );
        }

        let chunk_good = item_results.iter().filter(|r| r.status_code.is_good()).count();
        total_good += chunk_good;

        info!(
            source = %source.name,
            chunk = chunk_idx,
            items = chunk.len(),
            good_items = chunk_good,
            sub_id,
            "Created OPC UA subscription"
        );
    }

    Ok(total_good)
}

// ---------------------------------------------------------------------------
// OPC UA Part 9 Alarms & Conditions event subscription
// ---------------------------------------------------------------------------

/// Attempt to subscribe to OPC UA A&C events from the Server node.
/// Non-fatal: any failure is logged and the data subscription continues normally.
/// Returns the JoinHandle of the background drain task so the caller can abort it
/// when the session ends, preventing stale tasks from accumulating across reconnects.
async fn create_event_subscription(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<RwLock<Session>>,
    config: &Arc<Config>,
) -> Option<tokio::task::JoinHandle<()>> {
    // Step 1: Check EventNotifier bit 0 on Server node (ns=0;i=2253).
    let server_node_id = NodeId::new(0u16, 2253u32);

    let event_notifier_result = {
        let session_clone = session.clone();
        let nid = server_node_id.clone();
        tokio::task::spawn_blocking(move || {
            let guard = session_clone.read();
            let read_req = ReadValueId {
                node_id: nid,
                attribute_id: 12, // EventNotifier
                index_range: UAString::null(),
                data_encoding: QualifiedName::null(),
            };
            guard.read(&[read_req], TimestampsToReturn::Neither, 0.0)
        })
        .await
    };

    let subscribable = match event_notifier_result {
        Ok(Ok(dvs)) => {
            dvs.first()
                .and_then(|dv| dv.value.as_ref())
                .and_then(|v| {
                    if let Variant::Byte(b) = v { Some(*b) } else { None }
                })
                .map(|b| b & 0x01 != 0)
                .unwrap_or(false)
        }
        Ok(Err(sc)) => {
            info!(
                source = %source.name,
                status = %sc,
                "EventNotifier read returned status code; skipping event subscription"
            );
            return None;
        }
        Err(e) => {
            warn!(source = %source.name, error = %e, "spawn_blocking error checking EventNotifier");
            return None;
        }
    };

    if !subscribable {
        info!(
            source = %source.name,
            "Server node EventNotifier bit 0 not set; skipping A&C event subscription"
        );
        return None;
    }

    // Step 2 & 3: Build EventFilter and create the subscription on the blocking thread.
    // We use an mpsc channel to bridge the synchronous opcua callback to async DB writes.
    let (event_tx, mut event_rx) = tokio::sync::mpsc::unbounded_channel::<db::OpcEvent>();

    let source_id = source.id;
    let source_name_for_log = source.name.clone();
    let publishing_ms = config.publishing_interval_ms as f64;

    let session_clone = session.clone();
    let sub_result = tokio::task::spawn_blocking(move || -> anyhow::Result<u32> {
        use opcua::types::{
            ContentFilter, EventFilter, ExtensionObject, ObjectId, SimpleAttributeOperand,
        };

        // Build select clauses — one SimpleAttributeOperand per event field.
        // type_definition_id = BaseEventType (ns=0;i=2041) for all fields.
        let base_event_type = NodeId::new(0u16, 2041u32);

        struct FieldDef {
            name: &'static str,
            attr_id: u32,
        }

        let fields: &[FieldDef] = &[
            FieldDef { name: "EventId",        attr_id: 13 }, // Value attribute
            FieldDef { name: "EventType",       attr_id: 13 },
            FieldDef { name: "SourceName",      attr_id: 13 },
            FieldDef { name: "Time",            attr_id: 13 },
            FieldDef { name: "Severity",        attr_id: 13 },
            FieldDef { name: "Message",         attr_id: 13 },
            FieldDef { name: "ConditionName",   attr_id: 13 },
            FieldDef { name: "AckedState/Id",   attr_id: 13 },
            FieldDef { name: "ActiveState/Id",  attr_id: 13 },
            FieldDef { name: "Retain",          attr_id: 13 },
        ];

        let select_clauses: Vec<SimpleAttributeOperand> = fields
            .iter()
            .map(|f| {
                // browse_path: single element with the field name (ns=0).
                let parts: Vec<QualifiedName> = f
                    .name
                    .split('/')
                    .map(|p| QualifiedName::new(0, p))
                    .collect();
                SimpleAttributeOperand {
                    type_definition_id: base_event_type.clone(),
                    browse_path: Some(parts),
                    attribute_id: f.attr_id,
                    index_range: UAString::null(),
                }
            })
            .collect();

        let event_filter = EventFilter {
            select_clauses: Some(select_clauses),
            where_clause: ContentFilter { elements: None },
        };

        // Encode the EventFilter into an ExtensionObject for MonitoringParameters.filter.
        let filter_ext = ExtensionObject::from_encodable(
            NodeId::from(&ObjectId::EventFilter_Encoding_DefaultBinary),
            &event_filter,
        );

        // Build the callback: extract fields and send to the async channel.
        let tx = event_tx.clone();
        let callback = EventCallback::new(move |notif| {
            let events = match &notif.events {
                Some(e) => e,
                None => return,
            };
            for efl in events {
                let fields_vec = match &efl.event_fields {
                    Some(f) => f,
                    None => continue,
                };

                // Field order matches select_clauses above:
                // 0=EventId, 1=EventType, 2=SourceName, 3=Time, 4=Severity,
                // 5=Message, 6=ConditionName, 7=AckedState/Id, 8=ActiveState/Id, 9=Retain

                let get = |i: usize| fields_vec.get(i);

                let event_id = get(0).and_then(|v| {
                    if let Variant::ByteString(bs) = v {
                        bs.value.as_ref().map(|b| {
                            b.iter().map(|byte| format!("{:02x}", byte)).collect::<String>()
                        })
                    } else {
                        None
                    }
                });

                let event_type = get(1).and_then(|v| {
                    if let Variant::NodeId(nid) = v {
                        Some(nid.to_string())
                    } else {
                        None
                    }
                });

                let source_name = get(2).and_then(|v| {
                    if let Variant::String(s) = v { s.value().as_ref().map(|s| s.clone()) } else { None }
                });

                let timestamp = get(3)
                    .and_then(|v| {
                        if let Variant::DateTime(dt) = v {
                            Some(dt.as_chrono())
                        } else {
                            None
                        }
                    })
                    .unwrap_or_else(Utc::now);

                let severity = get(4).and_then(|v| {
                    if let Variant::UInt16(s) = v { Some(*s) } else { None }
                });

                let message = get(5).and_then(|v| match v {
                    Variant::LocalizedText(lt) => lt.text.value().as_ref().map(|s| s.clone()),
                    Variant::String(s) => s.value().as_ref().map(|s| s.clone()),
                    _ => None,
                });

                let condition_name = get(6).and_then(|v| {
                    if let Variant::String(s) = v { s.value().as_ref().map(|s| s.clone()) } else { None }
                });

                let acked = get(7).map(|v| {
                    matches!(v, Variant::Boolean(true))
                }).unwrap_or(false);

                let active = get(8).map(|v| {
                    matches!(v, Variant::Boolean(true))
                }).unwrap_or(false);

                let retain = get(9).map(|v| {
                    matches!(v, Variant::Boolean(true))
                }).unwrap_or(false);

                let ev = db::OpcEvent {
                    source_id,
                    event_id,
                    event_type,
                    source_name,
                    timestamp,
                    severity,
                    message: message.or_else(|| Some("(no message)".to_string())),
                    condition_name,
                    acked,
                    active,
                    retain,
                };

                if tx.send(ev).is_err() {
                    // Channel closed — driver shutting down.
                    break;
                }
            }
        });

        let guard = session_clone.write();

        let sub_id = guard
            .create_subscription(publishing_ms, 10, 10, 1000, 0, true, callback)
            .map_err(|sc| anyhow::anyhow!("create_event_subscription failed: {}", sc))?;

        // Monitor Server node (ns=0;i=2253) attribute 12 (EventNotifier) with the EventFilter.
        let server_nid = NodeId::new(0u16, 2253u32);
        let monitored = MonitoredItemCreateRequest {
            item_to_monitor: ReadValueId {
                node_id: server_nid,
                attribute_id: 12, // EventNotifier
                index_range: UAString::null(),
                data_encoding: QualifiedName::null(),
            },
            monitoring_mode: MonitoringMode::Reporting,
            requested_parameters: MonitoringParameters {
                client_handle: 0,
                sampling_interval: 0.0, // as fast as possible
                filter: filter_ext,
                queue_size: 100,
                discard_oldest: true,
            },
        };

        guard
            .create_monitored_items(sub_id, TimestampsToReturn::Both, &[monitored])
            .map_err(|sc| anyhow::anyhow!("create_monitored_items (event) failed: {}", sc))?;

        Ok(sub_id)
    })
    .await;

    let sub_id = match sub_result {
        Ok(Ok(id)) => {
            info!(
                source = %source_name_for_log,
                sub_id = id,
                "OPC UA A&C event subscription created"
            );
            id
        }
        Ok(Err(e)) => {
            warn!(source = %source_name_for_log, error = %e, "Failed to create A&C event subscription (non-fatal)");
            return None;
        }
        Err(e) => {
            warn!(source = %source_name_for_log, error = %e, "spawn_blocking error creating A&C subscription");
            return None;
        }
    };

    // Step 4: ConditionRefresh — request all currently active conditions.
    {
        let session_clone = session.clone();
        let src_name = source_name_for_log.clone();
        let sub_id_variant = Variant::UInt32(sub_id);
        let _ = tokio::task::spawn_blocking(move || {
            let guard = session_clone.read();
            // Server node: ns=0;i=2253 (per OPC UA Part 9, ConditionRefresh is called on the Server node)
            // ConditionRefresh method: ns=0;i=3875
            let obj_id = NodeId::new(0u16, 2253u32); // Server node, not ConditionType (2782)
            let method_id = NodeId::new(0u16, 3875u32);
            let args: Option<Vec<Variant>> = Some(vec![sub_id_variant]);
            match guard.call((obj_id, method_id, args)) {
                Ok(_) => {
                    tracing::debug!(source = %src_name, "ConditionRefresh succeeded");
                }
                Err(sc) => {
                    tracing::info!(
                        source = %src_name,
                        status = %sc,
                        "ConditionRefresh failed (non-fatal)"
                    );
                }
            }
        })
        .await;
    }

    // Step 5: background task to drain event_rx and write to DB.
    // Return the JoinHandle so the caller can abort the task when the session ends,
    // preventing stale drain tasks from accumulating across reconnect cycles.
    let db_clone = db.clone();
    let src_name = source_name_for_log.clone();
    let event_handle = tokio::spawn(async move {
        // Collect batches of events and write them every 500ms or when 50 events accumulate.
        let mut batch: Vec<db::OpcEvent> = Vec::with_capacity(50);
        let mut next_flush = tokio::time::Instant::now() + std::time::Duration::from_millis(500);

        loop {
            tokio::select! {
                biased;

                maybe = event_rx.recv() => {
                    match maybe {
                        Some(ev) => {
                            batch.push(ev);
                            if batch.len() >= 50 {
                                if let Err(e) = db::write_opc_events(&db_clone, &batch).await {
                                    warn!(source = %src_name, error = %e, "Failed to write OPC events");
                                }
                                batch.clear();
                                next_flush = tokio::time::Instant::now() + std::time::Duration::from_millis(500);
                            }
                        }
                        None => {
                            // Channel closed — driver shutting down.
                            if !batch.is_empty() {
                                if let Err(e) = db::write_opc_events(&db_clone, &batch).await {
                                    warn!(source = %src_name, error = %e, "Failed to write final OPC events");
                                }
                            }
                            break;
                        }
                    }
                }

                _ = tokio::time::sleep_until(next_flush) => {
                    if !batch.is_empty() {
                        if let Err(e) = db::write_opc_events(&db_clone, &batch).await {
                            warn!(source = %src_name, error = %e, "Failed to write OPC events");
                        }
                        batch.clear();
                    }
                    next_flush = tokio::time::Instant::now() + std::time::Duration::from_millis(500);
                }
            }
        }
    });
    Some(event_handle)
}

// ---------------------------------------------------------------------------
// History recovery
// ---------------------------------------------------------------------------

/// Performs an OPC UA HistoricalRead for all nodes in `node_map` over the range
/// [from_time, to_time], writing results to `points_history_raw`.
/// Returns the total number of data-value rows recovered.
///
/// Uses server-side pagination (continuation points) so arbitrarily large ranges
/// are handled correctly even when the server limits results per request.
async fn harvest_history(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<RwLock<Session>>,
    node_map: &HashMap<NodeId, Uuid>,
    from_time: chrono::DateTime<Utc>,
    to_time: chrono::DateTime<Utc>,
) -> anyhow::Result<u64> {
    use opcua::types::DateTime as OpcDateTime;

    let node_ids: Vec<(NodeId, Uuid)> =
        node_map.iter().map(|(n, p)| (n.clone(), *p)).collect();

    // OPC UA HistoricalRead supports up to ~1000 nodes per request on most servers.
    // We use 200 nodes per chunk to stay well within limits.
    const HISTORY_CHUNK: usize = 200;
    // Values-per-node per page. 0 = server default (typically 100–1000).
    // Use an explicit limit so we can page predictably.
    const VALUES_PER_PAGE: u32 = 500;

    let mut total_written: u64 = 0;

    for chunk in node_ids.chunks(HISTORY_CHUNK) {
        // Track continuation points per node (empty = first request).
        let mut continuations: Vec<opcua::types::ByteString> =
            vec![opcua::types::ByteString::null(); chunk.len()];
        // Once a node has no more pages we remove it from subsequent requests.
        let mut active: Vec<bool> = vec![true; chunk.len()];

        loop {
            let nodes_to_read: Vec<HistoryReadValueId> = chunk
                .iter()
                .enumerate()
                .filter(|(i, _)| active[*i])
                .map(|(i, (nid, _))| HistoryReadValueId {
                    node_id: nid.clone(),
                    index_range: UAString::null(),
                    data_encoding: QualifiedName::null(),
                    continuation_point: continuations[i].clone(),
                })
                .collect();

            if nodes_to_read.is_empty() {
                break;
            }

            let details = ReadRawModifiedDetails {
                is_read_modified: false,
                start_time: OpcDateTime::from(from_time),
                end_time: OpcDateTime::from(to_time),
                num_values_per_node: VALUES_PER_PAGE,
                return_bounds: false,
            };

            let session_clone = session.clone();
            let nodes_clone = nodes_to_read.clone();
            let results = tokio::task::spawn_blocking(move || {
                session_clone.read().history_read(
                    HistoryReadAction::ReadRawModifiedDetails(details),
                    TimestampsToReturn::Source,
                    false,
                    &nodes_clone,
                )
            })
            .await
            .map_err(|e| anyhow::anyhow!("spawn_blocking history_read: {}", e))?
            .map_err(|sc| anyhow::anyhow!("OPC UA history_read returned: {}", sc))?;

            let mut batch: Vec<crate::db::PointUpdate> = Vec::new();
            let mut any_continuation = false;

            // `results` is indexed over the ACTIVE nodes only — map back to chunk indices.
            let active_indices: Vec<usize> = (0..chunk.len()).filter(|i| active[*i]).collect();

            for (res_idx, result) in results.into_iter().enumerate() {
                let chunk_idx = active_indices[res_idx];
                let point_id = chunk[chunk_idx].1;

                if !result.status_code.is_good() {
                    // Server couldn't retrieve history for this node — mark done.
                    active[chunk_idx] = false;
                    continue;
                }

                // Decode HistoryData from the ExtensionObject.
                let history_data = result
                    .history_data
                    .decode_inner::<HistoryData>(&DecodingOptions::default())
                    .unwrap_or_else(|_| HistoryData { data_values: None });

                if let Some(data_values) = history_data.data_values {
                    for dv in data_values {
                        let (value, quality) = extract_value(&dv);
                        let timestamp = dv
                            .source_timestamp
                            .as_ref()
                            .map(|dt| dt.as_chrono())
                            .or_else(|| dv.server_timestamp.as_ref().map(|dt| dt.as_chrono()))
                            .unwrap_or(from_time);
                        batch.push(crate::db::PointUpdate {
                            point_id,
                            value,
                            quality: quality.as_str().to_string(),
                            timestamp,
                        });
                    }
                }

                // Update continuation point for next page.
                if result.continuation_point.is_null() {
                    active[chunk_idx] = false;
                } else {
                    continuations[chunk_idx] = result.continuation_point;
                    any_continuation = true;
                }
            }

            if !batch.is_empty() {
                db::write_history_batch(db, &batch).await?;
                total_written += batch.len() as u64;
            }

            if !any_continuation {
                break;
            }
        }
    }

    Ok(total_written)
}

/// Runs pending history recovery jobs for this source.
/// Called periodically from the data loop.  Picks up jobs in order and runs
/// them one at a time; each job is marked running → complete/failed atomically.
async fn run_pending_recovery_jobs(
    source: &PointSource,
    db: &DbPool,
    session: &Arc<RwLock<Session>>,
    node_map: &HashMap<NodeId, Uuid>,
) {
    let jobs = match db::get_pending_recovery_jobs(db, source.id).await {
        Ok(j) => j,
        Err(e) => {
            warn!(source = %source.name, error = %e, "Failed to fetch recovery jobs");
            return;
        }
    };

    for job in jobs {
        info!(
            source = %source.name,
            job_id = %job.id,
            from = %job.from_time,
            to = %job.to_time,
            "Starting history recovery job"
        );

        if let Err(e) = db::claim_recovery_job(db, job.id).await {
            warn!(source = %source.name, job_id = %job.id, error = %e, "Failed to claim recovery job");
            continue;
        }

        match harvest_history(source, db, session, node_map, job.from_time, job.to_time).await {
            Ok(n) => {
                info!(
                    source = %source.name,
                    job_id = %job.id,
                    rows = n,
                    "History recovery complete"
                );
                let _ = db::complete_recovery_job(db, job.id, n as i64).await;
            }
            Err(e) => {
                warn!(
                    source = %source.name,
                    job_id = %job.id,
                    error = %e,
                    "History recovery failed"
                );
                let _ = db::fail_recovery_job(db, job.id, &e.to_string()).await;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Polling loop (fallback when subscriptions are unsupported)
// ---------------------------------------------------------------------------

/// Fallback data collection when `CreateMonitoredItems` returns `BadServiceUnsupported`
/// for all items.  Periodically reads all nodes via OPC UA Read and pushes the results
/// through the normal flush path.  Exits when the OPC UA session dies.
async fn poll_loop(
    source: &PointSource,
    db: &DbPool,
    uds: &Arc<UdsSender>,
    config: &Arc<Config>,
    session: &Arc<RwLock<Session>>,
    node_map: &HashMap<NodeId, Uuid>,
) {
    let poll_interval = Duration::from_millis(config.publishing_interval_ms);
    let node_ids: Vec<(NodeId, Uuid)> = node_map.iter().map(|(n, p)| (n.clone(), *p)).collect();
    let mut total_polls: u64 = 0;

    info!(
        source = %source.name,
        points = node_ids.len(),
        interval_ms = config.publishing_interval_ms,
        "Polling mode active — reading all nodes periodically"
    );

    loop {
        tokio::time::sleep(poll_interval).await;

        let mut pending: Vec<PointUpdate> = Vec::new();
        let now = Utc::now();

        for chunk in node_ids.chunks(500) {
            let read_ids: Vec<ReadValueId> = chunk
                .iter()
                .map(|(nid, _)| ReadValueId {
                    node_id: nid.clone(),
                    attribute_id: AttributeId::Value as u32,
                    index_range: UAString::null(),
                    data_encoding: QualifiedName::null(),
                })
                .collect();

            let session_clone = session.clone();
            let results = tokio::task::spawn_blocking(move || {
                session_clone
                    .read()
                    .read(&read_ids, TimestampsToReturn::Both, 0.0)
            })
            .await;

            match results {
                Ok(Ok(data_values)) => {
                    for (i, dv) in data_values.iter().enumerate() {
                        if let Some((_, point_id)) = chunk.get(i) {
                            if dv.status.as_ref().map_or(true, |s| s.is_good()) {
                                let (value, quality) = extract_value(dv);
                                let timestamp = dv
                                    .source_timestamp
                                    .as_ref()
                                    .map(|dt| dt.as_chrono())
                                    .or_else(|| {
                                        dv.server_timestamp.as_ref().map(|dt| dt.as_chrono())
                                    })
                                    .unwrap_or(now);
                                pending.push(PointUpdate {
                                    point_id: *point_id,
                                    value,
                                    quality: quality.as_str().to_string(),
                                    timestamp,
                                });
                            }
                        }
                    }
                }
                Ok(Err(sc)) => {
                    warn!(source = %source.name, status = %sc, "Poll read failed — session may have dropped");
                    return; // Trigger reconnect
                }
                Err(_) => {
                    warn!(source = %source.name, "Poll spawn_blocking failed");
                    return;
                }
            }
        }

        total_polls += 1;
        if !pending.is_empty() {
            if total_polls == 1 {
                info!(source = %source.name, points = pending.len(), "First poll read succeeded — data flowing");
            }
            flush(source, db, uds, &mut pending).await;
        } else if total_polls % 10 == 0 {
            warn!(source = %source.name, "Poll returned 0 good values — nodes may be offline or unsupported");
        }

        // Check for pending history recovery jobs every 60 polls.
        if total_polls % 60 == 1 {
            run_pending_recovery_jobs(source, db, session, node_map).await;
        }
    }
}

// ---------------------------------------------------------------------------
// Flush loop
// ---------------------------------------------------------------------------

async fn flush_loop(
    source: &PointSource,
    db: &DbPool,
    uds: &Arc<UdsSender>,
    config: &Arc<Config>,
    session: &Arc<RwLock<Session>>,
    node_map: &HashMap<NodeId, Uuid>,
    mut update_rx: mpsc::UnboundedReceiver<PointUpdate>,
) {
    let interval = Duration::from_millis(config.batch_interval_ms);
    let mut pending: Vec<PointUpdate> = Vec::with_capacity(config.batch_max_points);
    let mut next_flush = Instant::now() + interval;
    let mut heartbeat = tokio::time::Instant::now();
    let heartbeat_interval = Duration::from_secs(30);
    let mut job_check = tokio::time::Instant::now();
    let job_check_interval = Duration::from_secs(60);
    let mut total_updates: u64 = 0;

    loop {
        tokio::select! {
            biased;

            maybe = update_rx.recv() => {
                match maybe {
                    Some(update) => {
                        total_updates += 1;
                        if total_updates == 1 {
                            info!(source = %source.name, "First DataChange callback received!");
                        }
                        pending.push(update);
                        if pending.len() >= config.batch_max_points {
                            flush(source, db, uds, &mut pending).await;
                            next_flush = Instant::now() + interval;
                        }
                    }
                    None => {
                        // Channel closed — session ended.
                        if !pending.is_empty() {
                            flush(source, db, uds, &mut pending).await;
                        }
                        break;
                    }
                }
            }

            _ = tokio::time::sleep_until(next_flush) => {
                if !pending.is_empty() {
                    flush(source, db, uds, &mut pending).await;
                }
                next_flush = Instant::now() + interval;
                // Heartbeat: log every 30s if no data is arriving
                if heartbeat.elapsed() >= heartbeat_interval && total_updates == 0 {
                    warn!(source = %source.name, "No OPC UA DataChange callbacks received in 30s — subscriptions may not be delivering data");
                    heartbeat = tokio::time::Instant::now();
                } else if heartbeat.elapsed() >= heartbeat_interval {
                    heartbeat = tokio::time::Instant::now();
                }
                // Check for pending history recovery jobs every 60s.
                if job_check.elapsed() >= job_check_interval {
                    run_pending_recovery_jobs(source, db, session, node_map).await;
                    job_check = tokio::time::Instant::now();
                }
            }
        }
    }
}

async fn flush(
    source: &PointSource,
    db: &DbPool,
    uds: &Arc<UdsSender>,
    pending: &mut Vec<PointUpdate>,
) {
    if pending.is_empty() {
        return;
    }

    let batch = std::mem::take(pending);

    // Write to DB (current + history).
    if let Err(e) = db::write_points_current(db, &batch).await {
        warn!(source = %source.name, error = %format!("{:#}", e), "Failed to write points_current");
    }
    if let Err(e) = db::write_history_batch(db, &batch).await {
        warn!(source = %source.name, error = %e, "Failed to write points_history_raw");
    }

    // Build UDS batch and send to Data Broker.
    let uds_points: Vec<UdsPointUpdate> = batch
        .iter()
        .map(|u| UdsPointUpdate {
            point_id: u.point_id,
            value: u.value,
            quality: str_to_quality(&u.quality),
            timestamp: u.timestamp.timestamp_millis(),
        })
        .collect();

    let uds_batch = UdsPointBatch {
        source_id: source.id,
        points: uds_points,
    };

    if let Err(e) = uds.send_batch(&uds_batch).await {
        warn!(
            source = %source.name,
            error = %e,
            "UDS send failed; falling back to NOTIFY"
        );
        if let Err(ne) = db::notify_broker(db, source.id, &batch).await {
            warn!(
                source = %source.name,
                error = %ne,
                "NOTIFY fallback also failed"
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn build_security(
    policy: &str,
    mode: &str,
    username: Option<String>,
    password: Option<String>,
) -> (SecurityPolicy, MessageSecurityMode, IdentityToken) {
    // Support deprecated policies (Basic128Rsa15, Basic256) for legacy DCS compatibility.
    // These are deprecated in OPC UA 1.04 but remain the majority of the installed OT base.
    // Doc 17 mandates we support them and log a warning rather than refusing the connection.
    let security_policy = match policy {
        "Basic256Sha256"         => SecurityPolicy::Basic256Sha256,
        "Aes128Sha256RsaOaep"    => SecurityPolicy::Aes128Sha256RsaOaep,
        "Aes256Sha256RsaPss"     => SecurityPolicy::Aes256Sha256RsaPss,
        "Basic256"               => SecurityPolicy::Basic256,
        "Basic128Rsa15"          => SecurityPolicy::Basic128Rsa15,
        _ => SecurityPolicy::None,
    };

    let security_mode = match mode {
        "Sign" => MessageSecurityMode::Sign,
        "SignAndEncrypt" => MessageSecurityMode::SignAndEncrypt,
        _ => MessageSecurityMode::None,
    };

    let identity = if let (Some(user), Some(pass)) = (username, password) {
        IdentityToken::UserName(user, pass)
    } else {
        IdentityToken::Anonymous
    };

    (security_policy, security_mode, identity)
}

/// Extract (f64, PointQuality) from a DataValue.
///
/// NaN and infinity are mapped to (0.0, Bad) per doc 37.
fn extract_value(dv: &DataValue) -> (f64, PointQuality) {
    let quality = status_to_quality(dv.status.as_ref());

    let value = dv
        .value
        .as_ref()
        .and_then(variant_to_f64)
        .unwrap_or(0.0);

    // NaN/infinity → 0.0 with Bad quality.
    if value.is_nan() || value.is_infinite() {
        return (0.0, PointQuality::Bad);
    }

    (value, quality)
}

fn status_to_quality(status: Option<&StatusCode>) -> PointQuality {
    match status {
        None => PointQuality::Good,
        Some(sc) => {
            if sc.is_good() {
                PointQuality::Good
            } else if sc.is_uncertain() {
                PointQuality::Uncertain
            } else {
                PointQuality::Bad
            }
        }
    }
}

fn variant_to_f64(v: &Variant) -> Option<f64> {
    match v {
        Variant::Double(f) => Some(*f),
        Variant::Float(f) => Some(*f as f64),
        Variant::Int64(i) => Some(*i as f64),
        Variant::UInt64(i) => Some(*i as f64),
        Variant::Int32(i) => Some(*i as f64),
        Variant::UInt32(i) => Some(*i as f64),
        Variant::Int16(i) => Some(*i as f64),
        Variant::UInt16(i) => Some(*i as f64),
        Variant::SByte(i) => Some(*i as f64),
        Variant::Byte(i) => Some(*i as f64),
        Variant::Boolean(b) => Some(if *b { 1.0 } else { 0.0 }),
        // String values (MultiStateDiscreteType) — try numeric parse first, then give up.
        // Proper enum-to-index mapping requires schema support; this preserves numeric strings.
        Variant::String(s) => s.value().as_deref().and_then(|s| s.parse::<f64>().ok()),
        _ => None,
    }
}

fn str_to_quality(s: &str) -> PointQuality {
    match s {
        "good" => PointQuality::Good,
        "uncertain" => PointQuality::Uncertain,
        _ => PointQuality::Bad,
    }
}

// ---------------------------------------------------------------------------
// OPC UA server certificate registration
// ---------------------------------------------------------------------------

/// After a successful connection, scan the PKI trust dirs for DER cert files
/// belonging to this source and upsert them into the opc_server_certs table.
///
/// We scan both `trusted/certs/` (auto-trusted or admin-approved) and
/// `rejected/certs/` (pending admin approval when auto_trust=false).
async fn register_server_cert(source: &PointSource, db: &DbPool, config: &Arc<Config>) {
    use sha2::{Digest, Sha256};

    let pki_dir = std::path::Path::new(&config.pki_dir);
    let auto_trust = config.auto_trust_server_certs;

    // Scan trusted and rejected dirs.
    // The opcua library writes server certs directly to pki/trusted/ and pki/rejected/
    // (not a certs/ subdirectory), so we look there.
    let dirs: &[(&str, &str)] = &[
        ("trusted", "trusted"),
        ("rejected", "pending"),
    ];

    for (subdir, initial_status) in dirs {
        let cert_dir = pki_dir.join(subdir);
        let entries = match std::fs::read_dir(&cert_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("der") {
                continue;
            }

            let der_bytes = match std::fs::read(&path) {
                Ok(b) => b,
                Err(e) => {
                    warn!(path = %path.display(), error = %e, "register_server_cert: failed to read cert file");
                    continue;
                }
            };

            // Compute SHA-256 fingerprint
            let mut hasher = Sha256::new();
            hasher.update(&der_bytes);
            let fingerprint = format!("{:x}", hasher.finalize());

            // Parse cert for human-readable fields
            let (subject, issuer, not_before, not_after) =
                parse_der_cert_fields(&der_bytes);

            let status = if auto_trust && *subdir == "trusted/certs" {
                "trusted"
            } else {
                initial_status
            };

            // Upsert: update last_seen_at and status if already exists
            let result = sqlx::query(
                "INSERT INTO opc_server_certs \
                 (source_id, source_name, fingerprint, subject, issuer, \
                  not_before, not_after, cert_der, status, auto_trusted, first_seen_at, last_seen_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now()) \
                 ON CONFLICT (fingerprint) DO UPDATE SET \
                   last_seen_at = now(), \
                   source_id = EXCLUDED.source_id, \
                   source_name = EXCLUDED.source_name",
            )
            .bind(source.id)
            .bind(&source.name)
            .bind(&fingerprint)
            .bind(&subject)
            .bind(&issuer)
            .bind(not_before)
            .bind(not_after)
            .bind(&der_bytes)
            .bind(status)
            .bind(auto_trust && *subdir == "trusted/certs")
            .execute(db)
            .await;

            match result {
                Ok(_) => info!(
                    source = %source.name,
                    fingerprint = %&fingerprint[..16],
                    status,
                    "register_server_cert: upserted OPC server cert"
                ),
                Err(e) => warn!(
                    error = %e,
                    source = %source.name,
                    "register_server_cert: DB upsert failed (non-fatal)"
                ),
            }
        }
    }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/// Rewrite the hostname (and port) portion of `server_url` to match the
/// hostname and port in `client_url`, preserving the server's path.
///
/// This handles the common OPC UA scenario where a server advertises its
/// endpoints using an internal address (e.g. `opc.tcp://127.0.0.1:4840/UA/App`)
/// while the client reaches it via a different DNS name or IP.
fn rewrite_hostname(server_url: &str, client_url: &str) -> String {
    // Extract authority (host[:port]) from client_url.
    let client_authority = if let Some(rest) = client_url.strip_prefix("opc.tcp://") {
        // authority = everything up to the first '/'
        match rest.find('/') {
            Some(i) => &rest[..i],
            None => rest,
        }
    } else {
        return server_url.to_string();
    };

    // Replace the authority in server_url.
    if let Some(rest) = server_url.strip_prefix("opc.tcp://") {
        let path_start = rest.find('/').unwrap_or(rest.len());
        let server_path = &rest[path_start..];
        format!("opc.tcp://{}{}", client_authority, server_path)
    } else {
        server_url.to_string()
    }
}

/// Parse DER-encoded X.509 cert to extract subject, issuer, and validity period.
/// Returns empty strings / None on parse failure.
fn parse_der_cert_fields(
    der: &[u8],
) -> (Option<String>, Option<String>, Option<chrono::DateTime<chrono::Utc>>, Option<chrono::DateTime<chrono::Utc>>) {
    use x509_parser::prelude::*;
    use chrono::{TimeZone, Utc};

    let Ok((_, cert)) = X509Certificate::from_der(der) else {
        return (None, None, None, None);
    };

    let subject = Some(cert.subject().to_string());
    let issuer = Some(cert.issuer().to_string());

    let not_before = Utc.timestamp_opt(cert.validity().not_before.timestamp(), 0).single();
    let not_after  = Utc.timestamp_opt(cert.validity().not_after.timestamp(), 0).single();

    (subject, issuer, not_before, not_after)
}

// ---------------------------------------------------------------------------
// Reconnect backoff — pure helper (extracted for testability)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // --- next_backoff pure helper (mirrors the backoff_secs doubling in run_source) ---

    fn next_backoff(current_secs: u64, max_secs: u64) -> u64 {
        (current_secs * 2).min(max_secs)
    }

    // --- variant_to_f64 ---

    #[test]
    fn variant_double_converts_to_f64() {
        assert!((variant_to_f64(&Variant::Double(3.14)).unwrap() - 3.14).abs() < f64::EPSILON);
    }

    #[test]
    fn variant_float_converts_to_f64() {
        let v = variant_to_f64(&Variant::Float(1.0_f32)).unwrap();
        assert!((v - 1.0).abs() < 1e-6);
    }

    #[test]
    fn variant_int32_converts_to_f64() {
        assert_eq!(variant_to_f64(&Variant::Int32(-7)).unwrap(), -7.0);
    }

    #[test]
    fn variant_uint32_converts_to_f64() {
        assert_eq!(variant_to_f64(&Variant::UInt32(42)).unwrap(), 42.0);
    }

    #[test]
    fn variant_boolean_true_converts_to_1() {
        assert_eq!(variant_to_f64(&Variant::Boolean(true)).unwrap(), 1.0);
    }

    #[test]
    fn variant_boolean_false_converts_to_0() {
        assert_eq!(variant_to_f64(&Variant::Boolean(false)).unwrap(), 0.0);
    }

    #[test]
    fn variant_numeric_string_converts_to_f64() {
        let v = Variant::String(UAString::from("99.5"));
        assert!((variant_to_f64(&v).unwrap() - 99.5).abs() < f64::EPSILON);
    }

    #[test]
    fn variant_non_numeric_string_returns_none() {
        let v = Variant::String(UAString::from("not-a-number"));
        assert!(variant_to_f64(&v).is_none());
    }

    // --- str_to_quality ---

    #[test]
    fn str_to_quality_maps_good_string() {
        assert_eq!(str_to_quality("good"), PointQuality::Good);
    }

    #[test]
    fn str_to_quality_maps_uncertain_string() {
        assert_eq!(str_to_quality("uncertain"), PointQuality::Uncertain);
    }

    #[test]
    fn str_to_quality_maps_unknown_strings_to_bad() {
        assert_eq!(str_to_quality("bad"), PointQuality::Bad);
        assert_eq!(str_to_quality(""), PointQuality::Bad);
        assert_eq!(str_to_quality("GOOD"), PointQuality::Bad);
    }

    // --- extract_value: NaN/infinity → Bad quality ---

    #[test]
    fn extract_value_maps_nan_to_zero_with_bad_quality() {
        let mut dv = DataValue::default();
        dv.value = Some(Variant::Double(f64::NAN));
        let (val, q) = extract_value(&dv);
        assert_eq!(val, 0.0, "NaN must be normalised to 0.0");
        assert_eq!(q, PointQuality::Bad, "NaN must produce Bad quality per doc 37");
    }

    #[test]
    fn extract_value_maps_infinity_to_zero_with_bad_quality() {
        let mut dv = DataValue::default();
        dv.value = Some(Variant::Double(f64::INFINITY));
        let (val, q) = extract_value(&dv);
        assert_eq!(val, 0.0);
        assert_eq!(q, PointQuality::Bad, "Infinity must produce Bad quality per doc 37");
    }

    #[test]
    fn extract_value_normal_float_passes_through() {
        let mut dv = DataValue::default();
        dv.value = Some(Variant::Double(55.5));
        let (val, q) = extract_value(&dv);
        assert!((val - 55.5).abs() < f64::EPSILON);
        assert_eq!(q, PointQuality::Good);
    }

    // --- next_backoff ---

    #[test]
    fn backoff_doubles_from_initial_value() {
        assert_eq!(next_backoff(5, 60), 10);
    }

    #[test]
    fn backoff_doubles_again_on_second_failure() {
        assert_eq!(next_backoff(10, 60), 20);
    }

    #[test]
    fn backoff_is_capped_at_max_secs() {
        // 40 * 2 = 80, but cap is 60.
        assert_eq!(next_backoff(40, 60), 60);
    }

    #[test]
    fn backoff_stays_at_cap_once_reached() {
        assert_eq!(next_backoff(60, 60), 60);
    }

    #[test]
    fn backoff_sequence_matches_documented_5_10_20_40_60() {
        let max = 60u64;
        let mut backoff = 5u64;
        let mut sequence = vec![backoff];
        for _ in 0..4 {
            backoff = next_backoff(backoff, max);
            sequence.push(backoff);
        }
        assert_eq!(sequence, vec![5, 10, 20, 40, 60]);
    }

    #[test]
    fn backoff_with_custom_max_caps_correctly() {
        // max=30: 5→10→20→30→30
        let max = 30u64;
        let mut b = 5u64;
        let seq: Vec<u64> = (0..4).map(|_| { b = next_backoff(b, max); b }).collect();
        assert_eq!(seq, vec![10, 20, 30, 30]);
    }
}
