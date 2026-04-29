import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const reportsDir = path.join(rootDir, 'reports');
const port = Number(process.env.PERF_PORT || 5173);
const baseUrl = process.env.PERF_URL || `http://127.0.0.1:${port}`;

const viewports = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'macbook-air', width: 1559, height: 975, isMobile: false },
  { name: 'mobile-portrait', width: 390, height: 844, isMobile: true },
  { name: 'mobile-landscape', width: 932, height: 430, isMobile: true },
];

const thresholds = {
  maxCanvasPixels: 3_000_000,
  maxTotalCanvasPixels: 6_000_000,
  maxP95FrameMs: 34,
  maxLoadMs: 5000,
  maxResourceDecodedBytes: 3_000_000,
};

async function main() {
  mkdirSync(reportsDir, { recursive: true });
  const server = await ensureServer();
  const browser = await chromium.launch();
  const results = [];

  try {
    for (const viewport of viewports) {
      console.log(`Measuring ${viewport.name} (${viewport.width}x${viewport.height})...`);
      results.push(await measureViewport(browser, viewport));
    }
  } finally {
    await browser.close();
    if (server) {
      server.kill();
    }
  }

  const bundle = inspectDist();
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    thresholds,
    bundle,
    results,
    findings: buildFindings(results, bundle),
  };

  const jsonPath = path.join(reportsDir, 'performance-diagnostics.json');
  const mdPath = path.join(reportsDir, 'performance-diagnostics.md');
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, renderMarkdown(report));

  console.log(`Performance diagnostics written:\n- ${path.relative(rootDir, jsonPath)}\n- ${path.relative(rootDir, mdPath)}`);
  if (report.findings.some((finding) => finding.severity === 'high')) {
    process.exitCode = 1;
  }
}

async function ensureServer() {
  console.log(`Checking server at ${baseUrl}`);
  if (await canReach(baseUrl)) {
    console.log(`Using existing server at ${baseUrl}`);
    return undefined;
  }

  console.log(`Starting dev server at ${baseUrl}`);
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(command, ['run', 'dev', '--', '--port', String(port)], {
    cwd: rootDir,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await canReach(baseUrl)) {
      return child;
    }
    await sleep(500);
  }

  child.kill();
  throw new Error(`Timed out waiting for dev server at ${baseUrl}`);
}

async function canReach(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}

async function measureViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.isMobile,
    deviceScaleFactor: viewport.isMobile ? 3 : 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(20_000);
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    window.__perfLongTasks = [];
    try {
      const observer = new PerformanceObserver((list) => {
        window.__perfLongTasks.push(
          ...list.getEntries().map((entry) => ({
            name: entry.name,
            startTime: entry.startTime,
            duration: entry.duration,
          })),
        );
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {
      // Long task API is not available in every browser mode.
    }
  });

  const startedAt = Date.now();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.getByTestId('board-stage').locator('canvas').first().waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(500);
  const loadedAt = Date.now();
  const idleFrames = await sampleFrames(page, 90);
  const dragFrames = await sampleDragFrames(page);
  const browserMetrics = await collectBrowserMetrics(page);
  await context.close();

  return {
    viewport,
    wallClockLoadMs: loadedAt - startedAt,
    idleFrames,
    dragFrames,
    consoleMessages,
    pageErrors,
    ...browserMetrics,
  };
}

async function sampleFrames(page, frameCount) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const deltas = await page.evaluate(
        async (count) =>
          new Promise((resolve) => {
            const deltas = [];
            let previous = performance.now();
            const step = () => {
              const now = performance.now();
              deltas.push(now - previous);
              previous = now;
              if (deltas.length >= count) {
                resolve(deltas.slice(1));
                return;
              }
              requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
          }),
        frameCount,
      );
      return summarizeDeltas(deltas);
    } catch (error) {
      if (attempt === 2 || !String(error).includes('Execution context was destroyed')) {
        throw error;
      }
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
    }
  }

  return { avgMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 };
}

async function sampleDragFrames(page) {
  const box = await page.getByTestId('board-stage').boundingBox();
  if (!box) {
    return { avgMs: 0, p95Ms: 0, maxMs: 0, sampleCount: 0 };
  }

  const framePromise = sampleFrames(page, 90);
  const startX = box.x + box.width * 0.55;
  const startY = box.y + box.height * 0.55;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let step = 0; step < 30; step += 1) {
    await page.mouse.move(startX - step * 7, startY + Math.sin(step / 4) * 12);
  }
  await page.mouse.up();
  return framePromise;
}

