/**
 * Smoke test for the capture-worker.
 * Requires: Node.js, FFmpeg, and Playwright/Chromium.
 * Run: node services/video-export-service/capture-worker/test/smoke.mjs
 */
import { spawn } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal page that immediately signals export-ready so the worker proceeds.
const html = `<!DOCTYPE html><html><body><script>
  document.body.dataset.exportReady = 'true';
</script></body></html>`;

// Spin up a local HTTP server for the three frames.
// We must keep the event loop alive while the worker runs so the server can
// respond to Playwright's page navigations — spawnSync would block the loop.
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'io-smoke-'));
const outputPath = path.join(tmpDir, 'smoke.webm');
const paramsPath = path.join(tmpDir, 'params.json');

const now = Date.now();
const params = {
  frames: [
    { timestamp: now,        frame_index: 0 },
    { timestamp: now + 1000, frame_index: 1 },
    { timestamp: now + 2000, frame_index: 2 },
  ],
  url_template: `${baseUrl}/?ts={timestamp}`,
  width: 640,
  height: 480,
  dpr: 1,
  ticket: 'smoke-test-noop-token',
  fps: 5,
  crf: 28,
  output_path: outputPath,
};

fs.writeFileSync(paramsPath, JSON.stringify(params));

const workerPath = path.join(__dirname, '..', 'index.mjs');
console.log(`Running: node ${workerPath} ${paramsPath}`);

// Use async spawn so the event loop stays alive for the HTTP server above.
const proc = spawn('node', [workerPath, paramsPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
});

const chunks = [];
proc.stdout.on('data', (chunk) => chunks.push(chunk));

let spawnError = null;
const exitCode = await new Promise((resolve) => {
  proc.on('error', (err) => { spawnError = err; resolve(1); });
  proc.on('close', (code) => resolve(code ?? 1));
});

server.close();
const stdout = Buffer.concat(chunks).toString();

if (spawnError) {
  console.error('Failed to start worker:', spawnError.message);
  process.exit(1);
}

if (exitCode !== 0) {
  console.error(`Worker exited with status ${exitCode}`);
  if (stdout) console.error('stdout:', stdout);
  process.exit(1);
}

console.log('Worker output:', stdout || '(none)');

if (!fs.existsSync(outputPath)) {
  console.error(`Output file not found: ${outputPath}`);
  process.exit(1);
}

const { size } = fs.statSync(outputPath);
if (size === 0) {
  console.error('Output file is empty');
  process.exit(1);
}

console.log(`Output file: ${outputPath} (${size} bytes)`);

// Verify VP9 codec via ffprobe if available.
const ffprobe = spawn('ffprobe', [
  '-v', 'quiet',
  '-print_format', 'json',
  '-show_streams',
  outputPath,
]);

const ffprobeChunks = [];
ffprobe.stdout.on('data', (chunk) => ffprobeChunks.push(chunk));

const ffprobeCode = await new Promise((resolve) => {
  ffprobe.on('error', () => resolve(null));   // ffprobe not installed
  ffprobe.on('close', (code) => resolve(code));
});

if (ffprobeCode === 0) {
  const info = JSON.parse(Buffer.concat(ffprobeChunks).toString() || '{}');
  const video = info.streams?.find((s) => s.codec_type === 'video');
  if (!video || video.codec_name !== 'vp9') {
    console.error('Expected VP9 codec, got:', video?.codec_name ?? '(none)');
    process.exit(1);
  }
  console.log('Codec: VP9 ✓');
} else {
  console.warn('ffprobe not available — skipping codec check');
}

// Cleanup
fs.rmSync(tmpDir, { recursive: true });
console.log('Smoke test PASSED');
