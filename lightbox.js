/* One photo viewer for the whole site. Tap any photo to see it big; the X,
   the background, or Escape closes it. Arrows (computer) or a swipe (phone)
   step through the other photos in the same section. Locks the page behind it
   so iPhone Safari doesn't scroll underneath. */
(function () {
  'use strict';
  const skip = (img) => img.closest('[aria-hidden="true"], .lb, .zv, header, nav') ||
    (img.closest('a[href]') && !img.closest('.photo-band')) ||
    (img.naturalWidth && img.naturalWidth < 100);
  const all = Array.from(document.querySelectorAll('main img, section img')).filter((im, k, a) => a.indexOf(im) === k && !skip(im));
  if (!all.length) return;
  const full = (im) => { const h = im.closest('[data-full]'); return h ? h.dataset.full : (im.currentSrc || im.src); };
  const capOf = (im) => { const h = im.closest('[data-cap]'); if (h) return h.dataset.cap; const f = im.closest('figure'); const c = f && f.querySelector('figcaption'); return c ? c.textContent.trim() : ''; };
  const groupOf = (im) => im.closest('[data-group], section, main') || document.body;

  const zv = document.createElement('div');
  zv.className = 'zv'; zv.setAttribute('role', 'dialog'); zv.setAttribute('aria-modal', 'true'); zv.setAttribute('aria-label', 'Photo');
  zv.innerHTML = '<button class="zv-x" type="button" aria-label="Close">&times;</button><button class="zv-nav zv-prev" type="button" aria-label="Previous photo">&larr;</button><figure><img alt=""><figcaption></figcaption></figure><button class="zv-nav zv-next" type="button" aria-label="Next photo">&rarr;</button>';
  document.body.appendChild(zv);
  const vimg = zv.querySelector('img'), vcap = zv.querySelector('figcaption');
  let set = [], i = 0, y = 0, x0 = null, opener = null;

  function show(k) {
    i = (k + set.length) % set.length; const im = set[i];
    vimg.src = full(im); vimg.alt = im.alt || '';
    const c = capOf(im); vcap.textContent = c + (set.length > 1 ? (c ? '   ' : '') + (i + 1) + ' / ' + set.length : '');
    zv.classList.toggle('single', set.length < 2);
    if (set.length > 1) new Image().src = full(set[(i + 1) % set.length]);
  }
  function open(im) {
    const g = groupOf(im); set = all.filter(x => groupOf(x) === g); opener = im;
    show(set.indexOf(im));
    y = window.scrollY; document.body.style.position = 'fixed'; document.body.style.top = -y + 'px'; document.body.style.left = '0'; document.body.style.right = '0';
    zv.classList.add('on'); zv.querySelector('.zv-x').focus({ preventScroll: true });
  }
  function close() {
    zv.classList.remove('on'); vimg.removeAttribute('src');
    document.body.style.position = ''; document.body.style.top = ''; document.body.style.left = ''; document.body.style.right = '';
    window.scrollTo({ top: y, left: 0, behavior: 'instant' });
  }
  all.forEach(im => {
    im.classList.add('zoomable');
    const target = im.closest('button, a') || im;
    target.addEventListener('click', (e) => { if (e.defaultPrevented) return; e.preventDefault(); open(im); });
  });
  zv.querySelector('.zv-x').onclick = close;
  zv.querySelector('.zv-prev').onclick = () => show(i - 1);
  zv.querySelector('.zv-next').onclick = () => show(i + 1);
  zv.addEventListener('click', (e) => { if (e.target === zv || e.target.tagName === 'FIGURE') close(); });
  document.addEventListener('keydown', (e) => { if (!zv.classList.contains('on')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1); });
  zv.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  zv.addEventListener('touchend', (e) => { if (x0 == null || set.length < 2) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
})();