async function collectBrowserMetrics(page) {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const resources = performance
      .getEntriesByType('resource')
      .map((entry) => ({
        name: entry.name,
        initiatorType: entry.initiatorType,
        transferSize: entry.transferSize || 0,
        decodedBodySize: entry.decodedBodySize || 0,
        duration: entry.duration,
      }))
      .sort((left, right) => right.decodedBodySize - left.decodedBodySize)
      .slice(0, 12);

    const canvases = Array.from(document.querySelectorAll('canvas')).map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return {
        width: canvas.width,
        height: canvas.height,
        bitmapPixels: canvas.width * canvas.height,
        cssWidth: rect.width,
        cssHeight: rect.height,
      };
    });
    const boardStage = document.querySelector('[data-testid="board-stage"]')?.getBoundingClientRect();
    const localStorageBytes = estimateStorageBytes(window.localStorage);
    const longTasks = window.__perfLongTasks || [];

    return {
      navigation: navigation
        ? {
            duration: navigation.duration,
            domContentLoadedMs: navigation.domContentLoadedEventEnd,
            loadEventMs: navigation.loadEventEnd,
            responseEndMs: navigation.responseEnd,
          }
        : undefined,
      resources,
      canvas: {
        count: canvases.length,
        totalBitmapPixels: canvases.reduce((total, canvas) => total + canvas.bitmapPixels, 0),
        maxBitmapPixels: Math.max(0, ...canvases.map((canvas) => canvas.bitmapPixels)),
        items: canvases,
      },
      boardStage: boardStage
        ? {
            width: boardStage.width,
            height: boardStage.height,
          }
        : undefined,
      domNodeCount: document.querySelectorAll('*').length,
      localStorageBytes,
      longTasks: {
        count: longTasks.length,
        totalMs: longTasks.reduce((total, task) => total + task.duration, 0),
        maxMs: Math.max(0, ...longTasks.map((task) => task.duration)),
      },
      device: {
        devicePixelRatio: window.devicePixelRatio,
        memory: navigator.deviceMemory,
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      },
    };

    function estimateStorageBytes(storage) {
      let total = 0;
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index) || '';
        const value = storage.getItem(key) || '';
        total += (key.length + value.length) * 2;
      }
      return total;
    }
  });
}

function inspectDist() {
  const distDir = path.join(rootDir, 'dist');
  if (!existsSync(distDir)) {
    return { exists: false, assets: [] };
  }

  const assets = [];
  walk(distDir, (filePath) => {
    const stat = statSync(filePath);
    if (stat.isFile()) {
      assets.push({
        path: path.relative(rootDir, filePath).replace(/\\/g, '/'),
        bytes: stat.size,
      });
    }
  });

  return {
    exists: true,
    totalBytes: assets.reduce((total, asset) => total + asset.bytes, 0),
    assets: assets.sort((left, right) => right.bytes - left.bytes).slice(0, 20),
  };
}

function walk(dir, visitor) {
  for (const entry of readdirSync(dir)) {
    const nextPath = path.join(dir, entry);
    const stat = statSync(nextPath);
    if (stat.isDirectory()) {
      walk(nextPath, visitor);
    } else {
      visitor(nextPath);
    }
  }
}

