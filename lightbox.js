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
    i = (k + set.length) % set.length; const im = set[i]; if (typeof resetZoom === 'function') resetZoom();
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
  const xb = zv.querySelector('.zv-x');
  xb.onclick = close;
  xb.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); close(); }, { passive: false });
  zv.querySelector('.zv-prev').onclick = () => show(i - 1);
  zv.querySelector('.zv-next').onclick = () => show(i + 1);
  zv.addEventListener('click', (e) => { if ((e.target === zv || e.target.tagName === 'FIGURE') && !zv.classList.contains('zoomed')) close(); });
  document.addEventListener('keydown', (e) => { if (!zv.classList.contains('on')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') show(i - 1); if (e.key === 'ArrowRight') show(i + 1); });
  // Pinch to zoom, drag to pan, double-tap to zoom in or out. The site turns
  // off the browser's own pinch (it breaks the live clock), so the viewer does it.
  let sc = 1, tx = 0, ty = 0, pinch = null, pan = null, tap = null, lastTap = null;
  const apply = () => { vimg.style.transform = sc === 1 ? '' : 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')'; zv.classList.toggle('zoomed', sc > 1); };
  const resetZoom = () => { sc = 1; tx = 0; ty = 0; apply(); };
  const center = () => { const r = vimg.getBoundingClientRect(); return { x: r.left + r.width / 2 - tx, y: r.top + r.height / 2 - ty }; };
  const zoomAt = (px, py, s2) => { const c = center(), X = px - c.x, Y = py - c.y; tx = X - (X - tx) * s2 / sc; ty = Y - (Y - ty) * s2 / sc; sc = s2; if (sc <= 1.02) { sc = 1; tx = 0; ty = 0; } apply(); };
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  zv.addEventListener('touchstart', (e) => {
    if (e.target.closest('.zv-x')) return;
    const t = e.touches;
    if (t.length === 2) { pinch = { d: dist(t), s: sc }; pan = null; x0 = null; return; }
    if (t.length === 1) {
      tap = { x: t[0].clientX, y: t[0].clientY, t: Date.now() };
      if (sc > 1) pan = { x: t[0].clientX, y: t[0].clientY, tx, ty }; else x0 = t[0].clientX;
    }
  }, { passive: false });
  zv.addEventListener('touchmove', (e) => {
    const t = e.touches;
    if (pinch && t.length === 2) { e.preventDefault(); const mx = (t[0].clientX + t[1].clientX) / 2, my = (t[0].clientY + t[1].clientY) / 2; zoomAt(mx, my, Math.min(5, Math.max(1, pinch.s * dist(t) / pinch.d))); return; }
    if (pan && t.length === 1) { e.preventDefault(); tx = pan.tx + t[0].clientX - pan.x; ty = pan.ty + t[0].clientY - pan.y; apply(); }
  }, { passive: false });
  zv.addEventListener('touchend', (e) => {
    const wasPinch = !!pinch;
    if (e.touches.length < 2) pinch = null;
    if (!e.touches.length) pan = null;
    // A quick, still tap on the photo; two of them close together is a double-tap.
    const c = e.changedTouches[0];
    if (tap && !wasPinch && !e.touches.length && Date.now() - tap.t < 250 && Math.hypot(c.clientX - tap.x, c.clientY - tap.y) < 10 && e.target === vimg) {
      if (lastTap && Date.now() - lastTap.t < 320 && Math.hypot(c.clientX - lastTap.x, c.clientY - lastTap.y) < 40) {
        e.preventDefault(); zoomAt(c.clientX, c.clientY, sc > 1 ? 1 : 2.5); lastTap = null; tap = null; x0 = null; return;
      }
      lastTap = { x: c.clientX, y: c.clientY, t: Date.now() };
    } else lastTap = null;
    tap = null;
    if (x0 == null || sc > 1 || set.length < 2) { x0 = null; return; }
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
  }, { passive: false });
  zv.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.min(5, Math.max(1, sc * (e.deltaY < 0 ? 1.1 : 0.9)))); }, { passive: false });
  zv.addEventListener('dblclick', (e) => { if (e.target === vimg) zoomAt(e.clientX, e.clientY, sc > 1 ? 1 : 2.5); });
})();
