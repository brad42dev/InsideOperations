use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------
pub use tokio::sync::broadcast;

// ---------------------------------------------------------------------------
// BusEvent — generic envelope for in-process broadcast
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BusEvent {
    pub id: Uuid,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub timestamp: DateTime<Utc>,
}

impl BusEvent {
    pub fn new(event_type: impl Into<String>, payload: serde_json::Value) -> Self {
        Self {
            id: Uuid::new_v4(),
            event_type: event_type.into(),
            payload,
            timestamp: Utc::now(),
        }
    }
}

pub type BusSender = broadcast::Sender<BusEvent>;
pub type BusReceiver = broadcast::Receiver<BusEvent>;

pub fn create_bus(capacity: usize) -> BusSender {
    let (tx, _) = broadcast::channel(capacity);
    tx
}

// ---------------------------------------------------------------------------
// UDS Wire Types (doc 37 §4)
// OPC Service → Data Broker over /var/run/io/opc-broker.sock
// Frame: [type:u8][length:u32 big-endian][payload: MessagePack]
// ---------------------------------------------------------------------------

/// Frame type tags (1-byte prefix before the length+payload).
pub const UDS_TYPE_DATA: u8 = 0x01;
pub const UDS_TYPE_STATUS: u8 = 0x02;

/// Quality enum — serialized as u8 in binary frames.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum PointQuality {
    Good = 0,
    Uncertain = 1,
    Bad = 2,
}

impl PointQuality {
    pub fn from_u8(v: u8) -> Self {
        match v {
            0 => PointQuality::Good,
            1 => PointQuality::Uncertain,
            _ => PointQuality::Bad,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            PointQuality::Good => "good",
            PointQuality::Uncertain => "uncertain",
            PointQuality::Bad => "bad",
        }
    }
}

impl std::fmt::Display for PointQuality {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Single point value within a batch.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdsPointUpdate {
    pub point_id: Uuid,
    pub value: f64,
    pub quality: PointQuality,
    /// Epoch milliseconds.
    pub timestamp: i64,
}

/// Batch of point updates from one OPC source.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdsPointBatch {
    pub source_id: Uuid,
    pub points: Vec<UdsPointUpdate>,
}

/// Source connectivity status change.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceStatusChange {
    Online,
    Offline,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UdsSourceStatus {
    pub source_id: Uuid,
    pub status: SourceStatusChange,
}

// ---------------------------------------------------------------------------
// Frame encode / decode helpers
// ---------------------------------------------------------------------------

use thiserror::Error;

#[derive(Debug, Error)]
pub enum FrameError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("msgpack encode: {0}")]
    Encode(#[from] rmp_serde::encode::Error),
    #[error("msgpack decode: {0}")]
    Decode(#[from] rmp_serde::decode::Error),
    #[error("unknown frame type: {0:#04x}")]
    UnknownType(u8),
    #[error("payload too large: {0} bytes")]
    TooLarge(usize),
}

/// Maximum frame payload (128 KB — well within UDS kernel buffer).
pub const MAX_FRAME_BYTES: usize = 131_072;

/// Encode a data-batch frame (type 0x01) into a byte vector.
pub fn encode_data_frame(batch: &UdsPointBatch) -> Result<Vec<u8>, FrameError> {
    encode_frame(UDS_TYPE_DATA, batch)
}

/// Encode a source-status frame (type 0x02) into a byte vector.
pub fn encode_status_frame(status: &UdsSourceStatus) -> Result<Vec<u8>, FrameError> {
    encode_frame(UDS_TYPE_STATUS, status)
}

fn encode_frame<T: Serialize>(type_tag: u8, payload: &T) -> Result<Vec<u8>, FrameError> {
    let payload_bytes = rmp_serde::to_vec_named(payload)?;
    if payload_bytes.len() > MAX_FRAME_BYTES {
        return Err(FrameError::TooLarge(payload_bytes.len()));
    }
    let len = payload_bytes.len() as u32;
    let mut buf = Vec::with_capacity(5 + payload_bytes.len());
    buf.push(type_tag);
    buf.extend_from_slice(&len.to_be_bytes());
    buf.extend_from_slice(&payload_bytes);
    Ok(buf)
}

/// Decoded UDS frame variants.
#[derive(Debug)]
pub enum UdsFrame {
    Data(UdsPointBatch),
    Status(UdsSourceStatus),
}

/// Decode a single frame from `buf`.
/// Returns `(frame, bytes_consumed)` or `None` if buf is incomplete.
pub fn decode_frame(buf: &[u8]) -> Result<Option<(UdsFrame, usize)>, FrameError> {
    if buf.len() < 5 {
        return Ok(None); // incomplete header
    }
    let type_tag = buf[0];
    let len = u32::from_be_bytes([buf[1], buf[2], buf[3], buf[4]]) as usize;
    if len > MAX_FRAME_BYTES {
        return Err(FrameError::TooLarge(len));
    }
    if buf.len() < 5 + len {
        return Ok(None); // incomplete payload
    }
    let payload = &buf[5..5 + len];
    let frame = match type_tag {
        UDS_TYPE_DATA => {
            let batch: UdsPointBatch = rmp_serde::from_slice(payload)?;
            UdsFrame::Data(batch)
        }
        UDS_TYPE_STATUS => {
            let status: UdsSourceStatus = rmp_serde::from_slice(payload)?;
            UdsFrame::Status(status)
        }
        other => return Err(FrameError::UnknownType(other)),
    };
    Ok(Some((frame, 5 + len)))
}

// ---------------------------------------------------------------------------
// PostgreSQL NOTIFY/LISTEN payload types (doc 37 §5)
// ---------------------------------------------------------------------------

/// Sent on channel `point_updates` (fallback when UDS unavailable).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyPointUpdates {
    #[serde(rename = "type")]
    pub msg_type: String, // always "point_updates"
    pub source_id: Uuid,
    pub points: Vec<NotifyPointValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyPointValue {
    pub id: Uuid,
    pub value: f64,
    pub quality: String, // "good", "uncertain", "bad"
    pub ts: String,      // RFC 3339
}

/// Sent on channel `point_metadata_changed`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyPointMetadataChanged {
    #[serde(rename = "type")]
    pub msg_type: String,    // always "point_metadata_changed"
    pub point_id: Uuid,
    pub change_type: String, // "new", "updated", "removed"
    pub source_id: Uuid,
}

