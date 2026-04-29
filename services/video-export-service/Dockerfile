FROM rust:1.78-slim AS builder
WORKDIR /app
COPY . .
RUN BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" \
    cargo build --release -p video-export-service

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    ca-certificates \
    libssl3 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/video-export-service /usr/local/bin/
COPY services/video-export-service/capture-worker /app/capture-worker
WORKDIR /app/capture-worker
RUN npm install && npx playwright install --with-deps chromium

ENV CAPTURE_WORKER_PATH=capture-worker/index.mjs
WORKDIR /app
CMD ["video-export-service"]
