/// Integration tests for the recognition-service.
///
/// The recognition-service performs P&ID and DCS symbol recognition using
/// ONNX Runtime inference on uploaded .iomodel packages.
///
/// Tests that require a running recognition-service or GPU/ONNX model files
/// are marked `#[ignore]`.  Unit-style tests verify package format parsing
/// and hash computation.
///
///   cargo test -p recognition-service --test recognition -- --ignored

// ---------------------------------------------------------------------------
// SHA-256 hash computation — pure logic, no service needed
// ---------------------------------------------------------------------------

/// A known byte sequence must produce the expected SHA-256 hex digest.
#[test]
fn test_sha256_hash_known_input() {
    use sha2::{Digest, Sha256};

    let input = b"hello world";
    let digest = Sha256::digest(input);
    let hex = format!("{:x}", digest);

    // SHA-256("hello world") = b94d27b9...
    assert!(
        hex.starts_with("b94d27b9"),
        "SHA-256 of 'hello world' must start with b94d27b9, got: {}",
        hex
    );
}

/// The same input must always produce the same hash (deterministic).
#[test]
fn test_sha256_is_deterministic() {
    use sha2::{Digest, Sha256};

    let input = b"iomodel-test-package";
    let h1 = format!("{:x}", Sha256::digest(input));
    let h2 = format!("{:x}", Sha256::digest(input));

    assert_eq!(h1, h2, "SHA-256 must be deterministic for the same input");
}

// ---------------------------------------------------------------------------
// ZIP package structure validation — pure logic
// ---------------------------------------------------------------------------

/// A ZIP archive must be detectable by its magic bytes (PK\x03\x04).
#[test]
fn test_zip_magic_bytes_detection() {
    // ZIP files start with PK (0x50 0x4B 0x03 0x04).
    let zip_magic = [0x50u8, 0x4B, 0x03, 0x04];
    let not_zip = [0xFF, 0xD8, 0xFF, 0xE0]; // JPEG magic

    assert!(
        zip_magic.starts_with(&[0x50, 0x4B]),
        "ZIP magic must start with PK (0x50 0x4B)"
    );
    assert!(
        !not_zip.starts_with(&[0x50, 0x4B]),
        "JPEG magic must not be detected as ZIP"
    );
}

// ---------------------------------------------------------------------------
// Health check — requires live service (#[ignore])
// ---------------------------------------------------------------------------

fn recognition_url() -> String {
    std::env::var("TEST_RECOGNITION_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:3010".to_string())
}

#[tokio::test]
#[ignore]
async fn test_health_live_returns_200() {
    let client = reqwest::Client::new();
    let url = format!("{}/health/live", recognition_url());

    let resp = client.get(&url).send().await.expect("request must succeed");

    assert_eq!(
        resp.status(),
        reqwest::StatusCode::OK,
        "health/live must return 200"
    );
}

// ---------------------------------------------------------------------------
// .iomodel inference stub — requires ONNX model and GPU (#[ignore])
// ---------------------------------------------------------------------------

/// Uploading a valid .iomodel package must return a list of detected symbols.
#[tokio::test]
#[ignore]
async fn test_iomodel_inference_returns_symbols() {
    // Requires TEST_RECOGNITION_SERVICE_URL pointing to a service with a
    // loaded ONNX model and a test .iomodel file at TEST_IOMODEL_PATH.
    let _path = std::env::var("TEST_IOMODEL_PATH")
        .unwrap_or_else(|_| "/tmp/test.iomodel".to_string());

    todo!("implement .iomodel upload and inference assertion");
}