// ---------------------------------------------------------------------------
// WebSocket outbound message types (broker → client, doc 16)
// ---------------------------------------------------------------------------

/// Batch of point value updates sent from broker to client.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsBatchUpdate {
    pub points: Vec<WsPointValue>,
}

/// A single point value within a WebSocket batch update.
/// Abbreviated field names reduce wire size (doc 37 §13).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsPointValue {
    pub id: Uuid,
    pub v: f64,
    pub q: String, // "good", "uncertain", "bad"
    pub t: i64,    // epoch milliseconds
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "payload")]
#[serde(rename_all = "snake_case")]
pub enum WsServerMessage {
    Update(WsBatchUpdate),
    Ping,
    Error {
        message: String,
    },
    PointStale {
        point_id: Uuid,
        last_updated_at: String,
    },
    PointFresh {
        point_id: Uuid,
        value: f64,
        timestamp: String,
    },
    SourceOffline {
        source_id: Uuid,
        source_name: String,
        timestamp: String,
    },
    SourceOnline {
        source_id: Uuid,
        source_name: String,
        timestamp: String,
    },
    AlertNotification {
        payload: serde_json::Value,
    },
    AlertAcknowledged {
        payload: serde_json::Value,
    },
    ExportComplete {
        job_id: Uuid,
    },
    ExportNotification {
        payload: serde_json::Value,
    },
    ExportProgress {
        payload: serde_json::Value,
    },
    /// Server-side session was locked (idle timer fired or manual lock).
    /// Frontend should enter locked state on the next user interaction.
    SessionLocked {
        session_id: Uuid,
    },
    /// Session was unlocked (verify-password / verify-pin succeeded).
    SessionUnlocked {
        session_id: Uuid,
    },
    ServerRestarting,
}

