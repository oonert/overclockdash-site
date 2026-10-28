/* overclockdash.com: the clock, the knob row, the faults, the truck, the mini clock. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  // ── the clock ─────────────────────────────────────────────────────────────
  let clock = null, currentCase = '4runner';
  const status = $('#status');
  function frameWidth() { return Math.min(600, window.innerWidth - 2 * 16); }
  async function mountClock(which) {
    currentCase = which;
    $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.case === which)));
    if (clock) { clock.destroy(); clock = null; }
    status.textContent = 'Loading the firmware (about 4 MB)...';
    try {
      clock = await OverclockClock.mount($('#clock'), { frame: which, frameWidth: frameWidth(), base: 'dist/', alerts: { storm: false } });
      status.innerHTML = 'Firmware <b>' + clock.version + '</b> is running. Scroll on the screen to turn, tap to click, hold to hold.';
      $('#fw').textContent = clock.version;
      buildDeck();
    } catch (e) {
      status.textContent = 'The firmware could not load. ' + (e && e.message ? e.message : '');
      console.error(e);
    }
  }
  $$('.tabs [role=tab]').forEach(b => b.addEventListener('click', () => { if (b.dataset.case !== currentCase) mountClock(b.dataset.case); }));
  mountClock(new URLSearchParams(location.search).get('v') === 'tacoma' ? 'tacoma' : '4runner');
  $('#focus-clock').addEventListener('click', () => { setTimeout(() => clock && clock.canvas.focus(), 400); });

  // ── the knob row: progress bar and the two buttons ────────────────────────
  const row = $('#moments'), prog = $('#row-progress');
  function updateProgress() { const max = row.scrollWidth - row.clientWidth; prog.style.width = (max > 0 ? 20 + 80 * row.scrollLeft / max : 100) + '%'; }
  row.addEventListener('scroll', updateProgress, { passive: true }); updateProgress(); window.addEventListener('resize', updateProgress);
  $$('.row-btns button').forEach(b => b.addEventListener('click', () => row.scrollBy({ left: 312 * +b.dataset.step, behavior: 'smooth' })));

  // ── the faults: a deck built from what the firmware offers ────────────────
  const NAMES = {
    overheat: ['Overheat', 'Coolant climbs past the warning line. The OVERHEAT takeover comes up and stays until the engine cools or you snooze it.'],
    nocharge: ['No charge', 'Volts fall as if the alternator quit. The low-voltage alert and the battery page react.'],
    overvolt: ['Overvolt', 'Volts rise past the chemistry’s limit, the regulator-failed case. A red alert.'],
    checkengine: ['Check engine', 'The engine computer reports a trouble code. STOP SOON, the code and its meaning, with VIEW and SNOOZE.'],
    misfire: ['Misfire', 'A pending misfire code appears, the way a real ECU reports it before the lamp.'],
    threecodes: ['Three codes', 'Three stored codes at once. The codes page lists them with their plain-English meanings.'],
    loselink: ['Lose link', 'The OBD dongle goes silent for half a minute. Watch the link indicator and the fallback behaviour.'],
    engineok: ['Engine OK', 'Clears every code and the story behind it. Readiness climbs back like a real ECU after a clear.'],
    fridgewarm: ['Fridge warm', 'The fridge probe drifts above the warm line. A useful-tier notice, not a takeover.'],
    fridgecold: ['Fridge cold', 'The fridge drops below freezing. Spoiled lettuce, in the firmware’s eyes.'],
    freezerthaw: ['Freezer thaw', 'The freezer warms past thawing. Red, because the food is going.'],
    towing: ['Towing climb', 'A loaded climb: transmission fluid heats toward its ceiling and the TOWING page tracks it.'],
    lowoil: ['Low oil pressure', 'Oil pressure falls away with the engine running. The one alert that says stop the engine now.'],
  };
  const deck = $('#deck');
  function buildDeck() {
    deck.innerHTML = '';
    clock.events.forEach(ev => {
      const n = NAMES[ev] || [ev, ''];
      const card = document.createElement('article'); card.className = 'fault'; card.dataset.event = ev;
      card.innerHTML = '<h3>' + n[0] + '</h3><p>' + n[1] + '</p><div class="foot"><span>demo event</span><button class="btn" type="button">Start</button></div>';
      card.querySelector('button').addEventListener('click', () => { clock.event(ev); markRunning(); if (window.innerWidth <= 900) showMini(true); });
      deck.appendChild(card);
    });
    markRunning();
  }
  function markRunning() {
    const r = clock ? clock.eventRunning() : null;
    $$('.fault').forEach(c => c.classList.toggle('running', c.dataset.event === r));
    $('#fault-now').textContent = r ? 'Running: ' + (NAMES[r] ? NAMES[r][0] : r) + '. Watch the clock.' : 'Nothing running.';
  }
  setInterval(markRunning, 1500);
  $('#stop-fault').addEventListener('click', () => { if (clock) clock.event('stop'); markRunning(); });

  // ── the truck ──────────────────────────────────────────────────────────────
  const box = $('#truck3d');
  let pitch = 0, roll = 0, target = { pitch: 0, roll: 0 }, LIMIT = 35;
  function setTilt(p, r) { target.pitch = Math.max(-LIMIT, Math.min(LIMIT, p)); target.roll = Math.max(-LIMIT, Math.min(LIMIT, r)); }
  if (window.THREE) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(6.5, 4.4, 7.5); camera.lookAt(0, 0.6, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    box.insertBefore(renderer.domElement, box.firstChild);
    function size() { const w = box.clientWidth || 320; renderer.setSize(w, w, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = 1; camera.updateProjectionMatrix(); }
    size(); new ResizeObserver(size).observe(box);
    scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x202428, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.1); sun.position.set(5, 9, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -6; sun.shadow.camera.right = sun.shadow.camera.top = 6;
    scene.add(sun);
    const rig = new THREE.Group(); scene.add(rig);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(7, 0.18, 4.4), new THREE.MeshStandardMaterial({ color: 0x5b5346, roughness: 1 }));
    slab.position.y = -0.09; slab.receiveShadow = true; rig.add(slab);
    const grid = new THREE.GridHelper(7, 14, 0x8a7f6a, 0x6e6555); grid.position.y = 0.001; rig.add(grid);
    const truck = new THREE.Group(); rig.add(truck);
    const paint = new THREE.MeshStandardMaterial({ color: 0xb8352a, roughness: 0.55, metalness: 0.15 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.9 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fc6d9, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.75 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 1 });
    const rim = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.7 });
    const lamp = (c, e) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.6 });
    function part(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; truck.add(m); return m; }
    part(new THREE.BoxGeometry(4.2, 0.55, 1.9), dark, 0, 0.75, 0);
    part(new THREE.BoxGeometry(1.7, 0.75, 1.95), paint, 1.2, 1.35, 0);
    part(new THREE.BoxGeometry(2.0, 1.15, 1.95), paint, -0.9, 1.55, 0);
    part(new THREE.BoxGeometry(1.1, 0.7, 1.75), glass, -0.25, 1.85, 0);
    part(new THREE.BoxGeometry(0.5, 0.9, 1.95), paint, -1.95, 1.4, 0);
    part(new THREE.BoxGeometry(0.25, 0.1, 1.5), dark, -0.3, 2.18, 0);
    part(new THREE.BoxGeometry(0.25, 0.1, 1.5), dark, -1.2, 2.18, 0);
    part(new THREE.BoxGeometry(0.15, 0.18, 0.35), lamp(0xfff1b0, 0xffe08a), 2.06, 1.3, 0.7);
    part(new THREE.BoxGeometry(0.15, 0.18, 0.35), lamp(0xfff1b0, 0xffe08a), 2.06, 1.3, -0.7);
    part(new THREE.BoxGeometry(0.12, 0.2, 0.3), lamp(0xff3b2e, 0xc01810), -2.21, 1.3, 0.7);
    part(new THREE.BoxGeometry(0.12, 0.2, 0.3), lamp(0xff3b2e, 0xc01810), -2.21, 1.3, -0.7);
    for (const [x, z] of [[1.35, 1.0], [1.35, -1.0], [-1.35, 1.0], [-1.35, -1.0]]) {
      part(new THREE.CylinderGeometry(0.48, 0.48, 0.36, 24), rubber, x, 0.48, z).rotation.x = Math.PI / 2;
      part(new THREE.CylinderGeometry(0.26, 0.26, 0.38, 12), rim, x, 0.48, z).rotation.x = Math.PI / 2;
    }
    let drag = null;
    box.addEventListener('pointerdown', e => { box.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, p: target.pitch, r: target.roll }; box.classList.add('grabbing'); e.preventDefault(); });
    box.addEventListener('pointermove', e => { if (!drag) return; setTilt(drag.p + (drag.y - e.clientY) * 0.25, drag.r + (e.clientX - drag.x) * 0.25); clearPresets(); });
    const drop = () => { drag = null; box.classList.remove('grabbing'); };
    box.addEventListener('pointerup', drop); box.addEventListener('pointercancel', drop);
    const readout = $('#readout');
    let lastSent = '', visible = true;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }).observe(box);
    (function frame() {
      requestAnimationFrame(frame);
      if (!visible && Math.abs(target.pitch - pitch) < 0.05 && Math.abs(target.roll - roll) < 0.05) return;
      pitch += (target.pitch - pitch) * 0.15; roll += (target.roll - roll) * 0.15;
      rig.rotation.set(-roll * Math.PI / 180, 0, pitch * Math.PI / 180);
      renderer.render(scene, camera);
      const key = pitch.toFixed(1) + ',' + roll.toFixed(1);
      if (key !== lastSent) { lastSent = key; if (clock) clock.tilt(pitch, roll); readout.textContent = 'pitch ' + (pitch >= 0 ? '+' : '') + pitch.toFixed(1) + '°   roll ' + (roll >= 0 ? '+' : '') + roll.toFixed(1) + '°'; }
    })();
  } else {
    box.innerHTML = '<p style="padding:24px">The 3D truck needs WebGL. Use the preset buttons to tip the clock instead.</p>';
  }
  function clearPresets() { $$('.presets button').forEach(b => b.setAttribute('aria-pressed', 'false')); }
  $$('.presets button').forEach(b => b.addEventListener('click', () => { const [p, r] = b.dataset.tilt.split(',').map(Number); setTilt(p, r); clearPresets(); b.setAttribute('aria-pressed', 'true'); if (clock) clock.goto('Level'); if (window.innerWidth <= 900) showMini(true); }));
  $('#level-truck').addEventListener('click', () => { setTilt(0, 0); clearPresets(); $('.presets button').setAttribute('aria-pressed', 'true'); });
  $('#show-tilt').addEventListener('click', () => { if (clock) clock.goto('Level'); $('#clock').scrollIntoView({ behavior: 'smooth', block: 'center' }); });

  // ── the clock follows you on a phone: a live mirror, bottom right ────────
  const mini = $('#mini'), miniCanvas = $('#mini-canvas'), ctx = miniCanvas.getContext('2d');
  let miniOn = false, heroVisible = true;
  function showMini(on) { miniOn = on && !heroVisible; mini.classList.toggle('on', miniOn); }
  new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; showMini(!heroVisible); }, { threshold: 0.15 }).observe($('#clock'));
  mini.addEventListener('click', () => $('#clock').scrollIntoView({ behavior: 'smooth', block: 'center' }));
  (function mirror() {
    requestAnimationFrame(mirror);
    if (!miniOn || !clock || window.innerWidth > 900) return;
    const c = clock.canvas; if (miniCanvas.width !== c.width) { miniCanvas.width = c.width; miniCanvas.height = c.height; }
    ctx.drawImage(c, 0, 0);
  })();

  // ── entrances ──────────────────────────────────────────────────────────────
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: 0.2 });
  $$('.in').forEach(el => io.observe(el));
  // a section's cards enter one by one too
  $$('.deck, .row').forEach(el => { el.classList.add('in'); io.observe(el); });
  new MutationObserver(() => { const d = $('#deck'); if (d.children.length && !d.classList.contains('seen')) io.observe(d); }).observe($('#deck'), { childList: true });
})();
