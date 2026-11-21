/* phoneview.js: the clock's phone view (phone_demo/) on the home page.
   Computer: runs inside the drawn phone in the page, started by a tap.
   Phone (900 px or narrower): opens full screen with a Back bar; no phone drawn in a phone.
   Nothing loads until the visitor asks for it. */
(function () {
  var SRC = 'phone_demo/index.html';
  function small() { return window.innerWidth <= 900; }
  function finger(fr) { if (window.OCFinger) window.OCFinger(fr); }
  function frame() {
    var fr = document.createElement('iframe');
    fr.title = 'OVERCLOCK phone view'; fr.src = SRC; finger(fr); return fr;
  }
  // full screen, for phones
  var full = null, opener = null;
  function openFull(btn) {
    opener = btn || null;
    if (!full) {
      full = document.createElement('div'); full.className = 'pvf'; full.setAttribute('role', 'dialog'); full.setAttribute('aria-label', 'OVERCLOCK phone view');
      var bar = document.createElement('div'); bar.className = 'pvf-bar';
      var back = document.createElement('button'); back.type = 'button'; back.className = 'pvf-back'; back.innerHTML = '&lsaquo; Back';
      back.addEventListener('click', closeFull); bar.appendChild(back);
      var tip = document.createElement('span'); tip.className = 'pvf-tip'; tip.textContent = 'Swipe and tap like any phone page'; bar.appendChild(tip);
      full.appendChild(bar); full.appendChild(frame()); document.body.appendChild(full);
    }
    full.hidden = false; document.body.classList.add('pvf-on'); full.querySelector('.pvf-back').focus();
  }
  function closeFull() { if (!full) return; full.hidden = true; document.body.classList.remove('pvf-on'); if (opener) opener.focus(); }
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && full && !full.hidden) closeFull(); });
  // inline, for computers: a pointer to the phone that says how to drive it, gone at the first touch
  function showHint(fr) {
    var hint = document.querySelector('.pvh-hint');
    if (!hint) return;
    hint.hidden = false;
    function hide() { hint.classList.add('pvh-hint-out'); setTimeout(function () { hint.hidden = true; }, 400); }
    try { fr.contentWindow.addEventListener('mousedown', hide, { once: true }); } catch (e) {}
    fr.addEventListener('load', function () { if (!hint.hidden) hide(); }, { once: true });
  }
  function startInline(scr) {
    if (scr.querySelector('iframe')) return;
    var img = scr.querySelector('img'), go = scr.querySelector('.pvh-start');
    var fr = frame(); scr.appendChild(fr);
    fr.addEventListener('load', function () { if (img) img.remove(); if (go) go.remove(); showHint(fr); }, { once: true });
  }
  document.querySelectorAll('[data-pv]').forEach(function (b) {
    b.addEventListener('click', function () {
      var scr = document.querySelector('.pvh-scr');
      if (small() || !scr) openFull(b); else { startInline(scr); scr.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
  });
})();
