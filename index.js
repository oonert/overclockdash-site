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
      row.classList.add('grabbing'); row.setPointerCapture(e.pointerId);
    });
    row.addEventListener('pointermove', (e) => {
      if (!grab) return;
      const dx = e.clientX - grab.x, now = performance.now();
      if (Math.abs(dx) > 4) grab.moved = true;
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
  $$('.row').forEach(el => { el.classList.add('in'); });

  // "Does it fit my truck?" points at the footer, which is pinned under the page
  // like a curtain, so a plain anchor jump goes nowhere: scroll to the end instead.
  $$('a[href="#fits"]').forEach(a => a.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }); }));

  // Want one: the short form posts to a small Google Apps Script in Derek's
  // Workspace (a row in the OVERCLOCK interest sheet, an email to hello@).
  // The script answers from another origin without CORS headers, so the post
  // is sent "no-cors": the browser cannot read the reply, only whether the
  // request itself went out. If it did not, the person is pointed at email.
  const form = $('#want-form'), say = $('#form-say');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim(), truck = form.truck.value.trim();
    say.classList.remove('bad');
    if (!email || !/.+@.+\..+/.test(email)) { say.textContent = 'An email address, so we can reply.'; say.classList.add('bad'); form.email.focus(); return; }
    if (!truck) { say.textContent = 'What do you drive? Year and model.'; say.classList.add('bad'); form.truck.focus(); return; }
    say.textContent = 'Sending...';
    const btn = form.querySelector('button'); btn.disabled = true;
    try {
      await fetch(form.action, { method: 'POST', mode: 'no-cors', body: new FormData(form) });
      say.textContent = "Got it. You'll hear back from us personally."; form.reset();
    } catch (err) { say.textContent = 'That did not go through. Email hello@overclockdash.com instead.'; say.classList.add('bad'); }
    btn.disabled = false;
  });

  const more = $('#more-screens');
  more.addEventListener('click', () => { row.classList.add('all'); more.parentElement.style.display = 'none'; updateProgress(); row.scrollBy({ left: 312, behavior: 'smooth' }); });

  $$('.row-btns button').forEach(b => b.addEventListener('click', () => row.scrollBy({ left: 312 * +b.dataset.step, behavior: 'smooth' })));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: 0.2 });
  $$('.in').forEach(el => io.observe(el));
  $$('.row').forEach(el => { el.classList.add('in'); io.observe(el); });

})();