// ---------------------------------------------------------------------------
// WebSocket inbound message types (client → broker, doc 16)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsClientMessage {
    Subscribe {
        points: Vec<Uuid>,
    },
    Unsubscribe {
        points: Vec<Uuid>,
    },
    Pong,
    AcknowledgeAlert {
        alert_id: Uuid,
    },
    StatusReport {
        render_fps: f64,
        pending_updates: u32,
        last_batch_process_ms: u64,
    },
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    // ------------------------------------------------------------------
    // UDS frame round-trip (encode → decode)
    // ------------------------------------------------------------------

    #[test]
    fn data_frame_round_trip_preserves_values() {
        let source_id = Uuid::new_v4();
        let point_id = Uuid::new_v4();
        let original = UdsPointBatch {
            source_id,
            points: vec![UdsPointUpdate {
                point_id,
                value: 42.5,
                quality: PointQuality::Good,
                timestamp: 1_700_000_000_000,
            }],
        };

        let encoded = encode_data_frame(&original).expect("encode should succeed");
        let (frame, consumed) = decode_frame(&encoded)
            .expect("decode should not error")
            .expect("decode should return a frame");

        assert_eq!(consumed, encoded.len(), "all bytes should be consumed");

        match frame {
            UdsFrame::Data(batch) => {
                assert_eq!(batch.source_id, source_id);
                assert_eq!(batch.points.len(), 1);
                assert_eq!(batch.points[0].point_id, point_id);
                assert_eq!(batch.points[0].value, 42.5);
                assert_eq!(batch.points[0].quality, PointQuality::Good);
                assert_eq!(batch.points[0].timestamp, 1_700_000_000_000);
            }
            other => panic!("expected Data frame, got {:?}", other),
        }
    }

    #[test]
    fn status_frame_round_trip_preserves_values() {
        let source_id = Uuid::new_v4();
        let original = UdsSourceStatus {
            source_id,
            status: SourceStatusChange::Offline,
        };

        let encoded = encode_status_frame(&original).expect("encode should succeed");
        let (frame, _) = decode_frame(&encoded)
            .expect("decode should not error")
            .expect("frame should be present");

        match frame {
            UdsFrame::Status(s) => {
                assert_eq!(s.source_id, source_id);
                matches!(s.status, SourceStatusChange::Offline);
            }
            other => panic!("expected Status frame, got {:?}", other),
        }
    }

    #[test]
    fn decode_frame_returns_none_for_incomplete_header() {
        let buf = &[0x01u8, 0x00]; // only 2 bytes — header is 5 bytes
        let result = decode_frame(buf).expect("no error expected");
        assert!(result.is_none(), "incomplete header should yield None");
    }

    #[test]
    fn decode_frame_returns_none_for_incomplete_payload() {
        // Valid header claiming 100 bytes, but buf only has 6
        let mut buf = vec![UDS_TYPE_DATA, 0x00, 0x00, 0x00, 100u8];
        buf.extend_from_slice(&[0xAAu8; 6]);
        let result = decode_frame(&buf).expect("no error expected");
        assert!(result.is_none(), "incomplete payload should yield None");
    }

    #[test]
    fn decode_frame_unknown_type_returns_error() {
        // Encode a frame with an unknown type byte.
        let payload = rmp_serde::to_vec_named(&serde_json::json!({})).unwrap();
        let mut buf = vec![0xFFu8]; // unknown type tag
        buf.extend_from_slice(&(payload.len() as u32).to_be_bytes());
        buf.extend_from_slice(&payload);
        assert!(decode_frame(&buf).is_err(), "unknown frame type must be an error");
    }

    // ------------------------------------------------------------------
    // WsClientMessage JSON deserialization
    // ------------------------------------------------------------------

    #[test]
    fn ws_client_subscribe_deserializes_from_json() {
        let id = Uuid::new_v4();
        let json = format!(r#"{{"type":"subscribe","points":["{}"]}}"#, id);
        let msg: WsClientMessage = serde_json::from_str(&json)
            .expect("subscribe message should deserialize");

        match msg {
            WsClientMessage::Subscribe { points } => {
                assert_eq!(points.len(), 1);
                assert_eq!(points[0], id);
            }
            other => panic!("expected Subscribe, got {:?}", other),
        }
    }

    #[test]
    fn ws_client_pong_deserializes_from_json() {
        let json = r#"{"type":"pong"}"#;
        let msg: WsClientMessage = serde_json::from_str(json)
            .expect("pong should deserialize");
        assert!(matches!(msg, WsClientMessage::Pong));
    }

    #[test]
    fn ws_client_unsubscribe_deserializes_with_empty_list() {
        let json = r#"{"type":"unsubscribe","points":[]}"#;
        let msg: WsClientMessage = serde_json::from_str(json)
            .expect("unsubscribe should deserialize");
        match msg {
            WsClientMessage::Unsubscribe { points } => {
                assert!(points.is_empty());
            }
            other => panic!("expected Unsubscribe, got {:?}", other),
        }
    }

    // ------------------------------------------------------------------
    // WsServerMessage serialization (spot-check Update variant)
    // ------------------------------------------------------------------

    #[test]
    fn ws_server_update_serializes_with_type_and_payload_fields() {
        let msg = WsServerMessage::Update(WsBatchUpdate {
            points: vec![WsPointValue {
                id: Uuid::nil(),
                v: 1.23,
                q: "good".to_string(),
                t: 1_234_567_890,
            }],
        });
        let json = serde_json::to_string(&msg).expect("serialisation should succeed");
        assert!(json.contains(r#""type":"update""#));
        assert!(json.contains(r#""payload""#));
        assert!(json.contains(r#""points""#));
        assert!(json.contains(r#""q":"good""#));
        assert!(json.contains(r#""t":1234567890"#));
    }

    // ------------------------------------------------------------------
    // PointQuality helpers
    // ------------------------------------------------------------------

    #[test]
    fn point_quality_from_u8_0_is_good() {
        assert_eq!(PointQuality::from_u8(0), PointQuality::Good);
    }

    #[test]
    fn point_quality_from_u8_1_is_uncertain() {
        assert_eq!(PointQuality::from_u8(1), PointQuality::Uncertain);
    }

    #[test]
    fn point_quality_from_u8_unknown_value_is_bad() {
        assert_eq!(PointQuality::from_u8(255), PointQuality::Bad);
    }

    #[test]
    fn point_quality_as_str_returns_lowercase_name() {
        assert_eq!(PointQuality::Good.as_str(), "good");
        assert_eq!(PointQuality::Uncertain.as_str(), "uncertain");
        assert_eq!(PointQuality::Bad.as_str(), "bad");
    }

    // ------------------------------------------------------------------
    // BusEvent
    // ------------------------------------------------------------------

    #[test]
    fn bus_event_new_sets_event_type_and_payload() {
        let ev = BusEvent::new("test.event", serde_json::json!({"key": "val"}));
        assert_eq!(ev.event_type, "test.event");
        assert_eq!(ev.payload["key"], "val");
    }
}
