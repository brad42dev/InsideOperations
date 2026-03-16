-- OPC UA server certificate trust store
-- Tracks server certificates presented by OPC UA endpoints during connection.
-- Certs start as 'pending' (auto-trusted if auto_trust_certs=true on the source)
-- and can be explicitly trusted or rejected by an administrator.

CREATE TABLE opc_server_certs (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id           uuid REFERENCES point_sources(id) ON DELETE SET NULL,
    source_name         text,                          -- denormalized; kept after source deletion
    fingerprint         text NOT NULL UNIQUE,          -- SHA-256 hex of DER bytes
    subject             text,                          -- e.g. "CN=SimBLAH OPC Server"
    issuer              text,
    not_before          timestamptz,
    not_after           timestamptz,
    cert_der            bytea,                         -- raw DER certificate bytes
    status              text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'trusted', 'rejected')),
    auto_trusted        boolean NOT NULL DEFAULT false,
    reviewed_by         uuid REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at         timestamptz,
    first_seen_at       timestamptz NOT NULL DEFAULT now(),
    last_seen_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_opc_server_certs_source    ON opc_server_certs(source_id);
CREATE INDEX idx_opc_server_certs_status    ON opc_server_certs(status);
CREATE INDEX idx_opc_server_certs_fingerprint ON opc_server_certs(fingerprint);
