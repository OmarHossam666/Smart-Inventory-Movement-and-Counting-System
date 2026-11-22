const puppeteer = require('./node_modules/puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const page = await browser.newPage();
  const html = `<!DOCTYPE html><html><head><style>
    @page { size: A4; margin: 15mm; }
    @page :first { margin: 0; }
    body { margin: 0; font-family: sans-serif; }
    .p1 { width: 210mm; height: 297mm; background: #0f172a; color: white; break-after: page; padding: 20mm; box-sizing: border-box; }
    .p2 { min-height: 250mm; background: #ffffff; color: black; }
  </style></head><body>
    <div class='p1'><h1>Cover Page</h1></div>
    <div class='p2'><h1>Page 2</h1></div>
  </body></html>`;
  await page.setContent(html);
  await page.pdf({
    path: 'test_header2.pdf',
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size: 8pt; width: 100%; text-align: right; margin-right: 15mm; color: #64748b;">Header</div>',
    footerTemplate: '<div style="font-size: 8pt; width: 100%; display: flex; justify-content: space-between; margin: 0 15mm; color: #64748b;"><span>Smart Inventory</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>'
  });
  await browser.close();
  console.log('PDF rendered test_header2.pdf');
})();
