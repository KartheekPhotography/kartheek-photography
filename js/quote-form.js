/* =========================================================
   QUOTATION BUILDER: form behaviour, popups, email
   No price is ever written to the page. Prices exist only in the PDF.
   ========================================================= */
(function () {
  const CFG = window.QUOTE_CONFIG, Pricing = window.QuotePricing, PDF = window.QuotePDF;
  const BASE = (document.currentScript && document.currentScript.src) || new URL('js/quote-form.js', location.href).href;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const saveStatus = $('#saveStatus');
  const F = $('#enqForm'), evBox = $('#evBox'), panelsBox = $('#panels'), sendBtn = $('#send'), errBox = $('#err');
  let last = null, blobUrl = null, building = false;

  /* ---------- render the event chips and option panels from the config ---------- */
  evBox.innerHTML =
    `<label>Which events should we cover?<i class="req" aria-hidden="true">*</i></label>` +
    `<div class="opts">${CFG.EVENTS.map(ev =>
      `<label class="opt"><input type="checkbox" data-ev="${ev.key}"><span>${esc(ev.label)}</span></label>`).join('')}</div>` +
    `<p class="note">${esc(CFG.COPY.eventsNote)}</p>`;

  const radio = (name, value, label, extra = '') =>
    `<label class="opt${extra}"><input type="radio" name="${name}" value="${value}"${extra ? ' checked tabindex="-1"' : ''}><span>${esc(label)}</span></label>`;

  panelsBox.innerHTML = CFG.EVENTS.map(ev => {
    let body = '', title = ev.label;
    if (ev.kind === 'choice') {
      title = ev.key === 'albums' ? 'Album size' : `${ev.label} coverage`;
      body = `<div class="opts">${ev.options.map(o => radio(ev.key + '_opt', o.value, o.label)).join('')}</div>`;
      if (ev.messages) body += `<p class="note msg" data-msg hidden></p>`;
      if (ev.compare) body += `<button type="button" class="linkbtn" data-compare>${esc(CFG.COMPARE.link)}</button>`;
      if (ev.key === 'albums') body += `<p class="note">${esc(CFG.COPY.albumsNote)}</p>`;
    } else if (ev.kind === 'fixed') {
      title = `${ev.label} coverage`;
      body = `<div class="opts">${radio(ev.key + '_opt', 'fixed', ev.fixed, ' locked')}</div>` + (ev.note ? `<p class="note">${esc(ev.note)}</p>` : '');
    } else if (ev.kind === 'multi') {
      title = 'Pre-Wedding shoot';
      body = `<div class="opts">${ev.options.map(o => `<label class="opt"><input type="checkbox" data-opt="${o.id}"><span>${esc(o.label)}</span></label>`).join('')}</div>` +
        `<p class="note">${esc(CFG.COPY.preweddingNote)}</p>`;
    } else if (ev.kind === 'haldi') {
      body = `<div class="opts">${ev.options.map(o => `<label class="opt"><input type="checkbox" data-opt="${o.id}"><span>${esc(o.label)}</span></label>`).join('')}</div>` +
        `<div data-haldi-notes></div>`;
    }
    return `<div class="panel" data-ev="${ev.key}" hidden><h4>${esc(title)}</h4>${body}</div>`;
  }).join('');

  const chip = k => evBox.querySelector(`input[data-ev="${k}"]`);
  const panel = k => panelsBox.querySelector(`.panel[data-ev="${k}"]`);
  const evOf = k => CFG.EVENTS.find(e => e.key === k);

  /* ---------- read the current selection ---------- */
  function getSelection() {
    const sel = {};
    for (const ev of CFG.EVENTS) {
      if (!chip(ev.key).checked) continue;
      const p = panel(ev.key);
      if (ev.kind === 'choice') {
        const r = p.querySelector('input[type=radio]:checked');
        sel[ev.key] = ev.key === 'albums' ? { sheets: r ? +r.value : undefined } : { coverage: r ? +r.value : undefined };
      } else if (ev.kind === 'multi' || ev.kind === 'haldi') {
        const o = {}; p.querySelectorAll('input[data-opt]').forEach(i => { o[i.dataset.opt] = i.checked; });
        sel[ev.key] = o;
      } else sel[ev.key] = {};
    }
    return sel;
  }
  /* "raghavi reddy" -> "Raghavi Reddy" (first letter of each word; the rest is left as typed) */
  const titleCase = s => s.trim().replace(/\s+/g, ' ').replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase());
  const getClient = () => ({ name: titleCase($('#name').value), phone: $('#phone').value.trim(), city: titleCase($('#city').value) });
  let savedQuote = null, leadEmailSent = false;
  async function persistQuote(job, action) {
    const payload = {
      action, id: savedQuote && savedQuote.id, token: savedQuote && savedQuote.token,
      client: job.client, eventDate: $('#date').value, comments: $('#comments').value.trim(),
      selection: job.selection, quote: {
        total: job.quote.total, installments: job.quote.installments,
        lines: job.quote.lines.map(l => ({ name: l.name, services: l.services, amount: l.amount }))
      }
    };
    const response = await fetch('/api/quote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({ success: false, code: 'bad_response' }));
    if (!response.ok || !data.success) {
      const err = new Error(data.message || 'Could not save quotation'); err.status = response.status; err.code = data.code; throw err;
    }
    if (action === 'create') savedQuote = { id: data.id, token: data.token, revision: data.revision };
    else savedQuote = { ...savedQuote, revision: data.revision, status: data.status };
    job.quoteId = savedQuote.id; job.revision = savedQuote.revision;
    return data;
  }

  /* ---------- live behaviour ---------- */
  function sync() {
    for (const ev of CFG.EVENTS) {
      const on = chip(ev.key).checked, p = panel(ev.key);
      p.hidden = !on;
      if (!on) continue;
      if (ev.messages) {                          // message under the chosen coverage (form only)
        const r = p.querySelector('input[type=radio]:checked'), m = p.querySelector('[data-msg]');
        m.hidden = !r; m.textContent = r ? ev.messages[r.value] : '';
      }
      if (ev.kind === 'haldi') {                  // mutual exclusion + notes
        const [bride, groom, couple] = ['bride', 'groom', 'couple'].map(id => p.querySelector(`[data-opt=${id}]`));
        couple.disabled = bride.checked && groom.checked;     // only when BOTH sides are chosen
        bride.disabled = groom.disabled = couple.checked;
        const notes = new Set();
        ev.options.forEach(o => { if (p.querySelector(`[data-opt=${o.id}]`).checked && o.note) notes.add(o.note); });
        p.querySelector('[data-haldi-notes]').innerHTML = [...notes].map(n => `<p class="note">${esc(n)}</p>`).join('');
      }
    }
  }

  /* ---------- errors ---------- */
  function clearErrors() {
    errBox.innerHTML = '';
    F.querySelectorAll('.bad').forEach(e => e.classList.remove('bad'));
    F.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
  }
  function showErrors(errs) {
    errBox.innerHTML = '<ul>' + errs.map(e => `<li>${esc(e.msg)}</li>`).join('') + '</ul>';
    for (const e of errs) {
      let el = F.querySelector(`#${e.field}`) || (e.field === 'events' ? evBox : panel(e.field));
      if (el) { el.classList.add('bad'); if (el.tagName === 'INPUT') el.setAttribute('aria-invalid', 'true'); }
    }
    const first = F.querySelector('.bad');
    if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (first.focus && first.tagName === 'INPUT') first.focus({ preventScroll: true }); }
  }

  F.addEventListener('input', () => { sync(); clearErrors(); });
  F.addEventListener('change', e => {
    // Couple Haldi replaces a single Bride/Groom pick (they cannot be combined)
    if (e.target.matches('[data-opt=couple]') && e.target.checked) {
      panel('haldi').querySelectorAll('[data-opt=bride],[data-opt=groom]').forEach(i => { i.checked = false; });
    }
    sync(); clearErrors();
  });
  sync();

  /* ---------- Compare popup (may close by X, backdrop or Escape) ---------- */
  const cb = $('#cb');
  $('#cbody').innerHTML = `<table class="ctab"><thead><tr>${CFG.COMPARE.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>` +
    CFG.COMPARE.rows.map(r => `<tr>${r.map((c, i) => i ? `<td class="${c.startsWith('✗') ? 'no' : 'yes'}">${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join('')}</tr>`).join('') + '</tbody></table>';
  let cbOpener = null;
  const openCompare = opener => { cbOpener = opener; cb.classList.add('open'); cb.querySelector('.qbox').focus(); };
  const closeCompare = () => { cb.classList.remove('open'); if (cbOpener) cbOpener.focus(); };
  panelsBox.addEventListener('click', e => { const b = e.target.closest('[data-compare]'); if (b) openCompare(b); });
  $('#cbclose').onclick = closeCompare;
  cb.addEventListener('click', e => { if (e.target === cb) closeCompare(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && cb.classList.contains('open')) closeCompare(); });

  /* ---------- Quotation popup (closes ONLY via Close or Edit) ---------- */
  const qb = $('#qb'), qview = $('#qview'), qstatus = $('#qstatus');
  let renderToken = 0;

  async function renderViewer(bytes, url) {
    const token = ++renderToken;
    qview.innerHTML = '<p class="qwait">Preparing your quotation…</p>';
    try {
      const pdfjs = await import(new URL('vendor/pdf.min.mjs', BASE).href);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdf.worker.min.mjs', BASE).href;
      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const frag = document.createDocumentFragment();
      const cssW = Math.max(240, Math.min(qview.clientWidth - 24, 720));
      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = (cssW / base.width) * Math.min(window.devicePixelRatio || 1, 2.5);
        const vp = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
        canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `Quotation page ${n} of ${doc.numPages}`);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        frag.appendChild(canvas);
      }
      if (token !== renderToken) return;
      qview.innerHTML = ''; qview.appendChild(frag); qview.scrollTop = 0;
    } catch (err) {
      console.error('PDF preview failed, using the browser viewer', err);
      if (token !== renderToken) return;
      qview.innerHTML = `<iframe class="qframe" title="Quotation PDF" src="${url}"></iframe>`;
    }
  }

  function openQuote() {
    qb.classList.add('open'); document.documentElement.style.overflow = 'hidden';
    qb.querySelector('.qbox').focus();
  }
  function closeQuote(toForm) {
    qb.classList.remove('open'); document.documentElement.style.overflow = '';
    renderToken++;
    if (toForm) { const t = chip(CFG.EVENTS[0].key); $('#enquire').scrollIntoView({ block: 'start' }); t.focus({ preventScroll: true }); }
    else sendBtn.focus({ preventScroll: true });
  }
  $('#qclose').onclick = () => closeQuote(false);
  $('#qedit').onclick = () => closeQuote(true);
  $('#qdl').onclick = () => {
    if (!last) return;
    const a = document.createElement('a'); a.href = blobUrl; a.download = last.fileName;
    document.body.appendChild(a); a.click(); a.remove();             // popup stays open
  };
  $('#qsubmit').onclick = async () => {
    if (!last || !savedQuote || building) return;
    const b = $('#qsubmit'); b.disabled = true; b.textContent = 'Submitting…';
    try {
      const client = getClient(), selection = getSelection(), quote = Pricing.priceQuote(selection);
      const now = new Date(), safeName = client.name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'Client';
      const fileName = CFG.FILE_NAME.replace('{name}', safeName).replace('{date}', `${two(now.getDate())}-${two(now.getMonth() + 1)}-${now.getFullYear()}`);
      last = { ...last, client, selection, quote, bytes: PDF.build({ client, quote, date: now }), fileName, createdLabel: PDF.fmtDate(now, '.') };
      await sendEmail(last); // second and final owner notification, only on explicit submit
      const result = await persistQuote(last, 'submit');
      qstatus.className = 'qstatus ok'; qstatus.textContent = `Submitted · Revision ${result.revision}`;
      saveStatus.textContent = `Quotation submitted · Revision ${result.revision}`;
      b.textContent = 'Submitted'; b.disabled = true;
    } catch (err) {
      console.error('Final quotation submission failed', err);
      qstatus.className = 'qstatus'; qstatus.textContent = 'Submission failed. Please try again.';
      b.disabled = false; b.textContent = 'Submit quotation';
    }
  };
  qb.addEventListener('keydown', e => {                             // keep Tab inside the popup; Escape is ignored on purpose
    if (e.key !== 'Tab') return;
    const f = [...qb.querySelectorAll('button')].filter(b => !b.disabled);
    if (!f.length) return;
    const first = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === qb.querySelector('.qbox'))) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  });

  /* ---------- studio notification email ---------- */
  const two = n => String(n).padStart(2, '0');
  async function sendEmail(job) {
    const fd = new FormData();
    fd.append('name', job.client.name); fd.append('phone', job.client.phone); fd.append('city', job.client.city);
    if ($('#date').value) fd.append('date', $('#date').value);
    if ($('#comments').value.trim()) fd.append('comments', $('#comments').value.trim());
    fd.append('consent', $('#consent').checked ? 'Agreed' : '');
    if (job.quoteId) fd.append('quote_id', job.quoteId);
    fd.append('bot-field', F.elements['bot-field'].value);
    fd.append('quote', JSON.stringify({
      total: job.quote.total, installments: job.quote.installments, created: job.createdLabel,
      lines: job.quote.lines.map(l => ({ name: l.name, services: l.services, amount: l.amount }))
    }));
    fd.append('quotation', new Blob([job.bytes], { type: 'application/pdf' }), job.fileName);
    const res = await fetch('/api/enquiry', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({ success: false, code: 'bad_response' }));
    if (!res.ok || !data.success) {
      const e = new Error(data.message || 'send failed'); e.status = res.status; e.code = data.code; throw e;
    }
  }

  /* ---------- Build Quotation ----------
     The popup opens after the quote is saved and the studio notification succeeds. */
  F.addEventListener('submit', async e => {
    e.preventDefault();
    if (building) return;
    clearErrors();
    const client = getClient(), sel = getSelection();
    const errs = Pricing.validate(client, sel);
    if (!$('#date').value) errs.push({ field: 'dateBtn', msg: 'Please select your wedding or event date.' });
    if (!$('#consent').checked) errs.push({ field: 'consent', msg: 'Please tick the box so we can contact you about your quotation.' });
    if (errs.length) { showErrors(errs); return; }

    building = true; sendBtn.disabled = true; sendBtn.textContent = CFG.COPY.building;
    let job;
    try {
      const quote = Pricing.priceQuote(sel), date = new Date();
      const bytes = PDF.build({ client, quote, date });
      const safeName = client.name.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'Client';
      const fileName = CFG.FILE_NAME.replace('{name}', safeName).replace('{date}', `${two(date.getDate())}-${two(date.getMonth() + 1)}-${date.getFullYear()}`);
      job = { client, selection: sel, quote, bytes, fileName, createdLabel: PDF.fmtDate(date, '.') };
    } catch (err) {
      console.error('Quotation build failed', err);
      errBox.textContent = CFG.COPY.buildFailed;
      building = false; sendBtn.disabled = false; sendBtn.textContent = 'Build Quotation';
      return;
    }
    job.selection = sel;
    try {
      const firstBuild = !savedQuote;
      await persistQuote(job, firstBuild ? 'create' : 'save');
      if (!leadEmailSent) { await sendEmail(job); leadEmailSent = true; } // retry first email if delivery previously failed
    } catch (err) {
      console.error('Quotation save/email failed', err.status, err.code, err);
      errBox.textContent = (err.code === 'd1_not_configured'
        ? 'Quotation storage is not connected yet. Please try again shortly.'
        : CFG.COPY.sendFailed) + (err.status ? ` (Error ${err.status}${err.code ? ': ' + err.code : ''})` : '');
      errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      building = false; sendBtn.disabled = false; sendBtn.textContent = 'Build Quotation';
      return;
    }
    last = job;
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(new Blob([job.bytes], { type: 'application/pdf' }));
    qstatus.className = 'qstatus ok'; qstatus.textContent = savedQuote.revision === 1 ? CFG.COPY.sentOk : `Saved · Revision ${savedQuote.revision}`;
    saveStatus.textContent = `Quotation saved · Revision ${savedQuote.revision}`;
    openQuote();
    renderViewer(job.bytes, blobUrl);
    building = false; sendBtn.disabled = false; sendBtn.textContent = 'Build Quotation';
  });

  window.QuoteForm = { getSelection, getClient };   // exposed for tests
})();
