(function () {
  var btn = document.getElementById('menu-btn'), nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  function set(open) { document.body.classList.toggle('menu-open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  btn.addEventListener('click', function () { set(!document.body.classList.contains('menu-open')); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
})();
