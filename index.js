/* The front page: the knob row and the entrances. No firmware here; the demo page has it. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  const row = $('#moments'), prog = $('#row-progress');

  function rowProgress(r, p) { const f = () => { const max = r.scrollWidth - r.clientWidth; p.style.width = (max > 0 ? 20 + 80 * r.scrollLeft / max : 100) + '%'; }; r.addEventListener('scroll', f, { passive: true }); f(); window.addEventListener('resize', f); }
  function updateProgress() { const max = row.scrollWidth - row.clientWidth; prog.style.width = (max > 0 ? 20 + 80 * row.scrollLeft / max : 100) + '%'; }
  row.addEventListener('scroll', updateProgress, { passive: true }); updateProgress(); window.addEventListener('resize', updateProgress);
  // Grab a row with the mouse and throw it: it coasts and slows down. Touch
  // keeps the browser's own swipe. Snap is off while the mouse has it.
  function grabRow(row) {
    let grab = null, vel = 0, coast = null;
    row.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      cancelAnimationFrame(coast); grab = { x: e.clientX, left: row.scrollLeft, t: performance.now(), moved: false }; vel = 0;
      row.classList.add('grabbing'); grab.id = e.pointerId;
    });
    row.addEventListener('pointermove', (e) => {
      if (!grab) return;
      const dx = e.clientX - grab.x, now = performance.now();
      if (Math.abs(dx) > 4 && !grab.moved) { grab.moved = true; try { row.setPointerCapture(grab.id); } catch (_) {} }
      const left = grab.left - dx; vel = (left - row.scrollLeft) / Math.max(1, now - grab.t); grab.t = now;
      row.scrollLeft = left;
    });
    const letGo = () => {
      if (!grab) return;
      const moved = grab.moved; grab = null; row.classList.remove('grabbing');
      let v = vel * 16;                                      // px per frame
      const step = () => { if (Math.abs(v) < 0.5) { row.classList.remove('thrown'); return; } row.scrollLeft += v; v *= 0.94; coast = requestAnimationFrame(step); };
      if (moved) { row.classList.add('thrown'); coast = requestAnimationFrame(step); }
    };
    row.addEventListener('pointerup', letGo); row.addEventListener('pointercancel', letGo);
    row.addEventListener('click', (e) => { if (row.classList.contains('thrown')) e.preventDefault(); }, true);
    row.addEventListener('dragstart', (e) => e.preventDefault());
  }
  grabRow(row);
  rowProgress($('#phones'), $('#phone-progress')); grabRow($('#phones'));
  if ($('#rt-row')) grabRow($('#rt-row'));
  if ($('#boost-row')) grabRow($('#boost-row'));
  if ($('#known-row')) grabRow($('#known-row'));
  $$('.row').forEach(el => { el.classList.add('in'); });

  // "Does it fit my truck?" points at the footer, which is pinned under the page
  // like a curtain, so a plain anchor jump goes nowhere: scroll to the end instead.
  $$('a[href="#fits"]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('fits').scrollIntoView({ behavior: 'smooth' }); }));

  // Want one: the short form posts to a small Google Apps Script in Derek's
  // Workspace (a row in the OVERCLOCK interest sheet, an email to hello@).
  // The script answers from another origin without CORS headers, so the post
  // is sent "no-cors": the browser cannot read the reply, only whether the
  // request itself went out. If it did not, the person is pointed at email.
  const form = $('#want-form'), say = $('#form-say');
  form.t0.value = Date.now();                        // page load time; the script drops anything sent under 3 s later
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim(), truck = form.truck.value.trim();
    say.classList.remove('bad');
    if (!email || !/.+@.+\..+/.test(email)) { say.textContent = 'An email address, so we can reply.'; say.classList.add('bad'); form.email.focus(); return; }
    if (!truck) { say.textContent = 'What do you drive? Year and model.'; say.classList.add('bad'); form.truck.focus(); return; }
    say.textContent = 'Sending...';
    const btn = form.querySelector('button'); btn.disabled = true;
    try {
      // The sheet script reads email, truck and notes; the answer rides in notes.
      form.t1.value = Date.now();
      const fd = new FormData(form), src = fd.get('source');
      if (src) fd.set('notes', ('Heard about us: ' + src + '\n' + (fd.get('notes') || '')).trim());
      await fetch(form.action, { method: 'POST', mode: 'no-cors', body: fd });
      say.textContent = "Got it. You'll hear back from us personally."; form.reset(); form.t0.value = Date.now();
    } catch (err) { say.textContent = 'That did not go through. Email hello@overclockdash.com instead.'; say.classList.add('bad'); }
    btn.disabled = false;
  });

  // every screen is in the row from the start; there is no More screens button any more

  // Back and Forward move one card, whatever size the cards are at this width.
  $$('.row-btns button').forEach(b => b.addEventListener('click', () => {
    const m = row.querySelector('.moment'), gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    row.scrollBy({ left: ((m ? m.getBoundingClientRect().width : 280) + gap) * +b.dataset.step, behavior: 'smooth' });
  }));

  // Where you are in each card row, as "3 / 26" under it: the first card mostly in
  // view, and the last number once the row reaches its end.
  $$('.row-wrap > .row').forEach(r => {
    const cards = Array.from(r.children).filter(c => c.classList.contains('moment') && getComputedStyle(c).display !== 'none');
    if (cards.length < 2) return;
    const out = document.createElement('span');
    out.className = 'row-count'; out.setAttribute('aria-hidden', 'true');
    r.after(out);
    const f = () => {
      const rr = r.getBoundingClientRect(), edge = rr.left + (parseFloat(getComputedStyle(r).paddingLeft) || 0);
      let i = cards.findIndex(c => { const cr = c.getBoundingClientRect(); return cr.left + cr.width / 2 > edge; });
      if (i < 0 || r.scrollLeft >= r.scrollWidth - r.clientWidth - 2) i = cards.length - 1;
      out.textContent = (i + 1) + ' / ' + cards.length;
    };
    r.addEventListener('scroll', f, { passive: true }); window.addEventListener('resize', f); f();
  });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: 0.2 });
  $$('.in').forEach(el => io.observe(el));
  $$('.row').forEach(el => { el.classList.add('in'); io.observe(el); });


  // The clips below the top load only when you scroll near them, and pause when
  // they leave the screen, so a first visit does not pull every video at once.
  // The top clip still plays straight away.
  const clips = $$('video[data-play]');
  if ('IntersectionObserver' in window) {
    const vo = new IntersectionObserver(es => es.forEach(e => {
      const v = e.target;
      if (e.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      else if (!v.paused) v.pause();
    }), { rootMargin: '300px 0px' });
    clips.forEach(v => vo.observe(v));
  } else {
    clips.forEach(v => { v.preload = 'auto'; v.autoplay = true; v.play(); });
  }

})();

