const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BUILDER_DIR = __dirname;
const PREVIEW_DIR = path.resolve(BUILDER_DIR, 'previews');

if (!fs.existsSync(PREVIEW_DIR)) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

async function capturePreviews() {
  console.log('📸 Launching Chromium to capture high-res page previews...');
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  // High DPI for crisp preview inspection
  await page.setViewport({ width: 1400, height: 1800, deviceScaleFactor: 2 });

  const htmlPath = path.resolve(BUILDER_DIR, 'document_pass2.html');
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 90000 });
  await page.evaluateHandle('document.fonts.ready');

  // 1. Cover Page screenshot
  console.log('  Capturing Cover Page preview...');
  const coverEl = await page.$('.cover-page');
  if (coverEl) {
    await coverEl.screenshot({ path: path.resolve(PREVIEW_DIR, '01_cover_page.png') });
  }

  // 2. Table of Contents preview
  console.log('  Capturing Table of Contents preview...');
  const tocEl = await page.$('#table-of-contents');
  if (tocEl) {
    await tocEl.screenshot({ path: path.resolve(PREVIEW_DIR, '02_toc.png') });
  }

  // 3. Figure 2.1 (Use case part 1)
  console.log('  Capturing Figure 2.1 (Use Case Part 1)...');
  const fig21El = await page.$('#fig-2-1');
  if (fig21El) {
    await fig21El.screenshot({ path: path.resolve(PREVIEW_DIR, '03_figure_2_1_use_case.png') });
  }

  // 4. Figure 4.1 (Activity Counting - Landscape)
  console.log('  Capturing Figure 4.1 (Activity Counting)...');
  const fig41El = await page.$('#fig-4-1');
  if (fig41El) {
    await fig41El.screenshot({ path: path.resolve(PREVIEW_DIR, '04_figure_4_1_activity_counting.png') });
  }

  // 5. Figure 5.1 (Class Diagram)
  console.log('  Capturing Figure 5.1 (Class Diagram)...');
  const fig51El = await page.$('#fig-5-1');
  if (fig51El) {
    await fig51El.screenshot({ path: path.resolve(PREVIEW_DIR, '05_figure_5_1_class_diagram.png') });
  }

  // 6. Figure 7.1 (Logical View)
  console.log('  Capturing Figure 7.1 (Logical Architecture View)...');
  const fig71El = await page.$('#fig-7-1');
  if (fig71El) {
    await fig71El.screenshot({ path: path.resolve(PREVIEW_DIR, '06_figure_7_1_logical_view.png') });
  }

  // 7. Figure 7.3 (Deployment Diagram)
  console.log('  Capturing Figure 7.3 (Deployment Diagram)...');
  const fig73El = await page.$('#fig-7-3');
  if (fig73El) {
    await fig73El.screenshot({ path: path.resolve(PREVIEW_DIR, '07_figure_7_3_deployment.png') });
  }

  // 8. Figure 8.4 (State Machine Sync Engine)
  console.log('  Capturing Figure 8.4 (State Machine Sync Engine)...');
  const fig84El = await page.$('#fig-8-4');
  if (fig84El) {
    await fig84El.screenshot({ path: path.resolve(PREVIEW_DIR, '08_figure_8_4_sync_state.png') });
  }

  // 9. Master RTM table preview
  console.log('  Capturing Master RTM table preview...');
  const rtmSec = await page.$('#sec-9-2');
  if (rtmSec) {
    // screenshot the table following sec-9-2
    await page.evaluate(() => {
      const el = document.getElementById('sec-9-2');
      if (el) el.scrollIntoView();
    });
    const tableLandscape = await page.$('.table-landscape');
    if (tableLandscape) {
      await tableLandscape.screenshot({ path: path.resolve(PREVIEW_DIR, '09_rtm_table.png') });
    }
  }

  await browser.close();
  console.log(`✅ All previews captured cleanly in ${PREVIEW_DIR}`);
}

capturePreviews().catch((err) => {
  console.error('Preview capture failed:', err);
  process.exit(1);
});
