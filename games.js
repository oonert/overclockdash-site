// GAMES page: the four arcade games from the clock, on the clock's own game code
// (built for the browser by tools/layout/arc_web/build_site.sh in the firmware repo).
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var V = (document.currentScript && (document.currentScript.src.match(/[?&]v=([^&]+)/) || [])[1]) || '';
  var cv = $('#gm-scr'), g = cv.getContext('2d'), house = $('#gm-house'), knob = $('#gm-knob'), tick = $('#gm-tick'), status = $('#gm-status');
  var narrow = function () { return innerWidth <= 900; };
  var mods = {}, M = null, W = 320, H = 240, buf = 0, img = null;
  var game = 0, color = true, paused = false, orient = narrow() && innerHeight > innerWidth ? 2 : 1, playedOnce = false;

  // What the knob does in each game, in the order the clock lists them.
  var HOW = [
    'A brick breaker. <b>Turn</b> to move the paddle. <b>Push</b> to launch the ball.',
    'A duel against one to three computer riders. Every bike leaves a wall behind it. <b>Turn</b> to steer left or right, and stay off the walls.',
    'Trail driving, seen from above. <b>Turn</b> to steer.',
    'Set the lander down gently. <b>Turn</b> to tilt it. <b>Push</b> for one burn of the engine.'
  ];

  // ── saved scores: the games' own saved values, kept in this browser ───────
  var KEY = 'oc_arcade_v1', lastSaved = '';
  function readStore() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function restore(m) {
    var st = readStore();
    Object.keys(st).forEach(function (k) {
      try {
        var bin = atob(st[k]), n = bin.length, p = m._malloc(n || 1), kn = m.lengthBytesUTF8(k) + 1, kp = m._malloc(kn);
        for (var i = 0; i < n; i++) m.HEAPU8[p + i] = bin.charCodeAt(i);
        m.stringToUTF8(k, kp, kn); m._arc_save_put(kp, p, n); m._free(p); m._free(kp);
      } catch (e) {}
    });
  }
  function save() {
    if (!M) return;
    try {
      var out = readStore(), n = M._arc_save_count();
      for (var i = 0; i < n; i++) {
        var k = M.UTF8ToString(M._arc_save_key(i)), len = M._arc_save_len(i), p = M._arc_save_data(i), s = '';
        for (var j = 0; j < len; j++) s += String.fromCharCode(M.HEAPU8[p + j]);
        out[k] = btoa(s);
      }
      var js = JSON.stringify(out); if (js !== lastSaved) { localStorage.setItem(KEY, js); lastSaved = js; }
    } catch (e) {}
  }
  setInterval(save, 3000); addEventListener('pagehide', save);

  // ── the engine: one build per screen shape, loaded when first wanted ──────
  function loadScript(src) { return new Promise(function (ok, bad) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
  function engine(o) {
    if (mods[o]) return Promise.resolve(mods[o]);
    var ready = window['Arc' + o] ? Promise.resolve() : loadScript('games/arc' + o + '.js' + (V ? '?v=' + V : ''));
    return ready.then(function () { return window['Arc' + o]({ locateFile: function (f) { return 'games/' + f + (V ? '?v=' + V : ''); } }); })
      .then(function (m) { restore(m); m._buf = m._arc_init(); mods[o] = m; return m; });
  }
  function use(o) {
    save();
    return engine(o).then(function (m) {
      M = m; orient = o; buf = m._buf; W = m._arc_w(); H = m._arc_h();
      cv.width = W; cv.height = H; img = g.createImageData(W, H); fit();
      m._arc_color(color ? 1 : 0); buildTiles(); start(game);
      $$('[data-o]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.o === o)); });
    }).catch(function () { status.textContent = 'The games could not load. Try reloading the page.'; });
  }
  function start(i) {
    game = i; M._arc_start(i);
    $$('#gm-tiles button').forEach(function (b, k) { b.setAttribute('aria-selected', String(k === i)); });
    $('#gm-how').innerHTML = HOW[i] || '';
    say();
  }
  function say() { status.textContent = paused ? 'Paused.' : narrow() ? 'Turn the knob. Tap it to push. Hold it to quit.' : 'Scroll to turn. Click to push. Hold to quit.'; }
  function buildTiles() {
    var box = $('#gm-tiles'); box.innerHTML = '';
    for (var i = 0; i < M._arc_count(); i++) (function (i) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = M.UTF8ToString(M._arc_name(i));
      b.addEventListener('click', function () { start(i); }); box.appendChild(b);
    })(i);
  }

  // ── size: whole-number steps so the pixels stay square and sharp ──────────
  function fit() {
    var full = !!document.fullscreenElement, s;
    if (narrow()) s = Math.max(1, Math.min((innerWidth - 56) / W, (innerHeight - 500) / H));
    else {
      var top = full ? 0 : ($('#gm-house').getBoundingClientRect().top + scrollY);      // the site header above the machine
      var roomW = innerWidth - 420, roomH = innerHeight - top - 32 - 84;                 // housing edges, then the controls under it
      s = Math.floor(Math.min(roomW / W, roomH / H)); s = Math.max(2, Math.min(full ? 5 : 3, s));
      if (W * s > innerWidth - 380) s = Math.max(1, s - 1);
    }
    cv.style.width = Math.round(W * s) + 'px'; cv.style.height = Math.round(H * s) + 'px';
  }
  addEventListener('resize', fit); document.addEventListener('fullscreenchange', fit);

  // ── the knob: turn, push, hold ─────────────────────────────────────────────
  var ang = 0;
  var STEP = 20;      // degrees of drag on the drawn knob for one click: 18 clicks a turn, wide enough to count them
  function cueOff() { var c = $('#gm-cue'); if (c) c.classList.add('off'); }
  function rot(d) { if (!M) return; playedOnce = true; cueOff(); M._arc_rotate(d); ang += d * STEP; tick.style.transform = 'rotate(' + ang + 'deg)'; if (navigator.vibrate && narrow()) { try { navigator.vibrate(4); } catch (e) {} } }
  function push() { if (!M) return; playedOnce = true; cueOff(); M._arc_click(); knob.classList.add('push'); setTimeout(function () { knob.classList.remove('push'); }, 120); if (paused) setPaused(false); say(); }
  function hold() { if (!M) return; M._arc_stop(); start(game); }       // quit goes back to the game's title, as an arcade does
  var acc = 0;
  // One notch of a mouse wheel is ONE click of the knob, as on the clock, however big the
  // browser says the notch is (usually 100, so counting every 50 turned each notch into two
  // clicks and the knob code could not be entered). Trackpads and smooth wheels send many
  // small moves instead; those add up, 40 to a click.
  function wheel(e) {
    e.preventDefault(); var dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY; if (!dy) return;
    if (Math.abs(dy) >= 40) { acc = 0; rot(dy > 0 ? 1 : -1); return; }
    acc += dy; while (Math.abs(acc) >= 40) { rot(acc > 0 ? 1 : -1); acc -= (acc > 0 ? 1 : -1) * 40; }
  }
  house.addEventListener('wheel', wheel, { passive: false }); knob.addEventListener('wheel', wheel, { passive: false });
  function pressable(el, drag) {
    var down = false, moved = false, held = false, t = 0, last = 0;
    function angle(e) { var r = el.getBoundingClientRect(); return Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2) * 180 / Math.PI; }
    el.addEventListener('pointerdown', function (e) {
      if (e.button) return; e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {}
      down = true; moved = false; held = false; last = drag ? angle(e) : 0;
      t = setTimeout(function () { if (down && !moved) { held = true; hold(); } }, 500);
    });
    el.addEventListener('pointermove', function (e) {
      if (!down || !drag) return; var d = angle(e) - last; if (d > 180) d -= 360; if (d < -180) d += 360;
      if (Math.abs(d) > 4) moved = true;
      while (Math.abs(d) >= STEP) { var sgn = d > 0 ? 1 : -1; rot(sgn); last += sgn * STEP; d -= sgn * STEP; }
    });
    el.addEventListener('pointerup', function () { if (!down) return; down = false; clearTimeout(t); if (!moved && !held) push(); });
    el.addEventListener('pointercancel', function () { down = false; clearTimeout(t); });
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  pressable(house, false); pressable(knob, true);
  addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { rot(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { rot(-1); e.preventDefault(); }
    else if (e.key === ' ' && !(e.target && e.target.tagName === 'BUTTON')) { push(); e.preventDefault(); }
    else if (e.key === 'Escape' && !document.fullscreenElement) hold();
  });

  // ── the switches ───────────────────────────────────────────────────────────
  $$('[data-color]').forEach(function (b) { b.addEventListener('click', function () {
    color = b.dataset.color === '1'; $$('[data-color]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    if (M) { M._arc_color(color ? 1 : 0); start(game); }       // colours are set before a game starts, as on the clock
  }); });
  $$('[data-o]').forEach(function (b) { b.addEventListener('click', function () { if (+b.dataset.o !== orient) use(+b.dataset.o); }); });
  function setPaused(p) { paused = p; $('#gm-pause').setAttribute('aria-pressed', String(p)); say(); }
  $('#gm-pause').addEventListener('click', function () { setPaused(!paused); });
  $('#gm-full').addEventListener('click', function () { var el = $('#main'); if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen(); });
  if (!document.documentElement.requestFullscreen) $('#gm-full').hidden = true;

  // ── the loop: real time in, the game's own pacing inside ───────────────────
  var lastT = performance.now();
  function frame(t) {
    requestAnimationFrame(frame); var dt = Math.min(100, t - lastT); lastT = t; if (!M || !img) return;
    if (!paused && !document.hidden) { M._arc_tick(Math.round(dt)); if (!M._arc_active()) start(game); }
    var src = new Uint16Array(M.HEAPU16.buffer, buf, W * H), d = img.data;
    for (var i = 0, j = 0; i < W * H; i++, j += 4) { var c = src[i]; d[j] = (c >> 11 & 31) * 255 / 31; d[j + 1] = (c >> 5 & 63) * 255 / 63; d[j + 2] = (c & 31) * 255 / 31; d[j + 3] = 255; }
    g.putImageData(img, 0, 0);
  }
  use(orient); requestAnimationFrame(frame);
})();
