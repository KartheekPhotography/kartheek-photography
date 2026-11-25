// Static lifecycle regression checks for the 10-minute quotation workflow.
// Run: node tests/quote-lifecycle.test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const root = path.join(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const form = read("js/quote-form.js");
const html = read("index.html");
const api = read("functions/api/quote.js");
const pdfApi = read("functions/api/quote-pdf.js");
const worker = read("cleanup-worker.js");
const migration = read("migrations/0002_inactivity_notifications.sql");
let pass = 0;
function test(name, fn) { fn(); pass++; console.log("PASS", name); }

test("form does not autosave on input/change", () => {
  assert(!/scheduleAutosave|autosaveTimer|setTimeout\s*\(/.test(form));
  assert(/F\.addEventListener\('input',\s*\(\)\s*=>\s*\{\s*sync\(\);\s*clearErrors\(\);\s*\}\)/.test(form));
});
test("Build persists quote and latest PDF before first email", () => {
  const i = form.indexOf("const saved = await persistQuote");
  assert(i >= 0 && form.indexOf("await uploadLatestPdf(job)", i) > i && form.indexOf("await sendEmail(job, 'first')", i) > i);
});
test("10-minute countdown is started from server response and does not reload page", () => {
  assert(/startCountdown\(job\.inactivityDeadline\)/.test(form));
  assert(/10 \* 60 \* 1000/.test(form));
  assert(!/location\.reload|window\.location\.reload/.test(form));
  assert(/formCountdownTime/.test(form));
});
test("quotation popup has no manual X close control", () => {
  assert(!/id="qclose"/.test(html));
  assert(!/\$\('#qclose'\)/.test(form));
  assert(/id="qedit"/.test(html) && /id="qsubmit"/.test(html));
});
test("successful Submit saves latest state, uploads PDF, emails, closes and resets", () => {
  const i = form.indexOf("$('#qsubmit').onclick");
  const block = form.slice(i, form.indexOf("qb.addEventListener('keydown'", i));
  assert(block.indexOf("persistQuote(last, 'submit')") < block.indexOf("uploadLatestPdf(last)"));
  assert(block.indexOf("uploadLatestPdf(last)") < block.indexOf("sendEmail(last, 'final')"));
  assert(/closeQuote\(false\)/.test(block) && /resetQuotationForm\(\)/.test(block));
});
test("backend resets activity on successful Build even if unchanged", () => {
  assert(/last_activity_at=\?/.test(api));
  assert(/successful Build resets inactivity even when the selection did not change/.test(api));
});
test("PDF upload endpoint authenticates quote token and stores in R2", () => {
  assert(/X-Quote-ID/.test(pdfApi) && /X-Quote-Token/.test(pdfApi));
  assert(/env\.QUOTE_PDFS\.put/.test(pdfApi));
});
test("scheduled Worker checks 10-minute inactivity and sends one email", () => {
  assert(/datetime\('now', '-10 minutes'\)/.test(worker));
  assert(/inactivity_email_sent_at/.test(worker));
  assert(/api\.resend\.com\/emails/.test(worker));
  assert(/attachments:\s*\[\{ filename, content: base64\(pdfBytes\) \}\]/.test(worker));
});
test("migration contains inactivity timestamps", () => {
  assert(/last_activity_at/.test(migration));
  assert(/inactivity_email_claimed_at/.test(migration));
  assert(/inactivity_email_sent_at/.test(migration));
});
console.log(`\n${pass} lifecycle checks passed.`);
