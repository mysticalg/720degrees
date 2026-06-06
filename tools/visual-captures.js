const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/drhoo/.codex/skills/develop-web-game/scripts/node_modules/playwright');

const url = process.argv[2] || 'http://localhost:8123';
const outDir = path.resolve('output/web-game/visual-regression');
const referenceByScenario = {
  city: 'reference_frames/motion/city_scroll.jpg',
  shop: 'reference_frames/motion/city_scroll.jpg',
  airborne: 'output/source-video-check/more-scale/frame_000545.png',
  bail: 'output/source-video-check/more-scale/frame_001220.png',
  map: 'reference_frames/frame_08.png',
  chase: 'output/source-video-check/more-scale/frame_000545.png',
  'event-ramp': 'output/source-video-check/more-scale/frame_000110.png',
  'event-downhill': 'reference_frames/motion/downhill_event.jpg',
  'event-slalom': 'output/source-video-check/more-scale/frame_000355.png',
  'event-jump': 'reference_frames/motion/ramp_event.jpg',
  'ramp-flat': 'reference_frames/motion/ramp_event.jpg',
  'ramp-grind': 'reference_frames/motion/ramp_event.jpg',
  'ramp-air': 'reference_frames/motion/ramp_event.jpg',
  'ramp-handplant': 'reference_frames/motion/ramp_event.jpg',
  'ramp-rock': 'reference_frames/motion/ramp_event.jpg',
  'downhill-duck': 'reference_frames/motion/downhill_event.jpg',
  'downhill-turn': 'reference_frames/motion/downhill_event.jpg',
  'jump-approach': 'reference_frames/motion/ramp_event.jpg',
  'jump-launch': 'reference_frames/motion/ramp_event.jpg',
  'jump-target': 'reference_frames/motion/ramp_event.jpg',
};
const scenarios = [
  'city',
  'shop',
  'airborne',
  'bail',
  'map',
  'chase',
  'event-ramp',
  'event-downhill',
  'event-slalom',
  'event-jump',
  'ramp-flat',
  'ramp-grind',
  'ramp-air',
  'ramp-handplant',
  'ramp-rock',
  'downhill-duck',
  'downhill-turn',
  'jump-approach',
  'jump-launch',
  'jump-target',
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const events = [];
  page.on('console', (msg) => events.push({ type: 'console', level: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => events.push({ type: 'pageerror', text: err.stack || err.message }));
  page.on('requestfailed', (req) => events.push({ type: 'requestfailed', url: req.url(), error: req.failure()?.errorText }));

  await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    ready = await page.evaluate(() => (
      typeof window.__skate720_visualCapture === 'object' && typeof window.render_game_to_text === 'function'
    ));
    if (ready) break;
    await page.waitForTimeout(200);
  }
  if (!ready) throw new Error('Visual capture hook did not initialize');
  await page.waitForFunction(() => (
    !window.__skate720_visualCapture.assetsReady || window.__skate720_visualCapture.assetsReady()
  ), null, { timeout: 5000 });

  const states = {};
  const comparisonRows = [];
  for (const scenario of scenarios) {
    const rawState = await page.evaluate((name) => window.__skate720_visualCapture.scenario(name), scenario);
    try {
      states[scenario] = JSON.parse(rawState);
    } catch {
      states[scenario] = rawState;
    }
    await page.waitForTimeout(80);
    const capturePath = path.join(outDir, `${scenario}.png`);
    await page.screenshot({ path: capturePath, fullPage: true });
    const referencePath = referenceByScenario[scenario] ? path.resolve(referenceByScenario[scenario]) : null;
    comparisonRows.push({
      scenario,
      capturePath,
      referencePath: referencePath && fs.existsSync(referencePath) ? referencePath : null,
      state: states[scenario],
    });
  }

  const failures = events.filter((event) => event.type === 'pageerror' || event.type === 'requestfailed' || event.level === 'error');
  fs.writeFileSync(path.join(outDir, 'states.json'), JSON.stringify(states, null, 2));
  fs.writeFileSync(path.join(outDir, 'browser-events.json'), JSON.stringify(events, null, 2));
  fs.writeFileSync(path.join(outDir, 'comparison.html'), renderComparisonBoard(comparisonRows, outDir));
  await browser.close();

  if (failures.length > 0) {
    console.error(JSON.stringify(failures, null, 2));
    process.exit(1);
  }
  console.log(`Captured ${scenarios.length} visual scenarios in ${outDir}`);
})();

function asFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, '/')}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderComparisonBoard(rows, outputDir) {
  const cards = rows.map((row) => {
    const state = typeof row.state === 'object' ? row.state : {};
    const meta = [
      `mode=${state.mode || ''}`,
      `event=${state.currentEvent || ''}`,
      state.projection ? `tile=${state.projection.tileW}x${state.projection.tileH}` : '',
      state.visual ? `sprite=${state.visual.spriteKey}` : '',
      state.visual ? `screen=${state.visual.playerScreenX},${state.visual.playerScreenY}` : '',
    ].filter(Boolean).join(' | ');
    const reference = row.referencePath
      ? `<img src="${asFileUrl(row.referencePath)}" alt="${escapeHtml(row.scenario)} reference">`
      : '<div class="missing">No reference still found</div>';
    return `
      <section class="card">
        <h2>${escapeHtml(row.scenario)}</h2>
        <p>${escapeHtml(meta)}</p>
        <div class="pair">
          <figure><figcaption>Current</figcaption><img src="${asFileUrl(row.capturePath)}" alt="${escapeHtml(row.scenario)} current"></figure>
          <figure><figcaption>Reference</figcaption>${reference}</figure>
        </div>
      </section>`;
  }).join('\n');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>720 Visual Regression Comparison</title>
  <style>
    body { margin: 0; background: #0b0d12; color: #e8edf5; font: 14px/1.4 Arial, sans-serif; }
    header { padding: 18px 22px; background: #161b24; position: sticky; top: 0; z-index: 1; }
    h1 { margin: 0; font-size: 20px; }
    .card { padding: 18px 22px 28px; border-top: 1px solid #2a3140; }
    .card h2 { margin: 0 0 4px; font-size: 18px; }
    .card p { margin: 0 0 12px; color: #aeb8c8; }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: start; }
    figure { margin: 0; background: #05070a; border: 1px solid #2a3140; padding: 8px; }
    figcaption { color: #f1d84c; margin-bottom: 8px; }
    img { display: block; width: 100%; height: auto; image-rendering: pixelated; }
    .missing { min-height: 220px; display: grid; place-items: center; color: #ff8c8c; background: #170b0d; }
  </style>
</head>
<body>
  <header>
    <h1>720 Visual Regression Comparison</h1>
    <div>${escapeHtml(outputDir)}</div>
  </header>
  ${cards}
</body>
</html>`;
}
