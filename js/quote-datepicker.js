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

  function renderCalendar() {
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
      `<button type="button" class="dptitle dp-title-button" data-act="jump" aria-label="Choose month and year">${MONTHS[m]} <span>${y}</span></button>` +
      `<button type="button" class="dpnav" data-nav="1" aria-label="Next month">&#8250;</button></div>` +
      `<div class="dpwk" aria-hidden="true">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(w => `<span>${w}</span>`).join('')}</div>` +
      `<div class="dpgrid">${cells}</div>` +
      `<div class="dpfoot"><button type="button" class="dplink" data-act="clear">Clear</button><button type="button" class="dplink" data-act="today">Today</button></div>`;
  }

  function renderJump() {
    const selected = input.value ? parse(input.value) : view;
    const y = selected.getFullYear(), m = selected.getMonth(), d = selected.getDate();
    const yearOptions = Array.from({length: 11}, (_, i) => today.getFullYear() + i)
      .map(v => `<option value="${v}"${v === y ? ' selected' : ''}>${v}</option>`).join('');
    const monthOptions = MONTHS.map((v, i) => `<option value="${i}"${i === m ? ' selected' : ''}>${v}</option>`).join('');
    const dayOptions = Array.from({length: 31}, (_, i) => i + 1)
      .map(v => `<option value="${v}"${v === d ? ' selected' : ''}>${v}</option>`).join('');
    pop.innerHTML =
      `<div class="dpjump-head"><span class="dpjump-kicker">JUMP TO DATE</span><button type="button" class="dplink" data-act="back">Back to calendar</button></div>` +
      `<div class="dpjump-grid">` +
      `<label class="dpjump-field"><span>Day</span><select id="dpJumpDay">${dayOptions}</select></label>` +
      `<label class="dpjump-field"><span>Month</span><select id="dpJumpMonth">${monthOptions}</select></label>` +
      `<label class="dpjump-field"><span>Year</span><select id="dpJumpYear">${yearOptions}</select></label>` +
      `</div><div class="dpjump-note">Choose a date, then apply to view the calendar.</div>` +
      `<div class="dpjump-actions"><button type="button" class="dplink" data-act="cancel-jump">Cancel</button><button type="button" class="dpapply" data-act="apply-jump">Apply</button></div>`;
  }
  function render() { renderCalendar(); }

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
    e.stopPropagation();
    const nav = e.target.closest('[data-nav]'), day = e.target.closest('.dpday'), act = e.target.closest('[data-act]');
    if (nav) {
      view = new Date(view.getFullYear(), view.getMonth() + +nav.dataset.nav, 1);
      renderCalendar();
    } else if (day) {
      setValue(day.dataset.v); close(true);
    } else if (act) {
      if (act.dataset.act === 'jump') renderJump();
      else if (act.dataset.act === 'back' || act.dataset.act === 'cancel-jump') renderCalendar();
      else if (act.dataset.act === 'apply-jump') {
        const dayValue = +pop.querySelector('#dpJumpDay').value;
        const monthValue = +pop.querySelector('#dpJumpMonth').value;
        const yearValue = +pop.querySelector('#dpJumpYear').value;
        const maxDay = new Date(yearValue, monthValue + 1, 0).getDate();
        const chosen = new Date(yearValue, monthValue, Math.min(dayValue, maxDay));
        if (iso(chosen) < minIso) chosen.setTime(today.getTime());
        view = new Date(chosen.getFullYear(), chosen.getMonth(), 1);
        setValue(iso(chosen)); renderCalendar(); close(true);
      } else {
        act.dataset.act === 'clear' ? setValue('') : setValue(minIso);
        close(true);
      }
    }
  });
  document.addEventListener('keydown', e => {
    if (pop.hidden) return;
    if (e.key === 'Escape') { e.stopPropagation(); close(true); }
  });
  document.addEventListener('click', e => { if (!pop.hidden && !e.target.closest('#dp')) close(false); });
  show();
  window.QuoteDatePickerReset = () => {
    input.value = '';
    show();
    close(false);
    view = new Date(today.getFullYear(), today.getMonth(), 1);
    render();
  };
})();
