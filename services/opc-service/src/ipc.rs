use io_bus::{encode_data_frame, encode_status_frame, FrameError, UdsPointBatch, UdsSourceStatus};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::net::UnixStream;
use tokio::sync::Mutex;
use tracing::{info, warn};

/// Persistent UDS connection to the Data Broker.
///
/// On send failure the connection is dropped so the next call reconnects.
pub struct UdsSender {
    sock_path: String,
    stream: Arc<Mutex<Option<UnixStream>>>,
}

impl UdsSender {
    pub fn new(sock_path: String) -> Self {
        Self {
            sock_path,
            stream: Arc::new(Mutex::new(None)),
        }
    }

    /// Attempt a connection to the socket, logging but not failing if unavailable.
    pub async fn connect(&self) {
        let mut guard = self.stream.lock().await;
        match UnixStream::connect(&self.sock_path).await {
            Ok(s) => {
                info!(sock = %self.sock_path, "Connected to Data Broker UDS socket");
                *guard = Some(s);
            }
            Err(e) => {
                warn!(sock = %self.sock_path, error = %e, "Cannot connect to Data Broker UDS socket (will retry on next send)");
            }
        }
    }

    /// Send a data batch frame; reconnects if the connection is absent or broken.
    pub async fn send_batch(&self, batch: &UdsPointBatch) -> Result<(), FrameError> {
        let frame = encode_data_frame(batch)?;
        self.write_frame(&frame).await
    }

    /// Send a source-status frame.
    pub async fn send_status(&self, status: &UdsSourceStatus) -> Result<(), FrameError> {
        let frame = encode_status_frame(status)?;
        self.write_frame(&frame).await
    }

    /// Internal: ensure connected, then write the pre-encoded frame bytes.
    async fn write_frame(&self, frame: &[u8]) -> Result<(), FrameError> {
        let mut guard = self.stream.lock().await;

        // Reconnect if not connected.
        if guard.is_none() {
            match UnixStream::connect(&self.sock_path).await {
                Ok(s) => {
                    info!(sock = %self.sock_path, "Reconnected to Data Broker UDS socket");
                    *guard = Some(s);
                }
                Err(e) => {
                    return Err(FrameError::Io(e));
                }
            }
        }

        // Try to write.
        let stream = guard.as_mut().unwrap();
        if let Err(e) = stream.write_all(frame).await {
            warn!(sock = %self.sock_path, error = %e, "UDS write failed; dropping connection");
            *guard = None;
            return Err(FrameError::Io(e));
        }

        Ok(())
    }
}
