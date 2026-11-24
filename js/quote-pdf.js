/* =========================================================
   QUOTATION PDF GENERATOR
   Dependency-free. Writes a real PDF (selectable text, embedded Roboto
   subset with the rupee sign, vector shapes, dark logo image).
   Usage: QuotePDF.build({ client:{name,phone,city}, quote, date }) -> Uint8Array
   ========================================================= */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const CFG = isNode ? require('./quote-config.js') : root.QUOTE_CONFIG;
  const Pricing = isNode ? require('./quote-pricing.js') : root.QuotePricing;
  const ASSETS = isNode ? require('./quote-assets.js') : root.QUOTE_ASSETS;

  const W = 595.276, H = 841.89, M = 42;           // A4 portrait, margin
  const C = {};
  for (const [k, v] of Object.entries(CFG.PDF.colors)) {
    const n = parseInt(v.slice(1), 16);
    C[k] = [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const f2 = n => (Math.round(n * 100) / 100).toString();
  const rg = (c, stroke) => c.map(f2).join(' ') + (stroke ? ' RG' : ' rg');

  /* ---------- bytes helpers ---------- */
  const enc = new TextEncoder();
  const b64bytes = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const concat = parts => {
    const len = parts.reduce((n, p) => n + p.length, 0); const out = new Uint8Array(len); let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; } return out;
  };
  const hex4 = n => n.toString(16).padStart(4, '0');

  /* ---------- fonts ---------- */
  const FONTS = { regular: 'F1', medium: 'F2', bold: 'F3' };
  function glyphOf(font, ch) {
    const g = ASSETS.fonts[font].glyphs;
    return g[ch.codePointAt(0)] || g[63] || [0, 500];   // '?' for unsupported characters
  }
  const width = (font, s, size, tc = 0) => {
    let w = 0; for (const ch of s) w += glyphOf(font, ch)[1];
    return w * size / 1000 + tc * [...s].length;
  };
  function wrap(font, text, size, maxW) {
    const out = []; let line = '';
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      const t = line ? line + ' ' + word : word;
      if (width(font, t, size) <= maxW) { line = t; continue; }
      if (line) out.push(line);
      if (width(font, word, size) <= maxW) { line = word; continue; }
      let chunk = '';                                   // break a very long word
      for (const ch of word) { if (width(font, chunk + ch, size) > maxW) { out.push(chunk); chunk = ch; } else chunk += ch; }
      line = chunk;
    }
    if (line) out.push(line);
    return out.length ? out : [''];
  }

  /* ---------- page canvas (top-left origin) ---------- */
  class Page {
    constructor() { this.ops = []; }
    text(str, x, top, font, size, color, opts = {}) {      // top = baseline distance from page top
      if (!str) return;
      const tc = opts.tc || 0;
      let px = x;
      if (opts.align === 'right') px = x - width(font, str, size, tc);
      else if (opts.align === 'center') px = x - width(font, str, size, tc) / 2;
      const hex = [...str].map(ch => hex4(glyphOf(font, ch)[0])).join('');
      this.ops.push(`BT /${FONTS[font]} ${f2(size)} Tf ${rg(color)} ${f2(tc)} Tc ${f2(px)} ${f2(H - top)} Td <${hex}> Tj ET`);
    }
    rrectPath(x, top, w, h, r) {
      const y = H - top - h, k = r * 0.5523;
      return `${f2(x + r)} ${f2(y)} m ${f2(x + w - r)} ${f2(y)} l ${f2(x + w - r + k)} ${f2(y)} ${f2(x + w)} ${f2(y + r - k)} ${f2(x + w)} ${f2(y + r)} c ` +
        `${f2(x + w)} ${f2(y + h - r)} l ${f2(x + w)} ${f2(y + h - r + k)} ${f2(x + w - r + k)} ${f2(y + h)} ${f2(x + w - r)} ${f2(y + h)} c ` +
        `${f2(x + r)} ${f2(y + h)} l ${f2(x + r - k)} ${f2(y + h)} ${f2(x)} ${f2(y + h - r + k)} ${f2(x)} ${f2(y + h - r)} c ` +
        `${f2(x)} ${f2(y + r)} l ${f2(x)} ${f2(y + r - k)} ${f2(x + r - k)} ${f2(y)} ${f2(x + r)} ${f2(y)} c h`;
    }
    rrect(x, top, w, h, r, { fill, stroke, lw = 1 } = {}) {
      const ops = [];
      if (fill) ops.push(rg(fill));
      if (stroke) ops.push(rg(stroke, true), f2(lw) + ' w');
      ops.push(this.rrectPath(x, top, w, h, r), fill && stroke ? 'B' : fill ? 'f' : 'S');
      this.ops.push('q ' + ops.join(' ') + ' Q');
    }
    line(x1, top1, x2, top2, color, lw = 1) {
      this.ops.push(`q ${rg(color, true)} ${f2(lw)} w ${f2(x1)} ${f2(H - top1)} m ${f2(x2)} ${f2(H - top2)} l S Q`);
    }
    image(name, x, top, w, h) {
      this.ops.push(`q ${f2(w)} 0 0 ${f2(h)} ${f2(x)} ${f2(H - top - h)} cm /${name} Do Q`);
    }
    circle(cx, top, r, { fill, stroke, lw = 1 } = {}) {
      const cy = H - top, k = r * 0.5523, ops = [];
      if (fill) ops.push(rg(fill)); if (stroke) ops.push(rg(stroke, true), f2(lw) + ' w');
      ops.push(`${f2(cx + r)} ${f2(cy)} m ${f2(cx + r)} ${f2(cy + k)} ${f2(cx + k)} ${f2(cy + r)} ${f2(cx)} ${f2(cy + r)} c ` +
        `${f2(cx - k)} ${f2(cy + r)} ${f2(cx - r)} ${f2(cy + k)} ${f2(cx - r)} ${f2(cy)} c ` +
        `${f2(cx - r)} ${f2(cy - k)} ${f2(cx - k)} ${f2(cy - r)} ${f2(cx)} ${f2(cy - r)} c ` +
        `${f2(cx + k)} ${f2(cy - r)} ${f2(cx + r)} ${f2(cy - k)} ${f2(cx + r)} ${f2(cy)} c h`, fill && stroke ? 'B' : fill ? 'f' : 'S');
      this.ops.push('q ' + ops.join(' ') + ' Q');
    }
  }

  /* Instagram glyph drawn as vectors */
  function instagramIcon(p, x, top, s, color) {
    p.rrect(x, top, s, s, s * 0.3, { stroke: color, lw: 1.3 });
    p.circle(x + s / 2, top + s / 2, s * 0.22, { stroke: color, lw: 1.3 });
    p.circle(x + s * 0.76, top + s * 0.24, s * 0.06, { fill: color });
  }

  /* ---------- layout ---------- */
  const two = n => String(n).padStart(2, '0');
  const fmtDate = (d, sep) => two(d.getDate()) + sep + two(d.getMonth() + 1) + sep + d.getFullYear();

  function layout(client, quote, date) {
    const pages = [new Page()]; let p = pages[0];
    const contentW = W - 2 * M;
    const colW = [128, 268, contentW - 128 - 268];
    const PAD = 14, LEAD = 13.5, TBL_SIZE = 9.6;
    const headerH = 34;

    /* header */
    const logoH = 44, logoW = logoH * ASSETS.logo.w / ASSETS.logo.h;
    let top = M;
    p.image('Im1', M, top, logoW, logoH);
    p.text(CFG.PDF.title, W - M, top + logoH / 2 + 7, 'bold', 19, C.accent, { align: 'right', tc: 0.6 });
    top += logoH + 14;
    p.line(M, top, W - M, top, C.line, 0.9);

    /* client block */
    top += 26;
    let nameSize = 26; const name = client.name.trim();
    while (nameSize > 14 && width('bold', name, nameSize) > contentW) nameSize -= 1;
    const nameLines = wrap('bold', name, nameSize, contentW);
    nameLines.forEach((l, i) => p.text(l, M, top + nameSize * 0.85 + i * nameSize * 1.15, 'bold', nameSize, C.ink));
    top += nameLines.length * nameSize * 1.15 + 6;
    p.text(`${client.phone.trim()}  |  ${fmtDate(date, '.')}`, M, top + 11, 'regular', 11.5, C.grey);
    top += 19;
    wrap('regular', client.city.trim(), 11.5, contentW).forEach(l => { p.text(l, M, top + 11, 'regular', 11.5, C.grey); top += 16; });
    top += 14;

    /* table */
    const BOTTOM = H - M - 24;
    let frameTop = top, firstRowOnPage = true;
    const drawHeader = () => {
      const base = top + headerH / 2 + 3.5;
      p.text('EVENTS', M + PAD, base, 'bold', 10, C.ink, { tc: 0.8 });
      p.text('SERVICES', M + colW[0] + PAD, base, 'bold', 10, C.accent, { tc: 0.8 });
      p.text('AMOUNT', M + contentW - PAD, base, 'bold', 10, C.ink, { align: 'right', tc: 0.8 });
      top += headerH; p.line(M, top, W - M, top, C.line, 0.9);
    };
    const closeFrame = () => {
      [M + colW[0], M + colW[0] + colW[1]].forEach(x => p.line(x, frameTop, x, top, C.line, 0.9));   // column dividers
      p.rrect(M, frameTop, contentW, top - frameTop, 12, { stroke: [0.84, 0.82, 0.79], lw: 1 });
    };
    const newPage = () => { pages.push(new Page()); p = pages[pages.length - 1]; top = M; };

    drawHeader();
    quote.lines.forEach(line => {
      const evLines = wrap('medium', line.name, 11, colW[0] - 2 * PAD);
      const svcLines = line.services.flatMap(s => wrap('regular', s, TBL_SIZE, colW[1] - 2 * PAD));
      const rows = Math.max(evLines.length, svcLines.length, 1);
      const rowH = rows * LEAD + 2 * 13;
      if (top + rowH > BOTTOM && !firstRowOnPage) {          // continue on a new page, header repeated
        closeFrame(); newPage(); frameTop = top; drawHeader(); firstRowOnPage = true;
      }
      if (!firstRowOnPage) p.line(M, top, W - M, top, C.line, 0.6);
      const base = top + 13 + 9.5;
      evLines.forEach((l, i) => p.text(l, M + PAD, base + i * LEAD, 'medium', 11, C.ink));
      svcLines.forEach((l, i) => p.text(l, M + colW[0] + PAD, base + i * LEAD, 'regular', TBL_SIZE, [0.35, 0.33, 0.31]));
      p.text('₹ ' + Pricing.formatINR(line.amount), M + contentW - PAD, base, 'medium', 11, C.ink, { align: 'right' });
      top += rowH; firstRowOnPage = false;
    });
    closeFrame();
    top += 18;

    /* total box */
    const totalH = 56;
    if (top + totalH > BOTTOM) { newPage(); }
    p.rrect(M, top, contentW, totalH, 12, { fill: C.box });
    p.text('TOTAL', M + 22, top + totalH / 2 + 5, 'bold', 14, C.ink, { tc: 1 });
    const totalStr = '₹' + Pricing.formatINR(quote.total);
    const tw = width('bold', totalStr, 19) + 36;
    p.rrect(W - M - 10 - tw, top + 9, tw, totalH - 18, 9, { fill: C.peach });
    p.text(totalStr, W - M - 10 - tw / 2, top + totalH / 2 + 7, 'bold', 19, C.accent, { align: 'center' });
    top += totalH + 26;

    /* terms & conditions */
    const FOOT_H = 58, footTop = H - M - FOOT_H;
    const tx = M + 190, tW = W - M - tx, T_SIZE = 8.8, T_LEAD = 12.2;
    const termLines = quote.terms.map(t => wrap('regular', t, T_SIZE, tW - 12));
    const termsH = termLines.reduce((n, l) => n + l.length * T_LEAD + 5, 0);
    if (top + Math.max(termsH, 30) > footTop - 18) { newPage(); }
    p.text('TERMS &', M, top + 10, 'bold', 12, C.ink, { tc: 0.6 });
    p.text('CONDITIONS', M, top + 25, 'bold', 12, C.ink, { tc: 0.6 });
    let ty = top;
    termLines.forEach(lines => {
      p.text('•', tx, ty + 8.5, 'regular', T_SIZE, C.accent);
      lines.forEach((l, i) => p.text(l, tx + 12, ty + 8.5 + i * T_LEAD, 'regular', T_SIZE, [0.35, 0.33, 0.31]));
      ty += lines.length * T_LEAD + 5;
    });

    /* footer band: bottom of the last page */
    p.rrect(M, footTop, contentW, FOOT_H, 12, { fill: C.box });
    p.text(CFG.PDF.thanks, M + 22, footTop + 25, 'bold', 14, C.ink);
    p.text(CFG.PDF.studio, M + 22, footTop + 42, 'regular', 10.5, C.grey);
    const ig = CFG.PDF.instagram, igW = width('medium', ig, 11);
    p.text(ig, W - M - 22, footTop + FOOT_H / 2 + 4, 'medium', 11, C.ink, { align: 'right' });
    instagramIcon(p, W - M - 22 - igW - 8 - 17, footTop + FOOT_H / 2 - 8.5, 17, C.accent);
    return pages;
  }

  /* ---------- PDF writer ---------- */
  function build({ client, quote, date = new Date() }) {
    const pages = layout(client, quote, date);
    const objs = []; const reserve = () => { objs.push(null); return objs.length; };
    const set = (n, dict, stream) => { objs[n - 1] = { dict, stream }; };
    const add = (dict, stream) => { const n = reserve(); set(n, dict, stream); return n; };

    const catalog = reserve(), pagesRoot = reserve();
    const fontRefs = {};
    for (const [key, res] of Object.entries(FONTS)) {
      const f = ASSETS.fonts[key];
      const file = add(`<< /Length1 ${f.len1} /Filter /FlateDecode`, b64bytes(f.b64));
      const desc = add(`<< /Type /FontDescriptor /FontName /Roboto${key} /Flags 32 /FontBBox [${f.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${f.ascent} /Descent ${f.descent} /CapHeight ${f.cap} /StemV 80 /FontFile2 ${file} 0 R >>`);
      const entries = Object.entries(f.glyphs).sort((a, b) => a[1][0] - b[1][0]);
      const wArr = entries.map(([, [gid, w]]) => `${gid} [${w}]`).join(' ');
      const cid = add(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Roboto${key} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${desc} 0 R /DW 600 /W [${wArr}] /CIDToGIDMap /Identity >>`);
      let cm = '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n';
      for (let i = 0; i < entries.length; i += 100) {
        const chunk = entries.slice(i, i + 100);
        cm += `${chunk.length} beginbfchar\n` + chunk.map(([cp, [gid]]) => `<${hex4(gid)}> <${hex4(+cp)}>`).join('\n') + '\nendbfchar\n';
      }
      cm += 'endcmap CMapName currentdict /CMap defineresource pop end end';
      const tu = add('<<', enc.encode(cm));
      fontRefs[res] = add(`<< /Type /Font /Subtype /Type0 /BaseFont /Roboto${key} /Encoding /Identity-H /DescendantFonts [${cid} 0 R] /ToUnicode ${tu} 0 R >>`);
    }
    const L = ASSETS.logo;
    const smask = add(`<< /Type /XObject /Subtype /Image /Width ${L.w} /Height ${L.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, b64bytes(L.alpha));
    const logo = add(`<< /Type /XObject /Subtype /Image /Width ${L.w} /Height ${L.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${smask} 0 R`, b64bytes(L.rgb));
    const resources = `<< /Font << ${Object.entries(fontRefs).map(([k, n]) => `/${k} ${n} 0 R`).join(' ')} >> /XObject << /Im1 ${logo} 0 R >> >>`;

    const pageRefs = pages.map(pg => {
      const content = add('<<', enc.encode(pg.ops.join('\n')));
      return add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${f2(W)} ${f2(H)}] /Resources ${resources} /Contents ${content} 0 R >>`);
    });
    set(pagesRoot, `<< /Type /Pages /Kids [${pageRefs.map(n => n + ' 0 R').join(' ')}] /Count ${pageRefs.length} >>`);
    const info = add(`<< /Title <FEFF${[...('Quotation - ' + client.name.trim())].map(ch => hex4(ch.charCodeAt(0))).join('')}> /Producer (Kartheek Photography Quotation Builder) >>`);
    set(catalog, `<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`);

    /* serialise */
    const parts = [enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')]; let offset = parts[0].length; const offsets = [];
    objs.forEach((o, i) => {
      offsets.push(offset);
      let bytes;
      if (o.stream) {
        const head = o.dict.endsWith('<<') ? `<< /Length ${o.stream.length} >>` : `${o.dict} /Length ${o.stream.length} >>`;
        bytes = concat([enc.encode(`${i + 1} 0 obj\n${head}\nstream\n`), o.stream, enc.encode('\nendstream\nendobj\n')]);
      } else bytes = enc.encode(`${i + 1} 0 obj\n${o.dict}\nendobj\n`);
      parts.push(bytes); offset += bytes.length;
    });
    let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    xref += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
    parts.push(enc.encode(xref));
    return concat(parts);
  }

  const api = { build, fmtDate, width, wrap };
  if (isNode) module.exports = api;
  root.QuotePDF = api;
})(typeof window !== 'undefined' ? window : globalThis);