function buildFindings(results, bundle) {
  const findings = [];

  for (const result of results) {
    const label = result.viewport.name;
    if (result.canvas.maxBitmapPixels > thresholds.maxCanvasPixels) {
      findings.push({
        severity: 'high',
        area: label,
        message: `Largest canvas has ${formatNumber(result.canvas.maxBitmapPixels)} bitmap pixels.`,
        recommendation: 'Reduce Konva pixel ratio, lower mobile preview resolution, or split heavy layers.',
      });
    }
    if (result.canvas.totalBitmapPixels > thresholds.maxTotalCanvasPixels) {
      findings.push({
        severity: 'medium',
        area: label,
        message: `All canvases total ${formatNumber(result.canvas.totalBitmapPixels)} bitmap pixels.`,
        recommendation: 'Check hidden canvases, previews, and export buffers.',
      });
    }
    if (result.dragFrames.p95Ms > thresholds.maxP95FrameMs) {
      findings.push({
        severity: 'high',
        area: label,
        message: `Drag p95 frame is ${result.dragFrames.p95Ms.toFixed(1)}ms.`,
        recommendation: 'Profile Konva redraw, disable shadows/listening, or simplify active layers while panning.',
      });
    }
    if ((result.navigation?.duration || result.wallClockLoadMs) > thresholds.maxLoadMs) {
      findings.push({
        severity: 'medium',
        area: label,
        message: `Load took ${Math.round(result.navigation?.duration || result.wallClockLoadMs)}ms.`,
        recommendation: 'Inspect large resources and code split non-board workflows.',
      });
    }
    if (result.longTasks.count > 0) {
      findings.push({
        severity: result.longTasks.maxMs > 200 ? 'high' : 'medium',
        area: label,
        message: `${result.longTasks.count} long task(s), max ${result.longTasks.maxMs.toFixed(1)}ms.`,
        recommendation: 'Move heavy import/OCR/share work off initial render and avoid synchronous large JSON work.',
      });
    }
  }

  for (const asset of bundle.assets || []) {
    if (asset.bytes > thresholds.maxResourceDecodedBytes) {
      findings.push({
        severity: 'medium',
        area: 'bundle',
        message: `${asset.path} is ${formatBytes(asset.bytes)}.`,
        recommendation: 'Consider lazy loading, compression, or lower-resolution alternatives.',
      });
    }
  }

  return findings;
}

function renderMarkdown(report) {
  const lines = [
    '# Performance Diagnostics',
    '',
    `Generated: ${report.generatedAt}`,
    `Target: ${report.baseUrl}`,
    '',
    '## Findings',
    '',
  ];

  if (report.findings.length === 0) {
    lines.push('No threshold violations found.', '');
  } else {
    for (const finding of report.findings) {
      lines.push(`- **${finding.severity.toUpperCase()}** ${finding.area}: ${finding.message}`);
      lines.push(`  Recommendation: ${finding.recommendation}`);
    }
    lines.push('');
  }

  lines.push('## Viewports', '');
  for (const result of report.results) {
    lines.push(`### ${result.viewport.name}`);
    lines.push('');
    lines.push(`- Size: ${result.viewport.width}x${result.viewport.height}, DPR ${result.device.devicePixelRatio}`);
    lines.push(`- Load: ${Math.round(result.navigation?.duration || result.wallClockLoadMs)}ms`);
    lines.push(`- Canvas: ${result.canvas.count} canvas(es), max ${formatNumber(result.canvas.maxBitmapPixels)} px, total ${formatNumber(result.canvas.totalBitmapPixels)} px`);
    lines.push(`- Idle frames: avg ${result.idleFrames.avgMs.toFixed(1)}ms, p95 ${result.idleFrames.p95Ms.toFixed(1)}ms, max ${result.idleFrames.maxMs.toFixed(1)}ms`);
    lines.push(`- Drag frames: avg ${result.dragFrames.avgMs.toFixed(1)}ms, p95 ${result.dragFrames.p95Ms.toFixed(1)}ms, max ${result.dragFrames.maxMs.toFixed(1)}ms`);
    lines.push(`- DOM nodes: ${result.domNodeCount}`);
    lines.push(`- Long tasks: ${result.longTasks.count}, max ${result.longTasks.maxMs.toFixed(1)}ms`);
    if (result.consoleMessages.length || result.pageErrors.length) {
      lines.push(`- Console warnings/errors: ${result.consoleMessages.length}, page errors: ${result.pageErrors.length}`);
    }
    lines.push('');
  }

  lines.push('## Largest Dist Assets', '');
  if (!report.bundle.exists) {
    lines.push('No `dist/` folder found. Run `npm run build` before diagnosis for bundle stats.', '');
  } else {
    for (const asset of report.bundle.assets) {
      lines.push(`- ${asset.path}: ${formatBytes(asset.bytes)}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function summarizeDeltas(deltas) {
  const sorted = [...deltas].sort((left, right) => left - right);
  const sum = deltas.reduce((total, value) => total + value, 0);
  return {
    avgMs: sum / Math.max(1, deltas.length),
    p95Ms: percentile(sorted, 0.95),
    maxMs: Math.max(0, ...deltas),
    sampleCount: deltas.length,
  };
}

function percentile(sortedValues, percentileValue) {
  if (!sortedValues.length) {
    return 0;
  }
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * percentileValue) - 1);
  return sortedValues[index];
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function formatNumber(value) {
  return Math.round(value).toLocaleString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
