import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitFrames(frames, n) {
  const total = frames.length;
  const base = Math.floor(total / n);
  const groups = [];
  let start = 0;
  for (let i = 0; i < n; i++) {
    const len = i < n - 1 ? base : total - start;
    // Re-base frame_index to 0 within each page so the modulo-500 page
    // recycle and per-page progress counters work correctly.
    groups.push(
      frames.slice(start, start + len).map((f, localIdx) => ({
        ...f,
        frame_index: localIdx,
      }))
    );
    start += len;
  }
  return groups;
}

function spawnFfmpeg(outputPath, fps, crf) {
  return spawn(
    'ffmpeg',
    [
      '-y',
      '-f', 'image2pipe',
      '-framerate', String(fps),
      '-i', 'pipe:0',
      '-c:v', 'libvpx-vp9',
      '-crf', String(crf),
      '-b:v', '0',
      '-pix_fmt', 'yuv420p',
      '-row-mt', '1',
      '-threads', '4',
      '-deadline', 'good',
      outputPath,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );
}

async function concatSegments(segPaths, outputPath) {
  const listPath = outputPath + '.concat.txt';
  fs.writeFileSync(listPath, segPaths.map(p => `file '${p}'`).join('\n') + '\n');

  await new Promise((resolve, reject) => {
    const ff = spawn(
      'ffmpeg',
      ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath],
      { stdio: 'inherit' }
    );
    ff.on('close', code => {
      try { fs.unlinkSync(listPath); } catch (_) {}
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg concat exited with code ${code}`));
    });
  });
}

// ─── Single-page capture loop ─────────────────────────────────────────────────
// Captures all frames for one segment, writing PNGs to a dedicated ffmpeg stdin.
// Returns duration_seconds for this segment.
async function captureSegment(context, segFrames, segOutputPath, pageIndex, staggerMs, params, onProgress) {
  // Stagger page navigations so all tabs don't hit the server simultaneously.
  if (staggerMs > 0) {
    await new Promise(r => setTimeout(r, staggerMs));
  }

  const ffmpeg = spawnFfmpeg(segOutputPath, params.fps, params.crf);

  let currentPage = await context.newPage();

  currentPage.on('console', msg => {
    process.stderr.write(`[page=${pageIndex} browser:${msg.type()}] ${msg.text()}\n`);
  });
  currentPage.on('pageerror', err => {
    process.stderr.write(`[page=${pageIndex} browser:uncaught] ${err.message}\n`);
  });

  let needsFullLoad = true;

  for (const { timestamp, frame_index } of segFrames) {
    // Recycle the page every 500 frames to prevent memory growth within the tab.
    if (!needsFullLoad && frame_index > 0 && frame_index % 500 === 0) {
      await currentPage.close();
      currentPage = await context.newPage();
      currentPage.on('console', msg => {
        process.stderr.write(`[page=${pageIndex} browser:${msg.type()}] ${msg.text()}\n`);
      });
      currentPage.on('pageerror', err => {
        process.stderr.write(`[page=${pageIndex} browser:uncaught] ${err.message}\n`);
      });
      needsFullLoad = true;
    }

    if (needsFullLoad) {
      const url = params.url_template.replace('{timestamp}', String(timestamp));
      await currentPage.goto(url, { waitUntil: 'load', timeout: 120_000 });

      try {
        await currentPage.waitForFunction(
          () => document.body.dataset.exportReady === 'true',
          null,
          { timeout: 30_000 }
        );
      } catch (waitErr) {
        const diag = await currentPage.evaluate(() => ({
          url: window.location.href,
          bodyDataset: Object.fromEntries(Object.entries(document.body.dataset)),
          bodySnippet: document.body.innerHTML.substring(0, 800),
        })).catch(() => ({ url: 'eval-failed' }));
        process.stderr.write(`[page=${pageIndex} diag] waitForFunction timed out. state=${JSON.stringify(diag)}\n`);
        throw waitErr;
      }

      needsFullLoad = false;
    } else {
      await currentPage.evaluate((ts) => {
        document.body.removeAttribute('data-export-ready');
        window.__exportSetTimestamp?.(ts);
      }, timestamp);
      await currentPage.waitForFunction(
        () => document.body.dataset.exportReady === 'true',
        null,
        { timeout: 30_000 }
      );
    }

    const buf = await currentPage.screenshot({ type: 'png', omitBackground: false });
    ffmpeg.stdin.write(buf);
    onProgress(frame_index + 1);
  }

  await currentPage.close();
  ffmpeg.stdin.end();

  await new Promise((resolve, reject) => {
    ffmpeg.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code} for page ${pageIndex}`));
    });
  });

  return segFrames.length / params.fps;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
