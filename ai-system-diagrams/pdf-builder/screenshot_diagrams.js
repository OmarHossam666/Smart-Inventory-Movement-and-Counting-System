/**
 * screenshot_diagrams.js
 * Captures high-resolution preview images from the diagram portfolio HTML.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const BUILD_DIR = path.resolve(__dirname);
const PREVIEW_DIR = path.join(BUILD_DIR, 'previews_diagrams');

function findBrowser() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PUPPETEER_EXECUTABLE_PATH
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }
  throw new Error('Chromium/Edge executable not found in default paths!');
}

async function capture() {
  if (!fs.existsSync(PREVIEW_DIR)) {
    fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  }

  const browserPath = findBrowser();
  const browser = await puppeteer.launch({
    executablePath: browserPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 2000, height: 2600, deviceScaleFactor: 1.5 });

  // 1. Capture Cover Page
  console.log('Capturing Cover Page screenshot...');
  const coverPath = path.join(BUILD_DIR, 'temp_cover_diagrams.html');
  if (fs.existsSync(coverPath)) {
    await page.goto('file:///' + coverPath.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 30000 });
    const coverEl = await page.$('.cover-page');
    if (coverEl) {
      await coverEl.screenshot({ path: path.join(PREVIEW_DIR, '01_cover_page.png') });
    }
  }

  // 2. Capture Key Diagram Pages
  console.log('Capturing Key Diagram Pages from body...');
  const bodyPath = path.join(BUILD_DIR, 'temp_body_diagrams.html');
  if (fs.existsSync(bodyPath)) {
    await page.goto('file:///' + bodyPath.replace(/\\/g, '/'), { waitUntil: 'load', timeout: 45000 });

    const targets = [
      { id: '#toc-gallery', file: '02_toc_gallery_index.png' },
      { id: '#fig-2-1', file: '03_fig_2_1_use_case_portrait.png' },
      { id: '#fig-4-1', file: '04_fig_4_1_activity_landscape.png' },
      { id: '#fig-5-1', file: '05_fig_5_1_class_portrait.png' },
      { id: '#fig-6-1', file: '06_fig_6_1_sequence_landscape.png' },
      { id: '#fig-7-1', file: '07_fig_7_1_logical_view_landscape.png' },
      { id: '#fig-7-3', file: '08_fig_7_3_deployment_landscape.png' },
      { id: '#fig-8-4', file: '09_fig_8_4_sync_state_landscape.png' }
    ];

    for (const t of targets) {
      const el = await page.$(t.id);
      if (el) {
        await el.screenshot({ path: path.join(PREVIEW_DIR, t.file) });
        console.log(`  -> Saved ${t.file}`);
      } else {
        console.warn(`  Warning: Element ${t.id} not found on page!`);
      }
    }
  }

  await browser.close();
  console.log(`Preview screenshots captured in ${PREVIEW_DIR}`);
}

if (require.main === module) {
  capture().catch(err => {
    console.error('Screenshot capture failed:', err);
    process.exit(1);
  });
}

module.exports = { capture };
