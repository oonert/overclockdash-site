/* tools/web/overclock.js: the OVERCLOCK clock in a web page.
 *
 * The real firmware (built to WebAssembly by build.sh) draws into a <canvas>,
 * and a dial under it turns, clicks and holds the knob through the firmware's
 * own encoder code. No styling beyond what it takes to see and use it.
 *
 *   const clock = await OverclockClock.mount(element, {
 *     orientation: 'landscape',      // or 'portrait'
 *     base: 'dist/',                 // where overclock-1.js and .wasm live
 *     scale: 2,                      // panel pixels to screen pixels (integer looks best; no frame)
 *     frame: '4runner',              // the case picture: '4runner' (landscape) or 'tacoma' (portrait)
 *                                    // sets the orientation; null = bare panel; or your own
 *                                    // { src, aspect, screen: [x, y, w, h] }
 *     frameWidth: 640,               // the case picture's width on the page
 *     settings: { clk_face: 1 },     // the firmware's own settings, by key, before boot
 *     time: null,                    // a Date for the clock chip; null = the visitor's clock
 *     storage: 'overclock-nvs-1',    // localStorage key for the settings; null = forget on reload
 *     dial: true,                    // draw the dial under the panel
 *     backlight: true,               // dim the picture with the firmware's backlight (false = always full)
 *     alerts: { storm: false },      // popups off (or on) against the firmware's defaults:
 *                                    // storm, fridge, freezer, fuel, home, border, gpsdot
 *   });
 *   clock.turn(1); clock.turn(-1);    // one detent clockwise / counter-clockwise
 *   clock.click(); clock.hold();      // the knob's click and long press
 *   clock.press(true/false);          // the button itself, down / up
 *   clock.goto('Gauges');             // jump to a page by name
 *   clock.event('overheat');          // start a fault (clock.events lists them); clock.event('stop') ends it
 *   clock.tilt(pitch, roll);          // tip the truck (degrees; pitch + nose up, roll + right side up): TILT follows
 *   clock.pause(); clock.resume(); clock.destroy();
 *
 * The dial and the panel both work as the knob: mouse wheel (or a drag around
 * the dial) turns, a tap clicks, a finger kept still holds. A drag never
 * counts as a press.
 * With the panel or dial focused: left/right arrows turn, space or enter
 * clicks, holding them holds.
 */