try {
  const params = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const parallelPages = Math.max(1, params.parallel_pages || 1);
  const staggerMs = params.page_stagger_ms || 0;

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: params.width, height: params.height },
    deviceScaleFactor: params.dpr,
    ignoreHTTPSErrors: true,
  });

  await context.addInitScript(`
    localStorage.setItem('io_access_token', ${JSON.stringify(params.ticket)});
  `);

  let totalDurationSeconds;

  if (parallelPages === 1) {
    // ── Serial: original single-page path ──────────────────────────────────
    const ffmpeg = spawnFfmpeg(params.output_path, params.fps, params.crf);

    let currentPage = await context.newPage();
    currentPage.on('console', msg => {
      process.stderr.write(`[browser:${msg.type()}] ${msg.text()}\n`);
    });
    currentPage.on('pageerror', err => {
      process.stderr.write(`[browser:uncaught] ${err.message}\n`);
    });

    let needsFullLoad = true;

    for (const { timestamp, frame_index } of params.frames) {
      if (!needsFullLoad && frame_index > 0 && frame_index % 500 === 0) {
        await currentPage.close();
        currentPage = await context.newPage();
        needsFullLoad = true;
      }

      if (needsFullLoad) {
        const url = params.url_template.replace('{timestamp}', String(timestamp));
        await currentPage.goto(url, { waitUntil: 'load', timeout: 120_000 });
        try {
          await currentPage.waitForFunction(
            () => document.body.dataset.exportReady === 'true',
            null,
            { timeout: 30_000 }
          );
        } catch (waitErr) {
          const diag = await currentPage.evaluate(() => ({
            url: window.location.href,
            bodyDataset: Object.fromEntries(Object.entries(document.body.dataset)),
            bodySnippet: document.body.innerHTML.substring(0, 800),
          })).catch(() => ({ url: 'eval-failed' }));
          process.stderr.write(`[diag] waitForFunction timed out. state=${JSON.stringify(diag)}\n`);
          throw waitErr;
        }
        needsFullLoad = false;
      } else {
        await currentPage.evaluate((ts) => {
          document.body.removeAttribute('data-export-ready');
          window.__exportSetTimestamp?.(ts);
        }, timestamp);
        await currentPage.waitForFunction(
          () => document.body.dataset.exportReady === 'true',
          null,
          { timeout: 30_000 }
        );
      }

      const buf = await currentPage.screenshot({ type: 'png', omitBackground: false });
      ffmpeg.stdin.write(buf);

      process.stdout.write(
        JSON.stringify({ type: 'progress', frame: frame_index + 1, total: params.frames.length }) + '\n'
      );
    }

    await currentPage.close();
    ffmpeg.stdin.end();
    await new Promise((resolve, reject) => {
      ffmpeg.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });

    totalDurationSeconds = params.frames.length / params.fps;

  } else {
    // ── Parallel: N tabs in one Chromium, each writing its own segment ──────
    const frameGroups = splitFrames(params.frames, parallelPages);
    const segPaths = frameGroups.map((_, i) => params.output_path + `.seg${i}.webm`);

    // Per-page frame counters for aggregated progress reporting
    const counters = new Array(parallelPages).fill(0);
    const total = params.frames.length;

    function onPageProgress(pageIndex, localFrame) {
      counters[pageIndex] = localFrame;
      const done = counters.reduce((a, b) => a + b, 0);
      process.stdout.write(
        JSON.stringify({ type: 'progress', frame: done, total }) + '\n'
      );
    }

    await Promise.all(
      frameGroups.map((segFrames, i) =>
        captureSegment(
          context,
          segFrames,
          segPaths[i],
          i,
          i * staggerMs,
          params,
          (localFrame) => onPageProgress(i, localFrame)
        )
      )
    );

    // Concat segments in order, then clean up
    await concatSegments(segPaths, params.output_path);
    for (const p of segPaths) {
      try { fs.unlinkSync(p); } catch (_) {}
    }

    totalDurationSeconds = params.frames.length / params.fps;
  }

  await browser.close();

  const stat = fs.statSync(params.output_path);
  process.stdout.write(
    JSON.stringify({
      type: 'done',
      file_size: stat.size,
      duration_seconds: totalDurationSeconds,
    }) + '\n'
  );

} catch (err) {
  process.stdout.write(
    JSON.stringify({ type: 'error', message: err.message || String(err) }) + '\n'
  );
  process.exit(1);
}
