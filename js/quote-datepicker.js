/* =========================================================
   DATE PICKER: a themed calendar for the event date.
   Writes the chosen day (YYYY-MM-DD) into the hidden #date input
   and fires a bubbling "change" event so the form keeps working.
   Past days are disabled. On phones it opens as a bottom sheet.
   ========================================================= */
(function () {
  const input = document.getElementById('date'), btn = document.getElementById('dateBtn'), txt = document.getElementById('dateText');
  const pop = document.getElementById('dpop'), back = document.getElementById('dpback');
  if (!input || !btn || !pop) return;

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const minIso = iso(today);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);

  const label = s => parse(s).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  function show() {
    txt.textContent = input.value ? label(input.value) : 'Select a date';
    txt.classList.toggle('dpph', !input.value);
  }
  function setValue(v) {
    input.value = v; show();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function render() {
    const y = view.getFullYear(), m = view.getMonth();
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const atMin = y === today.getFullYear() && m === today.getMonth();
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const v = iso(new Date(y, m, d)), past = v < minIso;
      cells += `<button type="button" class="dpday${v === minIso ? ' today' : ''}${v === input.value ? ' on' : ''}" data-v="${v}"${past ? ' disabled' : ''} aria-label="${label(v)}"${v === input.value ? ' aria-pressed="true"' : ''}>${d}</button>`;
    }
    pop.innerHTML =
      `<div class="dphead"><button type="button" class="dpnav" data-nav="-1" aria-label="Previous month"${atMin ? ' disabled' : ''}>&#8249;</button>` +
      `<div class="dptitle" aria-live="polite">${MONTHS[m]} <span>${y}</span></div>` +
      `<button type="button" class="dpnav" data-nav="1" aria-label="Next month">&#8250;</button></div>` +
      `<div class="dpwk" aria-hidden="true">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(w => `<span>${w}</span>`).join('')}</div>` +
      `<div class="dpgrid">${cells}</div>` +
      `<div class="dpfoot"><button type="button" class="dplink" data-act="clear">Clear</button><button type="button" class="dplink" data-act="today">Today</button></div>`;
  }

  function open() {
    view = input.value ? new Date(parse(input.value).getFullYear(), parse(input.value).getMonth(), 1) : new Date(today.getFullYear(), today.getMonth(), 1);
    render(); pop.hidden = false; back.hidden = false; btn.setAttribute('aria-expanded', 'true');
    const sel = pop.querySelector('.dpday.on') || pop.querySelector('.dpday.today') || pop.querySelector('.dpday:not(:disabled)');
    if (sel) sel.focus({ preventScroll: true });
    if (matchMedia('(max-width:600px)').matches) document.documentElement.style.overflow = 'hidden';
  }
  function close(focusBtn) {
    pop.hidden = true; back.hidden = true; btn.setAttribute('aria-expanded', 'false');
    document.documentElement.style.overflow = '';
    if (focusBtn) btn.focus({ preventScroll: true });
  }

  btn.addEventListener('click', () => (pop.hidden ? open() : close(true)));
  back.addEventListener('click', () => close(true));
  pop.addEventListener('click', e => {
    e.stopPropagation();   // the re-drawn buttons would otherwise look like an outside click
    const nav = e.target.closest('[data-nav]'), day = e.target.closest('.dpday'), act = e.target.closest('[data-act]');
    if (nav) { view = new Date(view.getFullYear(), view.getMonth() + +nav.dataset.nav, 1); render(); const n = pop.querySelector(`[data-nav="${nav.dataset.nav}"]:not(:disabled)`); if (n) n.focus({ preventScroll: true }); }
    else if (day) { setValue(day.dataset.v); close(true); }
    else if (act) { act.dataset.act === 'clear' ? setValue('') : setValue(minIso); close(true); }
  });
  document.addEventListener('keydown', e => {
    if (pop.hidden) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(true); }
  });
  document.addEventListener('click', e => { if (!pop.hidden && !e.target.closest('#dp')) close(false); });
  show();
})();
