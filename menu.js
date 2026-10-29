(function () {
  var btn = document.getElementById('menu-btn'), nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  function set(open) { document.body.classList.toggle('menu-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  btn.addEventListener('click', function () { set(!document.body.classList.contains('menu-open')); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
})();

// the wordmark: FIELD COMPUTER spread letter by letter to the width of OVERCLOCK
document.querySelectorAll('.mark-sub').forEach(function (el) {
  if (el.dataset.spread) return; el.dataset.spread = '1';
  var t = el.textContent, out = '';
  for (var i = 0; i < t.length; i++) out += t[i] === ' ' ? '<i class="gap"></i>' : '<i>' + t[i] + '</i>';
  el.innerHTML = out;
});
