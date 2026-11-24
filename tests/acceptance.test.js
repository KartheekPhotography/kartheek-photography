/* Acceptance tests from spec section 7 (pricing, PDF text, installments, terms).
   Run: node tests/acceptance.test.js   (needs poppler's pdftotext for the PDF text checks) */
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const P = require('../js/quote-pricing.js'), D = require('../js/quote-pdf.js');

let pass = 0, fail = 0;
const t = (n, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  #${n}  ${extra}`); };
const client = { name: 'Test Client', phone: '9876543210', city: 'Hyderabad' };
const pdfText = sel => {
  const q = P.priceQuote(sel), f = path.join(os.tmpdir(), 'q_' + Math.random().toString(36).slice(2) + '.pdf');
  fs.writeFileSync(f, D.build({ client, quote: q, date: new Date(2026, 10, 25) }));
  const txt = execFileSync('pdftotext', ['-raw', f, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  fs.unlinkSync(f); return { q, txt };
};
const total = sel => P.priceQuote(sel).total;

// 1-3 Engagement / Reception
let r = pdfText({ engagement: { coverage: 2 } });
t(1, r.q.total === 20000 && !/Drone|Highlights/.test(r.txt.split('TERMS')[0]), 'Engagement 2p = 20,000, no Drone/Highlights');
r = pdfText({ engagement: { coverage: 4 } });
t(2, r.q.total === 35000 && /Drone Coverage/.test(r.txt) && /Engagement Highlights Video/.test(r.txt), 'Engagement 4p = 35,000 + Drone + Highlights');
const r2 = total({ reception: { coverage: 2 } }), r4 = pdfText({ reception: { coverage: 4 } });
t(3, r2 === 20000 && r4.q.total === 35000 && /Reception Highlights Video/.test(r4.txt) && !/Engagement Highlights/.test(r4.txt), 'Reception 20,000 / 35,000 + Reception Highlights Video');
// 5
r = pdfText({ pellikuthuru: {}, pellikoduku: {}, vratham: {} });
t(5, r.q.total === 45000 && r.q.lines.every(l => l.amount === 15000) && (r.txt.match(/Traditional Photography & Videography/g) || []).length === 3, '3 x 15,000, Traditional Photography & Videography');
// 6-8 Haldi
t(6, total({ haldi: { bride: true } }) === 20000, 'Haldi Bride = 20,000');
r = pdfText({ haldi: { bride: true, groom: true } });
t(7, r.q.total === 40000 && r.q.lines.length === 2 && /Bride Haldi/.test(r.txt) && /Groom Haldi/.test(r.txt), 'Bride+Groom = 40,000, two rows');
t(8, total({ haldi: { couple: true } }) === 30000, 'Couple = 30,000');
let threw = false; try { P.priceQuote({ haldi: { couple: true, bride: true } }); } catch { threw = true; }
t('8b', threw, 'Couple + Bride rejected by the pricing function');
// 9-11
t(9, total({ sangeeth: {} }) === 30000, 'Sangeeth 30,000');
t(10, total({ mehandi: {} }) === 15000, 'Mehandi 15,000');
r = pdfText({ wedding: {} });
t(11, r.q.total === 70000 && /Wedding Rituals/.test(r.txt) && /Drone Coverage/.test(r.txt) && /Wedding Highlights Video/.test(r.txt), 'Wedding 70,000 + rituals/drone/highlights');
// 12
const pre = (photos, video) => ({ prewedding: { photos, video } });
t(12, total(pre(true, false)) === 30000 && total(pre(false, true)) === 30000 && total(pre(true, true)) === 50000, 'Pre-Wedding 30,000 / 30,000 / 50,000');
r = pdfText(pre(true, true));
t('12b', ['Unlimited edited photographs', 'Photo slideshow video', 'Customized Pre-Wedding Magazine', 'Customized Wedding invitation image', 'Cinematic video song, including aerial drone shots', 'Save-the-date video'].every(s => r.txt.includes(s)), 'Both = all six items');
// 13
t(13, [50, 100, 150].map(s => total({ albums: { sheets: s } })).join() === '20000,35000,50000', 'Albums 20,000 / 35,000 / 50,000');
// 14-17 installments
const inst = sel => pdfText(sel).txt.match(/divided into (\d+) installments/);
t(14, total({ wedding: {} }) === 70000 && inst({ wedding: {} })[1] === '4', 'Wedding only: 70,000, 4 installments');
t(15, inst({ wedding: {}, engagement: { coverage: 2 } })[1] === '5' && inst({ wedding: {}, ...pre(true, false) })[1] === '5', 'Wedding + Engagement / Pre-Wedding: 5');
t(16, inst({ wedding: {}, engagement: { coverage: 2 }, ...pre(true, false) })[1] === '6', 'All three: 6');
t(17, inst({ engagement: { coverage: 2 } }) === null && !/installments/.test(pdfText({ engagement: { coverage: 2 } }).txt), 'No Wedding: no installment line');
// 18
r = pdfText({ wedding: {}, engagement: { coverage: 2 } });
t(18, !/accommodation|minimum of 2 days/.test(r.txt), 'No Pre-Wedding: no pre-wedding terms');
r = pdfText(pre(true, false));
t('18b', /accommodation arrangements/.test(r.txt) && !/minimum of 2 days/.test(r.txt), 'Pre-Wedding photos only: travel term, no 2-day term');
r = pdfText(pre(true, true));
t('18c', /accommodation arrangements/.test(r.txt) && /minimum of 2 days/.test(r.txt), 'Pre-Wedding both: travel + 2-day terms');
// 19
r = pdfText({ wedding: {}, engagement: { coverage: 4 }, albums: { sheets: 100 } });
t(19, r.q.total === 140000 && /₹1,40,000/.test(r.txt) && /₹ 35,000/.test(r.txt), 'Total ₹1,40,000, Indian grouping, ₹ glyph extracts');
// constant terms + header/footer
t('T', /minimum of 10% of the total amount/.test(r.txt) && /Travel charges are included/.test(r.txt) && /4K ultra-high quality/.test(r.txt) && /pen drive/.test(r.txt) && /WEDDING QUOTATION/.test(r.txt) && /kartheek__photography/.test(r.txt) && /Thank you!/.test(r.txt) && /25\.11\.2026/.test(r.txt), 'Fixed terms, header, date DD.MM.YYYY, footer');
// validation
const v = P.validate({ name: '', phone: '', city: '' }, {});
t('V1', v.length === 4, 'Empty form: name, phone, city, events errors');
t('V2', P.validate(client, { engagement: {} }).length === 1 && P.validate(client, { albums: {} }).length === 1 && P.validate(client, pre(false, false)).length === 1 && P.validate(client, { haldi: {} }).length === 1, 'Choice / album / pre-wedding / haldi need a pick');
t('V3', P.validate(client, { wedding: {} }).length === 0, 'Valid form passes');
// pagination: all events -> 2 pages, header repeated, footer on last page
const all = { engagement: { coverage: 4 }, ...pre(true, true), pellikuthuru: {}, pellikoduku: {}, vratham: {}, haldi: { bride: true, groom: true }, mehandi: {}, sangeeth: {}, wedding: {}, reception: { coverage: 4 }, albums: { sheets: 150 } };
const f = path.join(os.tmpdir(), 'all.pdf'); fs.writeFileSync(f, D.build({ client, quote: P.priceQuote(all), date: new Date() }));
const pages = execFileSync('pdfinfo', [f], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/)[1];
const p2 = execFileSync('pdftotext', ['-f', '2', '-l', '2', '-raw', f, '-'], { encoding: 'utf8' });
t('P', +pages >= 2 && /EVENTS/.test(p2) && /Thank you!/.test(p2), `Long quotation: ${pages} pages, header repeated, footer on last page`);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
