/* The front page: the knob row and the entrances. No firmware here; the demo page has it. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  const row = $('#moments'), prog = $('#row-progress');
  function updateProgress() { const max = row.scrollWidth - row.clientWidth; prog.style.width = (max > 0 ? 20 + 80 * row.scrollLeft / max : 100) + '%'; }
  row.addEventListener('scroll', updateProgress, { passive: true }); updateProgress(); window.addEventListener('resize', updateProgress);
  $$('.row-btns button').forEach(b => b.addEventListener('click', () => row.scrollBy({ left: 312 * +b.dataset.step, behavior: 'smooth' })));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: 0.2 });
  $$('.in').forEach(el => io.observe(el));
  $$('.row').forEach(el => { el.classList.add('in'); io.observe(el); });

  // ── the hero: the real firmware takes over from the recording ────────────
  // Boots straight into the digital face with the four widgets (rpm, date,
  // speed, coolant), then swings between the retro face and that one until
  // the visitor touches it; from then on it is theirs.
  const wrap = $('#hero-clock'), status = $('#status');
  if (window.OverclockClock) (async () => {
    try {
      const clock = await OverclockClock.mount($('#clock'), {
        frame: '4runner', frameWidth: wrap.clientWidth, base: 'dist/', dial: false, storage: null, alerts: { storm: false },
        settings: { clk_face: 0, clk_24h: 0, clk_page: 2, clk_color: 0x8FE0, clk_slots: [21, 1, 7, 16, 11, 12, 7, 8] },
      });
      let auto = true, retro = false;
      const swing = () => { if (!auto) return; retro = !retro; clock.goto(retro ? 'Retro' : 'Clock'); };
      setTimeout(() => { wrap.classList.add('live'); status.textContent = 'Live: the real firmware. Scroll on it to turn the knob, tap to click, hold to hold.'; }, 14000);
      let timer = setInterval(swing, 7000);
      const stop = () => { if (!auto) return; auto = false; clearInterval(timer); status.textContent = 'It is yours now. Scroll on it to turn the knob, tap to click, hold to hold. The full demo has every control.'; };
      clock.canvas.addEventListener('pointerdown', stop); clock.canvas.addEventListener('wheel', stop, { passive: true }); clock.canvas.addEventListener('keydown', stop);
    } catch (e) { status.textContent = 'This is a recording; the live firmware could not load here.'; console.error(e); }
  })(); else status.textContent = 'A recording of the real firmware.';
})();