(function (global) {
  'use strict';

  const ORIENT = { landscape: 1, portrait: 2 };
  const factories = {};        // the loaded firmware, by orientation
  // Where this script was loaded from: the built-in case pictures live next to it.
  const SCRIPT_DIR = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : '';
  // Case pictures the panel can sit in: the image (transparent background, the
  // screen opening cut out) and where the opening is, as fractions of the
  // image's width and height: [x, y, w, h].
  const FRAMES = {
    '4runner': { src: 'frame/4runner-front.png', aspect: 1200 / 938, screen: [0.1525, 0.1737, 0.6971, 0.6669], orientation: 'landscape' },
    'tacoma':  { src: 'frame/tacoma-front.png',  aspect: 1200 / 1116, screen: [0.2800, 0.1099, 0.4978, 0.7134], orientation: 'portrait' },
  };
  FRAMES.v2 = FRAMES['4runner'];

  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => ok(); s.onerror = () => fail(new Error('could not load ' + src));
      document.head.appendChild(s);
    });
  }

  // The firmware's settings file (the emulator's NVS image), kept in
  // localStorage so a visitor's choices survive a reload.
  function nvsLoad(key) {
    if (!key) return null;
    try { const b = localStorage.getItem(key); return b ? Uint8Array.from(atob(b), c => c.charCodeAt(0)) : null; }
    catch (e) { return null; }
  }
  function nvsSave(key, bytes) {
    if (!key) return;
    try { let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); localStorage.setItem(key, btoa(s)); }
    catch (e) { /* storage full or blocked: the clock still runs */ }
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function timeString(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  async function mount(element, opts) {
    opts = Object.assign({ orientation: 'landscape', base: '', scale: 2, settings: {}, time: null, dial: true, backlight: true, frame: null, frameWidth: 640 }, opts || {});
    // A case picture knows its own orientation (the 4Runner is landscape, the Tacoma portrait).
    if (typeof opts.frame === 'string' && FRAMES[opts.frame] && FRAMES[opts.frame].orientation) opts.orientation = FRAMES[opts.frame].orientation;
    const orient = ORIENT[opts.orientation] || 1;
    if (opts.storage === undefined) opts.storage = 'overclock-nvs-' + orient;
    const base = opts.base && !opts.base.endsWith('/') ? opts.base + '/' : (opts.base || '');
    const NVS_PATH = '/nvs.bin';

    // One firmware file per orientation; each defines OverclockModule when it
    // loads, so the factory is kept per orientation and the global cleared.
    if (!factories[orient]) {
      global.OverclockModule = undefined;       // a plain var once a file has loaded: cannot be deleted, only overwritten
      await loadScript(base + 'overclock-' + orient + '.js');
      factories[orient] = global.OverclockModule; global.OverclockModule = undefined;
    }
    const factory = factories[orient];

    // ── the page ────────────────────────────────────────────────────────────
    const root = document.createElement('div');
    root.className = 'overclock';
    root.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;gap:12px;padding:8px;user-select:none;-webkit-user-select:none;touch-action:none;';
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.style.cssText = 'image-rendering:pixelated;image-rendering:crisp-edges;display:block;background:#000;outline:none;';
    // In a case picture: the canvas sits in the screen opening, the picture
    // over it (clicks and the wheel pass through the picture to the canvas).
    const frame = typeof opts.frame === 'string' ? FRAMES[opts.frame] : opts.frame;
    if (opts.frame && !frame) console.warn('[overclock] no frame named ' + opts.frame);
    let box = null;
    if (frame) {
      box = document.createElement('div');
      box.className = 'overclock-frame';
      const fw = opts.frameWidth, fh = fw / frame.aspect;
      box.style.cssText = 'position:relative;width:' + fw + 'px;height:' + fh + 'px;';
      const img = document.createElement('img');
      img.src = typeof opts.frame === 'string' ? SCRIPT_DIR + frame.src : frame.src;   // built-in: next to overclock.js; yours: as given
      img.draggable = false;
      img.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;';
      const hole = document.createElement('div');            // black behind the panel
      hole.style.cssText = 'position:absolute;background:#000;left:' + (frame.screen[0] * 100) + '%;top:' + (frame.screen[1] * 100) + '%;width:' + (frame.screen[2] * 100) + '%;height:' + (frame.screen[3] * 100) + '%;';
      canvas.style.position = 'absolute';
      box.appendChild(hole); box.appendChild(canvas); box.appendChild(img);
      root.appendChild(box);
    } else {
      root.style.background = '#000';
      root.appendChild(canvas);
    }
    let dial = null;
    if (opts.dial) {
      dial = document.createElement('div');
      dial.className = 'overclock-dial';
      dial.tabIndex = 0;
      dial.title = 'Drag or scroll to turn, click, hold';
      dial.style.cssText = 'width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#555,#111 70%);border:2px solid #333;position:relative;cursor:grab;outline:none;box-shadow:0 2px 6px #000;';
      const mark = document.createElement('div');
      mark.style.cssText = 'position:absolute;left:50%;top:6px;width:4px;height:14px;margin-left:-2px;border-radius:2px;background:#ffb000;';
      dial.appendChild(mark);
      root.appendChild(dial);
    }
    element.appendChild(root);

    // ── the firmware ────────────────────────────────────────────────────────
    const saved = nvsLoad(opts.storage);
    const timeAt = opts.time ? new Date(opts.time) : new Date();
    const Module = await factory({
      locateFile: (path) => base + path,
      print: (t) => console.log('[overclock] ' + t),
      printErr: (t) => console.warn('[overclock] ' + t),
      noInitialRun: true,           // the page's settings go in first, then main()
      preRun: [(m) => {
        m.ENV.EMU_CARD = '/card';
        m.ENV.EMU_NVS = NVS_PATH;
        m.ENV.EMU_TIME = timeString(timeAt);
        if (saved) m.FS.writeFile(NVS_PATH, saved);
      }],
    });
    // Settings asked for by the page go in after the saved ones, before boot.
    // Straight calls into the firmware. (Emscripten's ccall hands back a
    // promise while the firmware is suspended between frames, so strings are
    // passed by hand.)
    function withStr(fn) {
      return function () {
        const ptrs = [], args = [];
        for (const a of arguments) {
          if (typeof a === 'string') { const n = Module.lengthBytesUTF8(a) + 1, p = Module._malloc(n); Module.stringToUTF8(a, p, n); ptrs.push(p); args.push(p); }
          else args.push(a);
        }
        try { return fn.apply(null, args); } finally { ptrs.forEach(p => Module._free(p)); }
      };
    }
    const c = {
      fb: Module._oc_fb, width: Module._oc_width, height: Module._oc_height, lamp: Module._oc_lamp,
      writes: Module._oc_writes, turn: Module._oc_turn, press: Module._oc_press, pause: Module._oc_pause,
      booted: Module._oc_booted, setU32: withStr(Module._oc_set_u32), setStr: withStr(Module._oc_set_str),
      goto: withStr(Module._oc_goto), setTime: Module._oc_set_time,
      version: () => Module.UTF8ToString(Module._oc_version()),
      notifyDefault: Module._oc_notify_default, notifyBit: withStr(Module._oc_notify_bit), notifyMask: Module._oc_notify_mask,
      event: Module._oc_event, eventRunning: Module._oc_event_running, eventCount: Module._oc_event_count,
      eventName: (n) => Module.UTF8ToString(Module._oc_event_name(n)),
      tilt: Module._oc_tilt,
    };
    // Which alerts may pop up: the firmware's defaults, minus the ones the page
    // turns off ({ storm: false }). Applied before boot, over the saved settings.
    if (opts.alerts) {
      let mask = c.notifyDefault() >>> 0;
      for (const k in opts.alerts) { const bit = c.notifyBit(k) >>> 0; if (!bit) console.warn('[overclock] no alert named ' + k); else if (opts.alerts[k]) mask |= bit; else mask &= ~bit; }
      c.notifyMask(mask >>> 0);
    }
    // The DEMO app's fault events, by name.
    const events = {};
    for (let i = 1; i < c.eventCount(); i++) { const n = c.eventName(i); if (n) events[n] = i; }
    for (const k in opts.settings) {
      const v = opts.settings[k];
      if (typeof v === 'string') c.setStr(k, v); else c.setU32(k, v >>> 0);
    }
    Module.callMain([]);            // boots the firmware; it runs on between the browser's frames

    // ── the panel on the canvas ─────────────────────────────────────────────
    const W = c.width(), H = c.height();
    canvas.width = W; canvas.height = H;
    if (frame) {                     // fit the panel in the opening, keeping its shape, centred
      const fw = opts.frameWidth, fh = fw / frame.aspect;
      const ox = frame.screen[0] * fw, oy = frame.screen[1] * fh, ow = frame.screen[2] * fw, oh = frame.screen[3] * fh;
      const k = Math.min(ow / W, oh / H), cw = W * k, ch = H * k;
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      canvas.style.left = (ox + (ow - cw) / 2) + 'px'; canvas.style.top = (oy + (oh - ch) / 2) + 'px';
    } else {
      canvas.style.width = (W * opts.scale) + 'px'; canvas.style.height = (H * opts.scale) + 'px';
    }
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(W, H);
    const px = new Uint32Array(img.data.buffer);
    let lastWrites = -1, lastLamp = -1, raf = 0, alive = true;
    // RGB565 to RGBA, once per level of backlight (256 steps), looked up per pixel.
    const lut = new Uint32Array(65536);
    let lutLamp = -1;
    function buildLut(L) {
      for (let v = 0; v < 65536; v++) {
        const r = ((v >> 11) & 31) * 255 / 31 * L, g = ((v >> 5) & 63) * 255 / 63 * L, b = (v & 31) * 255 / 31 * L;
        lut[v] = 0xFF000000 | (b << 16) | (g << 8) | r;
      }
      lutLamp = L;
    }
    function paint() {
      if (!alive) return;
      raf = requestAnimationFrame(paint);
      const writes = c.writes(), L = opts.backlight ? Math.round(c.lamp() * 255) / 255 : 1;
      if (writes === lastWrites && L === lastLamp) return;
      lastWrites = writes; lastLamp = L;
      if (L !== lutLamp) buildLut(L);
      const fb = c.fb() >> 1;
      const heap = Module.HEAPU16;
      for (let y = 0; y < H; y++) {
        const row = fb + y * 320, out = y * W;
        for (let x = 0; x < W; x++) px[out + x] = lut[heap[row + x]];
      }
      ctx.putImageData(img, 0, 0);
    }
    raf = requestAnimationFrame(paint);

    // ── settings to localStorage, when they change ──────────────────────────
    let lastNvs = '';
    const saver = setInterval(() => {
      try {
        if (!Module.FS.analyzePath(NVS_PATH).exists) return;
        const bytes = Module.FS.readFile(NVS_PATH);
        const sig = bytes.length + ':' + (bytes.length ? bytes[bytes.length - 1] : 0) + ':' + hash(bytes);
        if (sig !== lastNvs) { lastNvs = sig; nvsSave(opts.storage, bytes); }
      } catch (e) { }
    }, 2000);
    function hash(b) { let h = 0; for (let i = 0; i < b.length; i++) h = (h * 31 + b[i]) | 0; return h; }

    // ── the clock chip follows the visitor's clock when the tab was asleep ──
    let lastSeen = Date.now();
    const ticker = setInterval(() => {
      const now = Date.now();
      if (!opts.time && now - lastSeen > 5000) { const d = new Date(); c.setTime(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()); }
      lastSeen = now;
    }, 1000);

    // ── the knob ────────────────────────────────────────────────────────────
    const MIN_PRESS_MS = 80;      // a press the firmware cannot miss
    const HOLD_ARM_MS = 250;      // a finger still this long is a hold, not a click
    let downAt = 0, upTimer = 0;
    const api = {
      element: root, canvas, dial, module: Module,
      version: c.version(),
      turn(n) { c.turn(n | 0); },
      // The firmware reads the button every few milliseconds of its own time,
      // so a press shorter than MIN_PRESS_MS is stretched to that; a real
      // finger is never faster.
      press(down) {
        if (down) { downAt = performance.now(); clearTimeout(upTimer); c.press(1); return; }
        const left = MIN_PRESS_MS - (performance.now() - downAt);
        if (left > 0) upTimer = setTimeout(() => c.press(0), left); else c.press(0);
      },
      click() { api.press(true); setTimeout(() => api.press(false), 120); },
      hold(ms) { api.press(true); setTimeout(() => api.press(false), ms || 1000); },
      goto(page) { c.goto(page); },
      events: Object.keys(events),              // the fault names this build knows
      event(name) {                              // start a fault by name; event(null) or 'stop' ends it
        if (!name || name === 'stop') { c.event(0); return true; }
        if (!(name in events)) { console.warn('[overclock] no event named ' + name); return false; }
        c.event(events[name]); return true;
      },
      eventRunning() { const n = c.eventRunning(); return n ? c.eventName(n) : null; },
      tilt(pitch, roll) { c.tilt(+pitch || 0, +roll || 0); },   // degrees: pitch + nose up, roll + right side up
      pause() { c.pause(1); },
      resume() { c.pause(0); },
      destroy() { alive = false; cancelAnimationFrame(raf); clearInterval(saver); clearInterval(ticker); c.pause(1); root.remove(); },
    };

    // Keys, on the panel or the dial.
    let keyDown = false;
    function onKey(e) {
      if (e.type === 'keydown') {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { api.turn(1); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { api.turn(-1); e.preventDefault(); }
        else if (e.key === ' ' || e.key === 'Enter') { if (!keyDown) { keyDown = true; api.press(true); } e.preventDefault(); }
      } else if (e.key === ' ' || e.key === 'Enter') { keyDown = false; api.press(false); e.preventDefault(); }
    }
    canvas.addEventListener('keydown', onKey); canvas.addEventListener('keyup', onKey);
    // The panel works like the knob too: scroll over it to turn, click it,
    // press and keep still to hold (the button goes down after HOLD_ARM_MS).
    canvas.addEventListener('wheel', (e) => { api.turn(e.deltaY > 0 ? 1 : -1); e.preventDefault(); }, { passive: false });
    (function panelButton() {
      let down = false, pressed = false, moved = false, timer = 0, x0 = 0, y0 = 0;
      canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId); down = true; pressed = false; moved = false; x0 = e.clientX; y0 = e.clientY; canvas.focus();
        clearTimeout(timer); timer = setTimeout(() => { if (down && !moved) { pressed = true; api.press(true); } }, HOLD_ARM_MS);
        e.preventDefault();
      });
      canvas.addEventListener('pointermove', (e) => { if (down && !pressed && Math.hypot(e.clientX - x0, e.clientY - y0) > 6) { moved = true; clearTimeout(timer); } });
      function up(e) {
        if (!down) return; down = false; clearTimeout(timer);
        if (pressed) { pressed = false; api.press(false); } else if (!moved && e.type === 'pointerup') api.click();   // a swipe is nothing
      }
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    })();

    if (dial) {
      dial.addEventListener('keydown', onKey); dial.addEventListener('keyup', onKey);
      dial.addEventListener('wheel', (e) => { api.turn(e.deltaY > 0 ? 1 : -1); e.preventDefault(); }, { passive: false });
      // Drag around the dial: every 20 degrees is one detent. The button is
      // never pressed on the way down, because a drag starts the same way:
      // a tap (up without moving) is a click, and a finger held still for
      // HOLD_ARM_MS presses the button until it lifts, so the firmware's own
      // long press runs.
      let dragging = false, moved = false, lastAng = 0, acc = 0, pressed = false, armTimer = 0;
      const DETENT = 20, MOVE_PX = 6;
      let downX = 0, downY = 0;
      function angle(e) { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; }
      function spin(deg) { const r = (parseFloat(dial.dataset.rot || 0) + deg); dial.dataset.rot = r; dial.style.transform = 'rotate(' + r + 'deg)'; }
      dial.addEventListener('pointerdown', (e) => {
        dial.setPointerCapture(e.pointerId);
        dragging = true; moved = false; pressed = false; lastAng = angle(e); acc = 0; downX = e.clientX; downY = e.clientY;
        clearTimeout(armTimer);
        armTimer = setTimeout(() => { if (dragging && !moved) { pressed = true; api.press(true); } }, HOLD_ARM_MS);
        dial.style.cursor = 'grabbing'; dial.focus(); e.preventDefault();
      });
      dial.addEventListener('pointermove', (e) => {
        if (!dragging || pressed) return;
        if (!moved && Math.hypot(e.clientX - downX, e.clientY - downY) > MOVE_PX) { moved = true; clearTimeout(armTimer); lastAng = angle(e); acc = 0; return; }
        if (!moved) return;
        const a = angle(e); let d = a - lastAng; if (d > 180) d -= 360; if (d < -180) d += 360;
        lastAng = a; acc += d;
        while (acc >= DETENT) { api.turn(1); acc -= DETENT; spin(DETENT); }
        while (acc <= -DETENT) { api.turn(-1); acc += DETENT; spin(-DETENT); }
      });
      function up(e) {
        if (!dragging) return;
        dragging = false; clearTimeout(armTimer); dial.style.cursor = 'grab';
        if (pressed) { pressed = false; api.press(false); }
        else if (!moved && e.type === 'pointerup') api.click();
      }
      dial.addEventListener('pointerup', up); dial.addEventListener('pointercancel', up);
    }

    // Hidden tab: the firmware idles (its clock would otherwise race to catch up).
    const onVis = () => c.pause(document.hidden ? 1 : 0);
    document.addEventListener('visibilitychange', onVis);

    return api;
  }

  global.OverclockClock = { mount };
})(typeof window !== 'undefined' ? window : this);
