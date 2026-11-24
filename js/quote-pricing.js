/* =========================================================
   QUOTATION LOGIC (pure functions, no DOM, no side effects)
   Selection shape (only included events are present):
     { engagement:{coverage:2|4}, reception:{coverage:2|4},
       pellikuthuru:{}, pellikoduku:{}, vratham:{}, mehandi:{}, sangeeth:{}, wedding:{},
       haldi:{bride:bool, groom:bool, couple:bool},
       prewedding:{photos:bool, video:bool}, albums:{sheets:50|100|150} }
   ========================================================= */
(function (root) {
  const CFG = (typeof module !== 'undefined' && module.exports) ? require('./quote-config.js') : root.QUOTE_CONFIG;

  /* Indian digit grouping: 255000 -> 2,55,000 */
  function formatINR(n) {
    const s = String(Math.abs(Math.round(n)));
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return (n < 0 ? '-' : '') + (rest ? rest + ',' : '') + last3;
  }

  function preKey(p) {
    return p.photos && p.video ? 'both' : p.photos ? 'photos' : p.video ? 'video' : null;
  }

  /* Number of installments, or null when Wedding is not selected */
  function installmentsFor(sel) {
    if (!sel.wedding) return null;
    return CFG.INSTALLMENTS.base + CFG.INSTALLMENTS.extras.filter(k => sel[k]).length;
  }

  /* Rows for the quotation, in form order. Throws on an incomplete selection. */
  function buildLines(sel) {
    const lines = [];
    const add = (priceKey, optKey, name, services) => {
      const amount = CFG.PRICES[priceKey][optKey];
      if (amount === undefined) throw new Error('No price for ' + priceKey + ' / ' + optKey);
      lines.push({ key: priceKey, name, services, amount });
    };
    for (const ev of CFG.EVENTS) {
      const s = sel[ev.key];
      if (!s) continue;
      switch (ev.key) {
        case 'engagement': case 'reception':
          add(ev.key, s.coverage, CFG.PDF_NAMES[ev.key][s.coverage], CFG.SERVICES[ev.key][s.coverage]); break;
        case 'prewedding': {
          const k = preKey(s);
          if (!k) throw new Error('Pre-Wedding needs Photos and/or Cinematic Video');
          const items = [];
          if (s.photos) items.push(...CFG.SERVICES.prewedding.photos);
          if (s.video) items.push(...CFG.SERVICES.prewedding.video);
          add('prewedding', k, CFG.PDF_NAMES.prewedding, items); break;
        }
        case 'haldi': {
          if (s.couple && (s.bride || s.groom)) throw new Error('Couple Haldi cannot be combined with Bride or Groom');
          if (!s.bride && !s.groom && !s.couple) throw new Error('Haldi needs at least one option');
          for (const id of ['bride', 'groom', 'couple']) {
            if (s[id]) add('haldi_' + id, id === 'couple' ? 4 : 2, CFG.PDF_NAMES['haldi_' + id], CFG.SERVICES['haldi_' + id]);
          }
          break;
        }
        case 'albums':
          add('albums', s.sheets, CFG.PDF_NAMES.albums, CFG.SERVICES.albums[s.sheets]); break;
        default: {
          const cov = Number(Object.keys(CFG.PRICES[ev.key])[0]);
          add(ev.key, cov, CFG.PDF_NAMES[ev.key], CFG.SERVICES[ev.key]);
        }
      }
    }
    return lines;
  }

  /* Applicable terms, with {n} filled in */
  function termsFor(sel) {
    const n = installmentsFor(sel);
    const pre = sel.prewedding;
    const flags = {
      always: true,
      wedding: !!sel.wedding,
      prewedding: !!pre,
      prewedding_both: !!(pre && pre.photos && pre.video)
    };
    return CFG.TERMS.filter(t => flags[t.when]).map(t => t.text.replace('{n}', n));
  }

  /* The pure pricing function: total = sum of the amounts of all included events */
  function priceQuote(sel) {
    const lines = buildLines(sel);
    return {
      lines,
      total: lines.reduce((sum, l) => sum + l.amount, 0),
      installments: installmentsFor(sel),
      terms: termsFor(sel)
    };
  }

  /* Validation (spec 3.4). Returns a list of messages; empty = valid. */
  function validate(client, sel) {
    const errs = [];
    if (!String(client.name || '').trim()) errs.push({ field: 'name', msg: 'Please tell us your name.' });
    if (!String(client.phone || '').trim()) errs.push({ field: 'phone', msg: 'Please enter your contact number so we can reach you.' });
    else if (!/^[+]?[0-9 ()-]{10,16}$/.test(String(client.phone).trim())) errs.push({ field: 'phone', msg: "That number doesn't look right. Please enter a valid mobile number, for example 9876543210." });
    if (!String(client.city || '').trim()) errs.push({ field: 'city', msg: 'Please enter your city or venue.' });
    if (!Object.keys(sel).length) errs.push({ field: 'events', msg: 'Please include at least one event to build your quotation.' });
    for (const ev of CFG.EVENTS) {
      const s = sel[ev.key];
      if (!s) continue;
      if (ev.kind === 'choice' && !(ev.key === 'albums' ? s.sheets : s.coverage))
        errs.push({ field: ev.key, msg: ev.key === 'albums' ? 'Please choose an album size.' : `Please choose a coverage option for ${ev.label}.` });
      if (ev.kind === 'multi' && !s.photos && !s.video)
        errs.push({ field: ev.key, msg: 'Please choose Photos, Cinematic Video, or both for your Pre-Wedding shoot.' });
      if (ev.kind === 'haldi' && !s.bride && !s.groom && !s.couple)
        errs.push({ field: ev.key, msg: 'Please choose Bride, Groom or Couple for Haldi.' });
    }
    return errs;
  }

  const api = { formatINR, installmentsFor, buildLines, termsFor, priceQuote, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.QuotePricing = api;
})(typeof window !== 'undefined' ? window : globalThis);
