/* phonefinger.js: makes the phone pages in an iframe (phone_demo/) feel like a phone when
   driven by a mouse. OCFinger(iframe) re-applies on every page load inside the frame:
     - no scroll bar
     - the mouse is a fingertip
     - press and drag scrolls the page, with a flick that coasts to a stop
     - a drag never counts as a tap; nothing gets text-selected or picture-dragged
   The pages' own maps (touch-action: none) keep their own dragging. Real touch screens are
   left alone: they already behave like a phone. */
(function () {
  var FINGER = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='16' cy='16' r='12' fill='rgba(255,255,255,.35)' stroke='rgba(255,255,255,.85)' stroke-width='2'/%3E%3C/svg%3E\") 16 16, pointer";
  var PRESS = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ccircle cx='16' cy='16' r='9' fill='rgba(255,255,255,.6)' stroke='rgba(255,255,255,.95)' stroke-width='2'/%3E%3C/svg%3E\") 16 16, pointer";
  function apply(fr) {
    var d, w;
    try { d = fr.contentDocument; w = fr.contentWindow; } catch (e) { return; }
    if (!d || !w || d.getElementById('oc-finger')) return;
    if (!d.documentElement || !w.location || w.location.href === 'about:blank') return;
    var mouse = true;   // always on: the drag code below only answers to a mouse, so touch screens are untouched
    var st = d.createElement('style'); st.id = 'oc-finger';
    st.textContent = 'html{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;width:0;height:0}' +
      (mouse ? '*,*::before,*::after{cursor:' + FINGER + ' !important;-webkit-user-select:none !important;user-select:none !important}' +
               'html.oc-press *,html.oc-press *::before,html.oc-press *::after{cursor:' + PRESS + ' !important}' +
               'input,textarea{-webkit-user-select:text !important;user-select:text !important}' : '');
    (d.head || d.documentElement).appendChild(st);
    if (!mouse) return;

    var root = d.documentElement, down = false, drag = false, y0 = 0, x0 = 0, s0 = 0, lastY = 0, lastT = 0, v = 0, raf = 0;
    function ownDrag(el) {          // the page handles this drag itself (the maps)
      for (; el && el.nodeType === 1; el = el.parentElement) {
        var ta = w.getComputedStyle(el).touchAction;
        if (ta === 'none') return true;
        var tn = el.tagName; if (tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT') return true;
      }
      return false;
    }
    function scroller() { return d.scrollingElement || root; }
    function stopCoast() { if (raf) { w.cancelAnimationFrame(raf); raf = 0; } }
    function coast() {
      v *= 0.95;
      if (Math.abs(v) < 0.02) { raf = 0; return; }
      var sc = scroller(), before = sc.scrollTop;
      sc.scrollTop = before - v * 16;
      if (sc.scrollTop === before) { raf = 0; return; }    // hit the top or bottom
      raf = w.requestAnimationFrame(coast);
    }
    d.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      stopCoast(); root.classList.add('oc-press');
      if (ownDrag(e.target)) return;
      down = true; drag = false; x0 = e.clientX; y0 = lastY = e.clientY; s0 = scroller().scrollTop; lastT = e.timeStamp; v = 0;
    }, true);
    d.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dy = e.clientY - y0, dx = e.clientX - x0;
      if (!drag) { if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx)) return; drag = true; }
      scroller().scrollTop = s0 - dy;
      var dt = e.timeStamp - lastT; if (dt > 0) v = 0.7 * ((e.clientY - lastY) / dt) + 0.3 * v;
      lastY = e.clientY; lastT = e.timeStamp;
    }, true);
    function up(e) {
      root.classList.remove('oc-press');
      if (!down) return; down = false;
      if (!drag) return;
      if (e && e.timeStamp - lastT > 140) v = 0;             // held still before letting go: no flick
      if (Math.abs(v) > 0.05) raf = w.requestAnimationFrame(coast);
    }
    d.addEventListener('pointerup', up, true);
    d.addEventListener('pointercancel', up, true);
    // the mouse let go outside the phone
    try { fr.ownerDocument.addEventListener('pointerup', function () { if (down) up(null); root.classList.remove('oc-press'); }); } catch (e) {}
    d.addEventListener('click', function (e) { if (drag) { drag = false; e.preventDefault(); e.stopPropagation(); } }, true);
    d.addEventListener('dragstart', function (e) { e.preventDefault(); });
    d.addEventListener('wheel', stopCoast, { passive: true });
  }
  // Applied as early as the page inside exists (not only at its load event), and re-checked
  // so every page the visitor taps through to gets it too.
  window.OCFinger = function (fr) {
    fr.addEventListener('load', function () { apply(fr); });
    setInterval(function () { if (fr.isConnected) apply(fr); }, 150);
  };
})();
