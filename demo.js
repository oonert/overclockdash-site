/* The demo page: the clock, and every control beside it. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const phone = () => window.innerWidth <= 900;

  // ── the clock ─────────────────────────────────────────────────────────────
  let clock = null, currentCase = '4runner';
  const FW_STAMP = '2026-10-28b';   // bump when dist/ is rebuilt, so browsers fetch the new firmware
  const status = $('#status');
  function frameWidth() { return phone() ? Math.round((window.innerWidth - 24) * 0.8) : Math.min(560, Math.round(window.innerWidth * 0.42)); }
  async function mountClock(which) {
    currentCase = which;
    $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.case === which)));
    if (clock) { clock.destroy(); clock = null; }
    status.textContent = 'Loading the firmware (about 4 MB)...';
    try {
      clock = await OverclockClock.mount($('#clock'), { frame: which, frameWidth: frameWidth(), base: 'dist/', v: FW_STAMP, dial: false, alerts: { storm: false }, settings: { clk_face: 0, clk_24h: 0, clk_page: 2, clk_color: 0x8FE0, clk_slots: [21, 1, 7, 16, 11, 12, 7, 8] } });
      status.textContent = ''; showHint();
      $('#fw').textContent = clock.version;
      buildFaults(); markRunning();
    } catch (e) { status.textContent = 'The firmware could not load. ' + (e && e.message ? e.message : ''); console.error(e); }
  }
  $$('.tabs [role=tab]').forEach(b => b.addEventListener('click', () => { if (b.dataset.case !== currentCase) mountClock(b.dataset.case); }));
  mountClock(new URLSearchParams(location.search).get('v') === 'tacoma' ? 'tacoma' : '4runner');

  // ── the hint: how to work the knob, gone after the first turn or click (or 12 s)
  const hint = $('#hint'); let hintTimer = null;
  function hideHint() { if (!hint.hidden) hint.classList.add('gone'); clearTimeout(hintTimer); }
  function showHint() { hint.hidden = false; hint.classList.remove('gone'); clearTimeout(hintTimer); hintTimer = setTimeout(hideHint, 12000); }
  const stage = $('.stage');
  stage.addEventListener('wheel', hideHint, { passive: true }); stage.addEventListener('pointerdown', (e) => { if (e.target.closest('#clock, #jog')) hideHint(); });
  document.addEventListener('keydown', (e) => { if (/^Arrow| |Enter/.test(e.key)) hideHint(); });

  // ── the jog wheel: an iPod-style ring for a thumb, a button in the middle ──
  const ring = $('#jog-ring'), ticks = $('#jog-ticks'), jbtn = $('#jog-btn');
  for (let i = 0; i < 36; i++) { const t = document.createElement('i'); t.style.transform = 'rotate(' + (i * 10) + 'deg)'; ticks.appendChild(t); }
  const DETENT = 18;                         // degrees of thumb travel per click of the knob
  let rot = 0, last = null, carry = 0, pid = null;
  function buzz() { if (navigator.vibrate) navigator.vibrate(8); }
  function angleAt(e) { const r = ring.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; }
  function spin(deg) { rot += deg; ticks.style.transform = 'rotate(' + rot + 'deg)'; }
  ring.addEventListener('pointerdown', (e) => { pid = e.pointerId; ring.setPointerCapture(pid); last = angleAt(e); carry = 0; ring.classList.add('grabbing'); ring.focus(); e.preventDefault(); });
  ring.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid || last === null) return;
    const a = angleAt(e); let d = a - last; if (d > 180) d -= 360; if (d < -180) d += 360; last = a;
    spin(d); carry += d;
    while (carry >= DETENT) { carry -= DETENT; if (clock) clock.turn(1); buzz(); }
    while (carry <= -DETENT) { carry += DETENT; if (clock) clock.turn(-1); buzz(); }
  });
  const ringUp = (e) => { if (e.pointerId !== pid) return; pid = null; last = null; ring.classList.remove('grabbing'); };
  ring.addEventListener('pointerup', ringUp); ring.addEventListener('pointercancel', ringUp);
  ring.addEventListener('wheel', (e) => { if (!clock) return; const n = e.deltaY > 0 ? 1 : -1; clock.turn(n); spin(n * DETENT); e.preventDefault(); }, { passive: false });
  ring.addEventListener('keydown', (e) => { if (!clock) return; if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { clock.turn(1); spin(DETENT); e.preventDefault(); } if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { clock.turn(-1); spin(-DETENT); e.preventDefault(); } });
  // The middle: press is the real button, so a tap clicks and a long press holds.
  let bpid = null, heldTimer = null;
  jbtn.addEventListener('pointerdown', (e) => { if (!clock) return; bpid = e.pointerId; jbtn.setPointerCapture(bpid); jbtn.classList.add('down'); clock.press(true); buzz(); heldTimer = setTimeout(() => jbtn.classList.add('held'), 600); e.preventDefault(); });
  const btnUp = (e) => { if (e.pointerId !== bpid) return; bpid = null; clearTimeout(heldTimer); jbtn.classList.remove('down', 'held'); if (clock) clock.press(false); };
  jbtn.addEventListener('pointerup', btnUp); jbtn.addEventListener('pointercancel', btnUp);
  jbtn.addEventListener('click', (e) => e.preventDefault());
  jbtn.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && clock) { clock.press(true); jbtn.classList.add('down'); e.preventDefault(); } });
  jbtn.addEventListener('keyup', (e) => { if ((e.key === ' ' || e.key === 'Enter') && clock) { clock.press(false); jbtn.classList.remove('down'); e.preventDefault(); } });
  jbtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // ── the knob buttons ──────────────────────────────────────────────────────
  $$('[data-knob]').forEach(b => b.addEventListener('click', () => {
    if (!clock) return;
    const [what, n] = b.dataset.knob.split(':');
    if (what === 'turn') clock.turn(+n); else if (what === 'click') clock.click(); else if (what === 'hold') clock.hold(1100);
  }));

  // ── the pages ─────────────────────────────────────────────────────────────
  const PAGES = [['Clock', 'Clock'], ['Gauges', 'Gauges'], ['Temp', 'Temp'], ['Speed', 'Speed'], ['Weather', 'Weather'], ['Solar', 'Solar'], ['Voltage', 'Voltage'], ['Level', 'Tilt'], ['Health', 'Health'], ['Trips', 'Trips'], ['Fuel', 'Fuel'], ['Towing', 'Towing'], ['Obd', 'Codes'], ['Records', 'Records'], ['Apps', 'Apps'], ['Settings', 'Settings']];
  const pc = $('#page-chips');
  PAGES.forEach(([name, label]) => { const b = document.createElement('button'); b.className = 'btn ghost'; b.type = 'button'; b.textContent = label; b.addEventListener('click', () => clock && clock.goto(name)); pc.appendChild(b); });

  // ── the faults ────────────────────────────────────────────────────────────
  const NAMES = { overheat: 'Overheat', nocharge: 'No charge', overvolt: 'Overvolt', checkengine: 'Check engine', misfire: 'Misfire', threecodes: 'Three codes', loselink: 'Lose link', engineok: 'Engine OK (clear)', fridgewarm: 'Fridge warm', fridgecold: 'Fridge cold', freezerthaw: 'Freezer thaw', towing: 'Towing climb', lowoil: 'Low oil pressure' };
  const fc = $('#fault-chips');
  function buildFaults() {
    fc.innerHTML = '';
    clock.events.forEach(ev => { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.dataset.event = ev; b.textContent = NAMES[ev] || ev; b.addEventListener('click', () => { clock.event(ev); markRunning(); }); fc.appendChild(b); });
  }
  function markRunning() {
    const r = clock ? clock.eventRunning() : null;
    $$('#fault-chips .btn').forEach(b => b.classList.toggle('running', b.dataset.event === r));
    $('#fault-now').textContent = r ? 'Running: ' + (NAMES[r] || r) + '.' : 'Nothing running.';
  }
  setInterval(markRunning, 1500);
  $('#stop-fault').addEventListener('click', () => { if (clock) clock.event('stop'); markRunning(); });

  // ── the truck ──────────────────────────────────────────────────────────────
  const box = $('#truck3d');
  let pitch = 0, roll = 0, target = { pitch: 0, roll: 0 }, LIMIT = 35;
  let camp = null, tent = { visible: false }, block = { visible: false };   // the camp scene (filled in with WebGL)
  function setTilt(p, r) { target.pitch = Math.max(-LIMIT, Math.min(LIMIT, p)); target.roll = Math.max(-LIMIT, Math.min(LIMIT, r)); }
  function clearPresets() { $$('.presets .btn').forEach(b => b.setAttribute('aria-pressed', 'false')); }
  if (window.THREE) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1.6, 0.1, 100);
    camera.position.set(6.5, 4.2, 7.5); camera.lookAt(0, 0.5, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.shadowMap.enabled = true;
    box.insertBefore(renderer.domElement, box.firstChild);
    function size() { const w = box.clientWidth || 320, h = box.clientHeight || 200; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); }
    size(); new ResizeObserver(size).observe(box);
    scene.add(new THREE.HemisphereLight(0xcfd8e6, 0x202428, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2dc, 1.1); sun.position.set(5, 9, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = sun.shadow.camera.bottom = -6; sun.shadow.camera.right = sun.shadow.camera.top = 6; scene.add(sun);
    const rig = new THREE.Group(); scene.add(rig);          // the ground
    const trig = new THREE.Group(); scene.add(trig);        // the truck, on its own so it can sit on a block
    const slab = new THREE.Mesh(new THREE.BoxGeometry(7, 0.18, 4.4), new THREE.MeshStandardMaterial({ color: 0x5b5346, roughness: 1 })); slab.position.y = -0.09; slab.receiveShadow = true; rig.add(slab);
    const grid = new THREE.GridHelper(7, 14, 0x8a7f6a, 0x6e6555); grid.position.y = 0.001; rig.add(grid);
    const truck = new THREE.Group(); trig.add(truck);
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
    // Camp: a rooftop tent, and a block under the front-right wheel.
    tent = new THREE.Group(); tent.visible = false; truck.add(tent);
    const canvasMat = new THREE.MeshStandardMaterial({ color: 0x9a8a5c, roughness: 1 });
    const tentBase = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 1.5), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 1 })); tentBase.position.set(-0.9, 2.33, 0);   // on the cab roof (the cab is x -1.9 to 0.1) tentBase.castShadow = true; tent.add(tentBase);
    const ridge = new THREE.Shape(); ridge.moveTo(-0.8, 0); ridge.lineTo(0.8, 0); ridge.lineTo(0, 0.7); ridge.lineTo(-0.8, 0);
    const tentTop = new THREE.Mesh(new THREE.ExtrudeGeometry(ridge, { depth: 2.0, bevelEnabled: false }), canvasMat);
    tentTop.rotation.y = Math.PI / 2; tentTop.position.set(-1.9, 2.44, 0);   // extrudes toward +x after the turn tentTop.castShadow = true; tent.add(tentTop);
    const FR_WHEEL_X = 1.35, FR_WHEEL_Z = 1.0;   // the truck faces +x; +z is its right side
    block = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: 0xffb000, roughness: 0.8 })); block.visible = false; block.position.set(FR_WHEEL_X, 0.03, FR_WHEEL_Z); block.castShadow = true; rig.add(block);
    let drag = null;
    box.addEventListener('pointerdown', e => { box.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, p: target.pitch, r: target.roll }; box.classList.add('grabbing'); if (camp) campEnd(); if (clock) clock.goto('Tilt'); e.preventDefault(); });
    box.addEventListener('pointermove', e => { if (!drag) return; if (camp) campEnd(); setTilt(drag.p + (drag.y - e.clientY) * 0.25, drag.r + (e.clientX - drag.x) * 0.25); clearPresets(); });
    const drop = () => { drag = null; box.classList.remove('grabbing'); };
    box.addEventListener('pointerup', drop); box.addEventListener('pointercancel', drop);
    const readout = $('#readout'); let lastSent = '';
    (function frame() {
      requestAnimationFrame(frame);
      pitch += (target.pitch - pitch) * 0.15; roll += (target.roll - roll) * 0.15;
      const D = Math.PI / 180;
      if (camp) {
        rig.rotation.set(-camp.ground.roll * D, 0, camp.ground.pitch * D);
        block.scale.y = Math.max(0.01, camp.lift); block.position.y = 0.03 * camp.lift;
      } else rig.rotation.set(-roll * D, 0, pitch * D);
      trig.rotation.set(-roll * D, 0, pitch * D);
      // Level on the block, the rear-left wheel stays on the ground and the
      // front-right rides up: the body rises half the block's height.
      trig.position.y = camp ? camp.lift * 0.03 : 0;
      renderer.render(scene, camera);
      const key = pitch.toFixed(1) + ',' + roll.toFixed(1);
      if (key !== lastSent) { lastSent = key; if (clock) clock.tilt(pitch, roll); readout.textContent = 'pitch ' + (pitch >= 0 ? '+' : '') + pitch.toFixed(1) + '°   roll ' + (roll >= 0 ? '+' : '') + roll.toFixed(1) + '°'; }
    })();
  } else {
    box.innerHTML = '<p style="padding:24px">The 3D truck needs WebGL. The preset buttons still tip the clock.</p>';
  }
  // ── camp for the night ────────────────────────────────────────────────────
  // CAMP page: the truck is parked with the tent up, on ground just off level.
  // A 3rd gen 4Runner (wheelbase 105.3 in, front track 59.3 in) parked so its
  // front-right wheel sits 2.2 in below the rear-left (the two beside it 1.1):
  // a 2-inch block under the front right pivots it level on the rear-left.
  // TILT page, a drag or a preset packs it all up.
  const WB = 105.3, TK = 59.3, LOW_IN = 1.1;
  const groundPitch = -Math.asin(LOW_IN / WB) * 180 / Math.PI, groundRoll = -Math.asin(LOW_IN / TK) * 180 / Math.PI;
  const campRow = $('#camp-row'), campBlock = $('#camp-block'), campSay = $('#camp-say');
  function viewButtons(which) { $$('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === which))); }
  function campStart(lift) {
    camp = { ground: { pitch: groundPitch, roll: groundRoll }, lift };
    tent.visible = true; block.visible = lift > 0;
    setTilt(groundPitch * (1 - lift), groundRoll * (1 - lift)); clearPresets();
    campRow.hidden = false; campBlock.setAttribute('aria-pressed', String(lift > 0));
    campBlock.textContent = lift > 0 ? 'Take the block out' : 'Put a 2-inch block under the front right wheel';
    campSay.textContent = lift > 0 ? 'Level. Sleep on it.' : 'Parked for the night. The CAMP page says 2 inches under the front right.';
    viewButtons('Camp');
  }
  function campEnd() {
    camp = null; tent.visible = false; block.visible = false; campRow.hidden = true; campSay.textContent = ''; viewButtons('Tilt');
  }
  campBlock.addEventListener('click', () => campStart(camp && camp.lift > 0 ? 0 : 1));
  $$('[data-view]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.view === 'Camp') campStart(0); else { campEnd(); setTilt(0, 0); clearPresets(); $('.presets .btn').setAttribute('aria-pressed', 'true'); }
    if (clock) clock.goto(b.dataset.view);
  }));
  $$('.presets .btn').forEach(b => b.addEventListener('click', () => { const [p, r] = b.dataset.tilt.split(',').map(Number); if (camp) campEnd(); setTilt(p, r); clearPresets(); b.setAttribute('aria-pressed', 'true'); if (clock) clock.goto('Tilt'); }));
})();
