/* =====================================================================
   fx.js — DECORATIVE MOTION ONLY.
   Scroll reveal, scroll progress line, cursor light, hero tilt and the
   viewfinder frame counter. It never touches the form, quote, gallery,
   films or any data. If this file is removed the site works the same.
   ===================================================================== */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;

  /* scroll progress + parallax variables (read by the CSS) */
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      const max = Math.max(1, root.scrollHeight - innerHeight);
      root.style.setProperty('--p', Math.min(1, y / max).toFixed(4));
      root.style.setProperty('--sy', y.toFixed(0));
      root.style.setProperty('--sp', Math.min(1, y / (innerHeight * 0.85)).toFixed(3));
      queued = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* scroll reveal */
  if (!reduce && 'IntersectionObserver' in window) {
    const groups = [
      '#work > h2, #work > p.sub, #work > .chips, #work > .rail',
      '#films .fcat > h2, #films .fcat > p.sub, #films .fcat > .rail',
      '#enquire .build-form, #enquire .tbox'
    ];
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.01, rootMargin: '0px' });

    groups.forEach(sel => {
      const items = [...document.querySelectorAll(sel)];
      items.forEach((el, i) => {
        el.classList.add('rv');
        el.style.setProperty('--d', Math.min(i, 4) * 0.09 + 's');
        io.observe(el);
      });
    });
    root.classList.add('fx-on');
  }

  /* soft light that follows the cursor (mouse only) */
  const glow = document.querySelector('.fx-glow');
  if (glow && fine && !reduce) {
    let tx = innerWidth / 2, ty = innerHeight / 3, x = tx, y = ty, run = false;
    const step = () => {
      x += (tx - x) * 0.09; y += (ty - y) * 0.09;
      glow.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      if (Math.abs(tx - x) > 0.4 || Math.abs(ty - y) > 0.4) requestAnimationFrame(step); else run = false;
    };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY; glow.classList.add('on');
      if (!run) { run = true; requestAnimationFrame(step); }
    }, { passive: true });
  }

  /* hero carousel: gentle 3D tilt */
  const hero = document.getElementById('heroCar');
  if (hero) {
    if (fine && !reduce) {
      hero.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const r = hero.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        hero.style.setProperty('--ry', (px * 6).toFixed(2) + 'deg');
        hero.style.setProperty('--rx', (-py * 4).toFixed(2) + 'deg');
      }, { passive: true });
      hero.addEventListener('pointerleave', () => {
        hero.style.setProperty('--ry', '0deg');
        hero.style.setProperty('--rx', '0deg');
      });
    }
  }
})();
