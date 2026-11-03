/* The demo page: the clock, and every control beside it. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const phone = () => window.innerWidth <= 900;

  // ── the clock ─────────────────────────────────────────────────────────────
  let clock = null, currentCase = '4runner';
  const FW_STAMP = '2026-11-01b';   // bump when dist/ is rebuilt, so browsers fetch the new firmware
  const status = $('#status');
  function frameWidth() { return phone() ? Math.round((window.innerWidth - 24) * 0.68) : Math.min(560, Math.round(window.innerWidth * 0.42)); }
  async function mountClock(which) {
    currentCase = which; if (window.__setTruck) window.__setTruck(which);
    $$('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.case === which)));
    if (clock) { clock.destroy(); clock = null; }
    status.textContent = 'Loading the firmware (about 4 MB)...';
    try {
      clock = await OverclockDemoTruck.mount($('#clock'), { frame: which, frameWidth: frameWidth(), base: 'dist/', v: FW_STAMP, dial: false, storage: null, alerts: { storm: false } });
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
  // phones: once the knob panel has scrolled under the stage, the stage shrinks to the clock
  const knobPanel = $('#knob');
  // desktop: THE KNOB stops following once the 3D truck comes up, so it never covers it
  if ('IntersectionObserver' in window && $('#truck')) new IntersectionObserver(([e]) => knobPanel.classList.toggle('let-go', e.isIntersecting), { rootMargin: '0px 0px -45% 0px' }).observe($('#truck'));
  function compactStage() { if (!phone()) { stage.classList.remove('compact'); return; } stage.classList.toggle('compact', window.scrollY > knobPanel.offsetTop + knobPanel.offsetHeight - 120); }
  window.addEventListener('scroll', compactStage, { passive: true }); window.addEventListener('resize', compactStage);
  // LEARN THE KNOB: the firmware's own first-power-on lesson (SETUP), from WELCOME
  $$('#learn').forEach(b => b.addEventListener('click', () => { if (!clock) return; hideHint(); clock.goto('Setup'); $('#clock').focus(); }));
  $$('[data-knob]').forEach(b => b.addEventListener('click', () => {
    if (!clock) return;
    const [what, n] = b.dataset.knob.split(':');
    if (what === 'turn') clock.turn(+n); else if (what === 'click') clock.click(); else if (what === 'hold') clock.hold(1100);
    else if (what === 'home') {   // the real move: press, turn two clicks while held, let go
      clock.press(true); setTimeout(() => clock.turn(1), 180); setTimeout(() => clock.turn(1), 420); setTimeout(() => clock.press(false), 680);
    }
  }));

  // ── key on, key off, an update ────────────────────────────────────────────
  const pwSay = $('#pw-say');
  const pwState = (on) => { $('#pw-on').setAttribute('aria-pressed', String(on)); $('#pw-off').setAttribute('aria-pressed', String(!on)); };
  $('#pw-off').addEventListener('click', () => { if (!clock) return; clock.off(); pwState(false); pwSay.textContent = 'Key off. The screen is dark; the firmware is stopped.'; });
  $('#pw-on').addEventListener('click', () => { if (!clock) return; clock.on(); pwState(true); pwSay.textContent = 'Key on: the startup screen, then the clock.'; });
  $('#pw-update').addEventListener('click', () => { if (!clock) return; clock.update('0.99.200', 1500000); pwState(true); pwSay.textContent = 'An update file landed on the card. The dash restarts, installs it with the bar filling, says UPDATED, and boots again.'; });

  // ── the pages ─────────────────────────────────────────────────────────────
  const PAGES = [['Clock', 'Clock'], ['Gauges', 'Gauges'], ['Temp', 'Temp'], ['Speed', 'Speed'], ['Weather', 'Weather'], ['Solar', 'Solar'], ['Voltage', 'Voltage'], ['Level', 'Tilt'], ['Health', 'Health'], ['Trips', 'Trips'], ['Fuel', 'Fuel'], ['Towing', 'Towing'], ['Obd', 'Codes'], ['Records', 'Records'], ['Apps', 'Apps'], ['Settings', 'Settings']];
  const pc = $('#page-chips');
  PAGES.forEach(([name, label]) => { const b = document.createElement('button'); b.className = 'btn ghost'; b.type = 'button'; b.textContent = label; b.addEventListener('click', () => clock && clock.goto(name)); pc.appendChild(b); });

  // ── the faults ────────────────────────────────────────────────────────────
  const NAMES = { overheat: 'Overheat', nocharge: 'No charge', overvolt: 'Overvolt', lowoil: 'Low oil pressure', towing: 'Towing climb', loselink: 'Lose link',
                  checkengine: 'Check engine', misfire: 'Misfire', threecodes: 'Three codes', engineok: 'Clear codes',
                  fridgewarm: 'Fridge warm', fridgecold: 'Fridge cold', freezerthaw: 'Freezer thaw' };
  const GROUPS = { engine: ['overheat', 'nocharge', 'overvolt', 'lowoil', 'towing', 'loselink'], codes: ['checkengine', 'misfire', 'threecodes', 'engineok'], camp: ['fridgewarm', 'fridgecold', 'freezerthaw'] };
  // Each fault opens the page where you can watch it build, so the button never feels dead.
  // GAUGES faults also pick the four panes so the reading to watch is on screen
  // (channel ids, gauge_channel.h: 1 SPEED, 2 RPM, 3 COOLANT, 5 VOLTS, 21 OIL PSI).
  const PANES = { overheat: [3, 2, 1, 5], lowoil: [21, 2, 3, 5], loselink: [1, 2, 3, 5] }, PANES_DEFAULT = [1, 2, 3, 5];
  const SHOW = { overheat: ['Gauges', 'Watch COOLANT climb'], nocharge: ['Voltage', 'Watch the volts sag'], overvolt: ['Voltage', 'Watch the volts creep up'],
                 lowoil: ['Gauges', 'Watch OIL PRESSURE fall'], towing: ['Towing', 'Watch trans and coolant on the grade'], loselink: ['Gauges', 'Watch the engine readings drop out'],
                 fridgewarm: ['Temp', 'Watch FRIDGE warm up'], fridgecold: ['Temp', 'Watch FRIDGE drop'], freezerthaw: ['Temp', 'Watch FREEZER warm up'] };
  const TAKEOVER = ev => ['overheat', 'nocharge', 'overvolt', 'lowoil', 'towing', 'fridgewarm', 'fridgecold', 'freezerthaw'].includes(ev);
  function runFault(ev) {
    const s = SHOW[ev];
    if (PANES[ev] && clock.gauges) clock.gauges(...PANES[ev]);
    // The demo truck runs without a freezer probe; the freezer button adds one so TEMP shows it.
    if (clock.freezer && (ev === 'freezerthaw' || ev === 'fridgewarm' || ev === 'fridgecold')) clock.freezer(ev === 'freezerthaw');
    if (s) clock.goto(s[0]);
    setTimeout(() => { clock.event(ev); markRunning(); }, s ? 400 : 0);
  }
  function buildFaults() {
    for (const g in GROUPS) {
      const box = $('#faults [data-group="' + g + '"]'); box.innerHTML = '';
      GROUPS[g].filter(ev => clock.events.includes(ev)).forEach(ev => { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.dataset.event = ev; b.textContent = NAMES[ev] || ev; b.addEventListener('click', () => runFault(ev)); box.appendChild(b); });
    }
  }
  function markRunning() {
    const r = clock ? clock.eventRunning() : null;
    $$('#faults .btn[data-event]').forEach(b => b.classList.toggle('running', b.dataset.event === r));
    const s = r && SHOW[r];
    $('#fault-now').textContent = !r ? 'Nothing running.' : (NAMES[r] || r) + (s ? ': ' + s[1] + (TAKEOVER(r) ? '. The alert takes the screen in about 15 to 20 seconds.' : '.') : '.');
  }
  setInterval(markRunning, 1500);
  // RESET: stop whatever is running, clear the codes it set, back to a healthy truck.
  $('#reset-faults').addEventListener('click', () => {
    if (!clock) return;
    clock.event('stop'); clock.event('engineok'); markRunning();
    if (clock.gauges) clock.gauges(...PANES_DEFAULT);
    if (clock.freezer) clock.freezer(false);
    $('#fault-now').textContent = 'Reset: fault stopped, codes clearing, readings easing back to normal.';
    setTimeout(() => { if (clock && clock.eventRunning() === 'engineok') clock.event('stop'); markRunning(); }, 4000);
  });

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
    const slab = new THREE.Mesh(new THREE.BoxGeometry(7, 0.18, 5.8), new THREE.MeshStandardMaterial({ color: 0x5b5346, roughness: 1 })); slab.position.y = -0.09; slab.receiveShadow = true; rig.add(slab);
    const grid = new THREE.GridHelper(7, 14, 0x8a7f6a, 0x6e6555); grid.position.y = 0.001; rig.add(grid);
    const truck = new THREE.Group(); trig.add(truck);
    // the truck follows the case picked above: blue 4Runner or red Tacoma (trucks.js)
    block = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: 0xffb000, roughness: 0.8 })); block.visible = false; block.position.y = 0.03; block.castShadow = true; rig.add(block);
    function buildTruck(kind) {
      while (truck.children.length) truck.remove(truck.children[0]);
      const info = kind === 'tacoma' ? TRUCKS.tacoma({ paint: 0xa8322b }) : TRUCKS.fourRunner({ paint: 0x23344f });
      truck.add(info.group);
      const t = TRUCKS.tent('soft', info); t.visible = !!camp; truck.add(t); tent = t;   // the fold-out tent, up in camp only
      block.position.x = info.wheelX; block.position.z = info.track;                       // under the front-right wheel (+z is the right side)
    }
    buildTruck(currentCase); window.__setTruck = buildTruck;
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
