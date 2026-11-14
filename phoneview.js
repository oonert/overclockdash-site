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
      full.appendChild(bar); full.appendChild(frame()); document.body.appendChild(full);
    }
    full.hidden = false; document.body.classList.add('pvf-on'); full.querySelector('.pvf-back').focus();
  }
  function closeFull() { if (!full) return; full.hidden = true; document.body.classList.remove('pvf-on'); if (opener) opener.focus(); }
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && full && !full.hidden) closeFull(); });
  // inline, for computers
  function startInline(scr) {
    if (scr.querySelector('iframe')) return;
    var img = scr.querySelector('img'), go = scr.querySelector('.pvh-start');
    var fr = frame(); scr.appendChild(fr);
    fr.addEventListener('load', function () { if (img) img.remove(); if (go) go.remove(); }, { once: true });
  }
  document.querySelectorAll('[data-pv]').forEach(function (b) {
    b.addEventListener('click', function () {
      var scr = document.querySelector('.pvh-scr');
      if (small() || !scr) openFull(b); else { startInline(scr); scr.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    });
  });
})();
