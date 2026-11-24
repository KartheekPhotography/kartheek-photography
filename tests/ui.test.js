/* Browser flow test (Playwright): form rules, popups, email calls, no prices on the form.
   Run: node tests/ui.test.js   (serves the site on a local port; /api/enquiry is mocked) */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || '/tmp';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.pdf': 'application/pdf' };
const srv = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
let pass = 0, fail = 0; const t = (n, ok, x = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n} ${x}`); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const posts = [];
  await page.route('**/api/enquiry', async route => { posts.push(route.request().postDataBuffer()); await route.fulfill({ json: { success: true } }); });
  await page.route(/imagekit|googleapis|gstatic|ytimg|youtube/, r => r.abort());
  await page.goto(base); await page.waitForSelector('#evBox .opt');
  const chip = k => page.locator(`#evBox input[data-ev=${k}]`);
  const tick = k => page.locator(`#evBox label:has(input[data-ev=${k}])`).click();
  const panel = k => page.locator(`.panel[data-ev=${k}]`);

  // 21 no prices on the form
  const formText = await page.locator('#enqForm').innerText();
  t('21 no price on the form', !/₹|\bINR\b|\bRs\.?\s?\d|\d{2},\d{3}/.test(formText));
  t('button label', (await page.locator('#send').innerText()) === 'Build Quotation');

  // validation
  await page.click('#send');
  t('inline errors, no popup', (await page.locator('#err li').count()) >= 4 && !(await page.locator('#qb.open').count()) && posts.length === 0);

  // fill
  await page.fill('#name', 'Raghavi Reddy'); await page.fill('#phone', '9876543210'); await page.fill('#city', 'Hyderabad'); await page.check('#consent');
  // Engagement: nothing preselected, message, compare
  await tick('engagement');
  t('engagement: nothing preselected', (await panel('engagement').locator('input:checked').count()) === 0);
  await page.click('#send');
  t('engagement needs a choice', /coverage option for Engagement/.test(await page.locator('#err').innerText()));
  await panel('engagement').locator('label:has-text("2 Persons")').click();
  t('2p message', /signature hybrid style by a 2-person team/.test(await panel('engagement').locator('[data-msg]').innerText()));
  await panel('engagement').locator('label:has-text("4 Persons")').click();
  t('4p message', /complimentary Drone coverage/.test(await panel('engagement').locator('[data-msg]').innerText()));
  await panel('engagement').locator('[data-compare]').click();
  t('4 compare opens', await page.locator('#cb.open').count() === 1 && /Highlights Video/.test(await page.locator('#cbody').innerText()));
  await page.screenshot({ path: OUT + '/ui_compare.png' });
  await page.click('#cbclose'); t('4 compare closes with X', await page.locator('#cb.open').count() === 0);
  // fixed + notes
  for (const k of ['pellikuthuru', 'sangeeth', 'wedding', 'mehandi']) await tick(k);
  t('5/9/11 fixed options preselected', (await panel('pellikuthuru').locator('input:checked').count()) === 1 && /hybrid style blends traditional and candid/.test(await panel('pellikuthuru').innerText()) && /Sangeeth comes with 4 Persons Coverage as standard/.test(await panel('sangeeth').innerText()) && /along with Drone coverage and a Wedding Highlights Video/.test(await panel('wedding').innerText()));
  // haldi rules
  await tick('haldi');
  const h = id => panel('haldi').locator(`input[data-opt=${id}]`);
  await panel('haldi').locator('label:has(input[data-opt=bride])').click();
  t('6 bride only: couple still available', !(await h('couple').isDisabled()));
  await panel('haldi').locator('label:has(input[data-opt=groom])').click();
  t('7 bride+groom: couple disabled', await h('couple').isDisabled());
  await panel('haldi').locator('label:has(input[data-opt=bride])').click(); await panel('haldi').locator('label:has(input[data-opt=groom])').click();
  t('un-select restores couple', !(await h('couple').isDisabled()));
  await panel('haldi').locator('label:has(input[data-opt=couple])').click();
  t('8 couple: bride+groom disabled', (await h('bride').isDisabled()) && (await h('groom').isDisabled()));
  await panel('haldi').locator('label:has(input[data-opt=couple])').click();
  await panel('haldi').locator('label:has(input[data-opt=bride])').click(); await panel('haldi').locator('label:has(input[data-opt=groom])').click();
  // prewedding both, reception 4, albums 100
  await tick('prewedding'); await panel('prewedding').locator('label:has-text("Photos")').click(); await panel('prewedding').locator('label:has-text("Cinematic")').click();
  await tick('reception'); await panel('reception').locator('label:has-text("4 Persons")').click();
  await tick('albums'); await panel('albums').locator('label:has-text("100 sheets")').click();
  t('21 still no prices (all panels open)', !/₹|\d{2},\d{3}/.test(await page.locator('#enqForm').innerText()));
  await page.screenshot({ path: OUT + '/ui_form.png', fullPage: false });

  // Build #1
  await page.click('#send');
  await page.waitForSelector('#qb.open canvas', { timeout: 20000 });
  t('popup shows rendered PDF', (await page.locator('#qview canvas').count()) >= 1);
  await page.waitForFunction(() => /shared with Kartheek/.test(document.querySelector('#qstatus').textContent));
  await page.screenshot({ path: OUT + '/ui_popup.png' });
  // popup does not close on backdrop / Escape
  await page.mouse.click(5, 5); await page.keyboard.press('Escape');
  t('popup ignores backdrop click + Escape', await page.locator('#qb.open').count() === 1);
  // download keeps it open and yields the pdf
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#qdl')]);
  const dlPath = OUT + '/downloaded.pdf'; await dl.saveAs(dlPath);
  t('download: name + valid PDF, popup stays open', /^Quotation_Raghavi_Reddy_\d\d-\d\d-\d{4}\.pdf$/.test(dl.suggestedFilename()) && fs.readFileSync(dlPath).slice(0, 5).toString() === '%PDF-' && await page.locator('#qb.open').count() === 1, dl.suggestedFilename());
  // Edit returns with selections preserved
  await page.click('#qedit');
  t('edit closes popup', await page.locator('#qb.open').count() === 0);
  const same = (await page.inputValue('#name')) === 'Raghavi Reddy' && (await chip('albums').isChecked()) && (await panel('albums').locator('input:checked').getAttribute('value')) === '100' && (await h('bride').isChecked()) && (await h('groom').isChecked()) && (await panel('reception').locator('input:checked').getAttribute('value')) === '4';
  t('20 selections preserved after Edit', same);
  // rebuild -> second email; then Close (X)
  await page.click('#send'); await page.waitForSelector('#qb.open canvas', { timeout: 20000 });
  await page.waitForFunction(() => /shared with Kartheek/.test(document.querySelector('#qstatus').textContent));
  t('20 two emails posted', posts.length === 2, 'posts=' + posts.length);
  await page.click('#qclose'); t('close X closes popup', await page.locator('#qb.open').count() === 0);
  // the posted multipart contains the PDF and details
  const body = posts[0].toString('latin1');
  t('email post has PDF + fields', /name="quotation"; filename="Quotation_Raghavi_Reddy_/.test(body) && /%PDF-1\.4/.test(body) && /name="phone"/.test(body) && /name="quote"/.test(body));

  // failed email: no popup, error on the form
  await page.unroute('**/api/enquiry'); await page.route('**/api/enquiry', r => r.fulfill({ status: 502, json: { success: false, code: 'resend_rejected' } }));
  await page.click('#send'); await page.waitForFunction(() => /couldn't send your quotation/.test(document.querySelector('#err').textContent));
  t('failed send: no popup, clear message', (await page.locator('#qb.open').count()) === 0 && /Error 502/.test(await page.locator('#err').innerText()) && !(await page.locator('#send').isDisabled()));
  // title case in the PDF + name
  await page.unroute('**/api/enquiry'); await page.route('**/api/enquiry', async r => { posts.push(r.request().postDataBuffer()); await r.fulfill({ json: { success: true } }); });
  await page.fill('#name', 'raghavi reddy'); await page.fill('#city', 'hyderabad');
  const before = posts.length; await page.click('#send'); await page.waitForSelector('#qb.open canvas'); 
  t('lower-case name/city are capitalised', /filename="Quotation_Raghavi_Reddy_/.test(posts[before].toString('latin1')));
  await page.click('#qclose');
  // calendar
  await page.click('#dateBtn'); await page.waitForSelector('#dpop:not([hidden])');
  t('calendar: past days disabled, prev month locked', (await page.locator('.dpnav[data-nav="-1"]').isDisabled()) && (await page.locator('.dpday:disabled').count()) >= 0);
  await page.screenshot({ path: OUT + '/ui_calendar.png' });
  await page.click('.dpnav[data-nav="1"]'); await page.click('.dpnav[data-nav="1"]'); await page.locator('.dpday:not(:disabled)').nth(14).click();
  t('calendar: picks a date and closes', /\d{4}-\d\d-\d\d/.test(await page.inputValue('#date')) && await page.locator('#dpop[hidden]').count() === 1 && !/Select a date/.test(await page.locator('#dateText').innerText()));
  await page.click('#send'); await page.waitForSelector('#qb.open canvas'); t('date posted with email', /name="date"/.test(posts[posts.length - 1].toString('latin1'))); await page.click('#qclose');

  // mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await m.newPage(); await mp.route('**/api/enquiry', r => r.fulfill({ json: { success: true } })); await mp.route(/imagekit|googleapis|gstatic|ytimg|youtube/, r => r.abort());
  await mp.goto(base); await mp.waitForSelector('#evBox .opt');
  await mp.fill('#name', 'Sai Kiran'); await mp.fill('#phone', '+91 98765 43210'); await mp.fill('#city', 'Vizag'); await mp.check('#consent');
  await mp.locator('#evBox label:has(input[data-ev=wedding])').click(); await mp.locator('#evBox label:has(input[data-ev=engagement])').click();
  await mp.locator('.panel[data-ev=engagement] label:has-text("2 Persons")').click();
  await mp.locator('.panel[data-ev=engagement] [data-compare]').click(); await mp.waitForTimeout(200); await mp.screenshot({ path: OUT + '/ui_mobile_compare.png' }); await mp.click('#cbclose');
  await mp.click('#dateBtn'); await mp.waitForSelector('#dpop:not([hidden])'); await mp.screenshot({ path: OUT + '/ui_mobile_calendar.png' }); await mp.keyboard.press('Escape');
  await mp.locator('#send').scrollIntoViewIfNeeded(); await mp.screenshot({ path: OUT + '/ui_mobile_form.png' });
  await mp.click('#send'); await mp.waitForSelector('#qb.open canvas', { timeout: 20000 });
  await mp.waitForTimeout(500); await mp.screenshot({ path: OUT + '/ui_mobile_popup.png' });
  const noHScroll = await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  t('mobile: popup renders, no horizontal scroll', noHScroll);
  t('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close(); srv.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
