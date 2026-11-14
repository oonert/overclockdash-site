// common.js - what the TRIPS and ECONOMY tabs share (2026-11-12). Lives on the
// card at /www/common.js; trips.js and econ.js load it before they draw.
//
// Derek, 2026-11-12 (the trips and economy review): one month picker that
// reads like a calendar ("‹ SEP  OCTOBER 2026  NOV ›", tap the middle for any
// month), maps with pinch and drag only (the + and − fought the pinch), and
// a station's own page needs the same map the TRIPS tab draws. So the map, the
// card reads and the picker live here, once.
(function () {
  'use strict';
  const LT = () => document.documentElement.classList.contains('lt');
  const td = new TextDecoder();

  // ── the card ──────────────────────────────────────────────────────────────
  const fileUrl = (n, d, off, len) => '/file?n=' + encodeURIComponent(n) + (d ? '&d=' + d : '') + (len ? '&off=' + off + '&len=' + len : '');
  async function text(n, d) { const r = await fetch(fileUrl(n, d)); if (!r.ok) throw new Error(n); return r.text(); }
  // a byte range, as 16 KB slices (the dash caps a slice at WIFI_RANGE_MAX_LEN)
  async function bytes(n, d, off, len) {
    const out = new Uint8Array(len); let got = 0;
    while (got < len) {
      const want = Math.min(16384, len - got);
      const r = await fetch(fileUrl(n, d, off + got, want)); if (!r.ok) throw new Error(n);
      const b = new Uint8Array(await r.arrayBuffer()); if (!b.length) break;
      out.set(b, got); got += b.length;
    }
    return got === len ? out : out.subarray(0, got);
  }
  let FILES = null;                         // name -> size, from /manifest
  async function files() {
    if (FILES) return FILES;
    FILES = {}; let s = 0;
    for (let i = 0; i < 20; i++) {
      const r = await fetch('/manifest' + (s ? '?s=' + s : '')); if (!r.ok) break;
      const j = await r.json(); (j.files || []).forEach(f => FILES[f.name] = f.size);
      if (!j.next) break; s = j.next;
    }
    return FILES;
  }
  // a text file cached by name and size: a past month never changes, this one grows
  async function cached(n, size) {
    const k = 'oc_tr_' + n; let c = null;
    try { c = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
    if (c && c.s === size) return c.t;
    const t = await text(n);
    try { if (t.length < 400000) localStorage.setItem(k, JSON.stringify({ s: size, t })); } catch (e) {}
    return t;
  }
  // a whole month of GPS track, thinned to every `step`th point per drive
  async function monthTrack(ym, step) {
    await files(); const n = 'track-' + ym + '.csv'; if (!FILES[n]) return [];
    const out = []; let k = 0, last = '';
    for (const l of (await text(n)).split('\n')) {
      if (!l || l[0] < '0' || l[0] > '9') continue;
      const r = l.split(','); if (r[1] !== last) { last = r[1]; k = 0; }
      if (k++ % (step || 1)) continue;
      out.push({ date: r[0].slice(0, 10), t: r[0].slice(11, 19), id: r[1], lat: +r[2], lon: +r[3], alt: +r[4], kmh: +r[5] });
    }
    return out;
  }

  // ── the base map ──────────────────────────────────────────────────────────
  // basemap.bin (tools/basemap/make_basemap.py): 1-degree tiles, each a list of
  // layers of features; the phone fetches only the tiles in view. basemap_lo
  // is the same for a zoomed-out view (a road trip): fewer, simpler features.
  const BM = { hi: { n: 'basemap.bin' }, lo: { n: 'basemap_lo.bin' } };
  async function bmHead(b) {
    if (b.idx) return true; if (b.miss) return false;
    try {
      const h = await bytes(b.n, 'www', 0, 32); const v = new DataView(h.buffer);
      if (h.length < 32 || td.decode(h.subarray(0, 4)) !== 'OCBM') { b.miss = true; return false; }
      b.lat0 = v.getInt16(6, true); b.lon0 = v.getInt16(8, true); b.rows = v.getUint16(10, true); b.cols = v.getUint16(12, true); b.td = v.getUint8(22) || 1;
      const io = v.getUint32(14, true); const ix = await bytes(b.n, 'www', io, b.rows * b.cols * 8);
      b.idx = new DataView(ix.buffer); b.tiles = new Map(); return true;
    } catch (e) { b.miss = true; return false; }
  }
  async function bmTile(b, r, c) {
    const k = r * b.cols + c; if (b.tiles.has(k)) return b.tiles.get(k);
    const off = b.idx.getUint32(k * 8, true), len = b.idx.getUint32(k * 8 + 4, true);
    let t = null;
    if (len) {
      const d = await bytes(b.n, 'www', off, len); const v = new DataView(d.buffer); let p = 0;
      const nL = v.getUint8(p++); t = { ox: b.lon0 + c * b.td, oy: b.lat0 + r * b.td, L: {} };
      for (let i = 0; i < nL; i++) {
        const layer = v.getUint8(p++), nF = v.getUint16(p, true); p += 2; const fs = [];
        for (let j = 0; j < nF; j++) {
          const cls = v.getUint8(p++), nl = v.getUint8(p++); const name = td.decode(d.subarray(p, p + nl)); p += nl;
          const np = v.getUint16(p, true); p += 2; const pts = new Float32Array(np * 2);
          for (let q = 0; q < np; q++) { pts[q * 2] = t.ox + v.getUint16(p, true) / 65535 * b.td; pts[q * 2 + 1] = t.oy + v.getUint16(p + 2, true) / 65535 * b.td; p += 4; }
          fs.push({ cls, name, pts });
        }
        t.L[layer] = fs;
      }
    }
    b.tiles.set(k, t); return t;
  }
  // The nearest town on the base map, for naming a place in words ("near
  // Woodland"). Looks in the tile under the point and its neighbours.
  async function nearestPlace(lat, lon, maxKm) {
    const b = BM.hi; if (!(await bmHead(b))) return '';
    const r0 = Math.floor((lat - b.lat0) / b.td), c0 = Math.floor((lon - b.lon0) / b.td);
    let best = '', bd = (maxKm || 25) / 111;
    for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
      if (r < 0 || c < 0 || r >= b.rows || c >= b.cols) continue;
      const t = await bmTile(b, r, c); if (!t) continue;
      for (const f of t.L[6] || []) {
        const d = Math.hypot(f.pts[1] - lat, (f.pts[0] - lon) * Math.cos(lat * Math.PI / 180));
        if (d < bd && f.name) { bd = d; best = f.name; }
      }
    }
    return best;
  }
  const PAL = () => LT()
    ? { bg: '#f7f7f9', urban: '#e9e9ec', water: '#bcd6ee', coast: '#9ab8d6', river: '#b7cfe6', road: ['', '#b8b8bd', '#c4c4c8', '#cdcdd1', '#d8d8db', '#e3e3e6'], rw: [0, 3, 2.4, 1.8, 1.2, 1], border: ['', '#9a9aa0', '#c6c6cb'], label: '#777', shield: ['', '#c0392b', '#555', '#777'], ink: '#111', halo: '#fff' }
    : { bg: '#0b0b0b', urban: '#161616', water: '#17283a', coast: '#2e4a66', river: '#1f3448', road: ['', '#5a5a5a', '#4c4c4c', '#424242', '#363636', '#2e2e2e'], rw: [0, 3, 2.4, 1.8, 1.2, 1], border: ['', '#555', '#3a3a3a'], label: '#666', shield: ['', '#c0392b', '#444', '#333'], ink: '#eee', halo: '#000' };

  // A map in a div: the view (centre, scale), the base layers, and pan and
  // pinch. NO + / − BUTTONS (Derek, 2026-11-12: they fought the pinch).
  // onTop.draw(ctx, proj, v) paints what sits on the base; onTop.reserve keeps
  // place labels off the markers. show(bb) moves the view to a box.
  function makeMap(div, bbox, onTop) {
    const cv = document.createElement('canvas'); div.appendChild(cv);
    const ctx = cv.getContext('2d'); let W = 0, H = 0, dpr = 1;
    const v = { lat: (bbox[0] + bbox[1]) / 2, lon: (bbox[2] + bbox[3]) / 2, s: 1 };   // s = px per degree lat
    const kx = () => Math.cos(v.lat * Math.PI / 180);
    const proj = (lat, lon) => [W / 2 + (lon - v.lon) * kx() * v.s, H / 2 - (lat - v.lat) * v.s];
    function size() {
      dpr = Math.min(2, devicePixelRatio || 1); W = div.clientWidth; H = div.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function show(bb, pad) {
      size(); const p = pad == null ? 40 : pad;
      v.lat = (bb[0] + bb[1]) / 2; v.lon = (bb[2] + bb[3]) / 2;
      v.s = Math.min((W - 2 * p) / Math.max(2e-4, (bb[3] - bb[2]) * kx()), (H - 2 * p) / Math.max(2e-4, bb[1] - bb[0]), 400000);
    }
    let drawing = false, again = false;
    async function draw() {
      if (drawing) { again = true; return; } drawing = true;
      try {
        const P = PAL(); ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
        const span = H / v.s;
        const b = span > 2.5 ? BM.lo : BM.hi;
        const used = [[0, H - 30, 260, 30]];                  // the legend
        if (await bmHead(b)) {
          const la0 = v.lat - span / 2 - 0.05, la1 = v.lat + span / 2 + 0.05, lo0 = v.lon - (W / v.s / kx()) / 2 - 0.05, lo1 = v.lon + (W / v.s / kx()) / 2 + 0.05;
          const tiles = [];
          for (let r = Math.max(0, Math.floor((la0 - b.lat0) / b.td)); r <= Math.min(b.rows - 1, Math.floor((la1 - b.lat0) / b.td)); r++)
            for (let c = Math.max(0, Math.floor((lo0 - b.lon0) / b.td)); c <= Math.min(b.cols - 1, Math.floor((lo1 - b.lon0) / b.td)); c++) {
              if (tiles.length < 80) { const t = await bmTile(b, r, c); if (t) tiles.push(t); }
            }
          const z = v.s / 1000;
          const path = pts => { ctx.beginPath(); for (let i = 0; i < pts.length; i += 2) { const [x, y] = proj(pts[i + 1], pts[i]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } };
          const each = (layer, fn) => tiles.forEach(t => (t.L[layer] || []).forEach(fn));
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          ctx.fillStyle = P.urban; each(0, f => { path(f.pts); ctx.closePath(); ctx.fill(); });
          ctx.fillStyle = P.water; each(1, f => { path(f.pts); ctx.closePath(); ctx.fill(); });
          ctx.strokeStyle = P.river; each(3, f => { if (z < 3 && f.cls > 4) return; ctx.lineWidth = f.cls <= 3 ? 1.5 : 1; path(f.pts); ctx.stroke(); });
          ctx.strokeStyle = P.coast; ctx.lineWidth = 1.2; each(2, f => { path(f.pts); ctx.stroke(); });
          const shields = [];
          for (let cls = 5; cls >= 1; cls--) {
            if (z < 0.3 && cls > 1) continue; if (z < 0.8 && cls > 2) continue; if (z < 4 && cls > 3) continue; if (z < 20 && cls > 4) continue;
            ctx.strokeStyle = P.road[cls]; ctx.lineWidth = P.rw[cls] * (z > 40 ? 1.4 : 1);
            each(4, f => { if (f.cls !== cls) return; path(f.pts); ctx.stroke(); if (f.name && z >= 0.3 && (cls <= 2 || z >= 1.2) && f.pts.length >= 6) shields.push(f); });
          }
          each(5, f => { ctx.strokeStyle = P.border[f.cls]; ctx.lineWidth = f.cls === 1 ? 1.6 : 1; ctx.setLineDash(f.cls === 1 ? [] : [4, 3]); path(f.pts); ctx.stroke(); }); ctx.setLineDash([]);
          const free = (x, y, w, h) => { if (x < 2 || y < 2 || x + w > W - 2 || y + h > H - 2) return false; for (const u of used) if (x < u[0] + u[2] + 6 && x + w > u[0] - 6 && y < u[1] + u[3] + 6 && y + h > u[1] - 6) return false; used.push([x, y, w, h]); return true; };
          onTop && onTop.reserve && onTop.reserve(proj, used);
          ctx.font = '700 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const seen = new Set();
          for (const f of shields) {
            const m = f.pts.length >> 2; const [x, y] = proj(f.pts[m * 2 + 1], f.pts[m * 2]);
            const key = f.name + '|' + Math.round(x / 200) + '|' + Math.round(y / 200); if (seen.has(key)) continue;
            const w = ctx.measureText(f.name).width + 10; if (!free(x - w / 2, y - 8, w, 16)) continue; seen.add(key);
            ctx.fillStyle = P.shield[f.cls]; ctx.beginPath(); ctx.roundRect(x - w / 2, y - 8, w, 16, 4); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.fillText(f.name, x, y + 0.5);
          }
          const places = []; each(6, f => places.push(f)); places.sort((a, b) => a.cls - b.cls);
          for (const f of places) {
            if (z < 0.3 && f.cls > 1) continue; if (z < 1.5 && f.cls > 3) continue; if (z < 6 && f.cls > 6) continue; if (z < 20 && f.cls > 8) continue;
            const [x, y] = proj(f.pts[1], f.pts[0]); const big = f.cls <= 2;
            ctx.font = (big ? '700 13px' : '600 11px') + ' system-ui'; const w = ctx.measureText(f.name).width;
            if (!free(x - w / 2, y - 16, w, 14)) continue;
            ctx.fillStyle = P.label; if (!big) { ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
            ctx.fillText(f.name.toUpperCase(), x, y - 9);
          }
        }
        ctx.setLineDash([]); ctx.textAlign = 'left';
        onTop && onTop.draw(ctx, proj, v);
      } finally { drawing = false; if (again) { again = false; draw(); } }
    }
    // pan and pinch
    const ptrs = new Map(); let last = null;
    const dist = () => { const a = [...ptrs.values()]; return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); };
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = ptrs.size === 2 ? dist() : null; });
    cv.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId);
      if (ptrs.size === 1) { v.lon -= (e.clientX - p.x) / (v.s * kx()); v.lat += (e.clientY - p.y) / v.s; }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) { const d = dist(); if (last) v.s = Math.max(200, Math.min(400000, v.s * d / last)); last = d; }
      draw();
    });
    const up = e => { ptrs.delete(e.pointerId); last = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); v.s = Math.max(200, Math.min(400000, v.s * (e.deltaY < 0 ? 1.25 : 0.8))); draw(); }, { passive: false });
    show(bbox); draw(); addEventListener('resize', () => { size(); draw(); });
    return { draw, show, v };
  }

  // What sits on the base: lines (each with a group g), pins and dots. focus
  // is a group: the other lines fade. mark is one extra labelled dot (the
  // top-speed spot, the point under a finger on the speed chart).
  function routeDrawer(lines, pins, dots) {
    return {
      focus: null, mark: null,
      draw(ctx, proj) {
        const P = PAL(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const F = this.focus;
        const order = F == null ? lines : [...lines.filter(l => l.g !== F), ...lines.filter(l => l.g === F)];
        order.forEach(l => {
          if (l.pts.length < 2) return;
          ctx.globalAlpha = F != null && F !== l.g ? 0.2 : 1;
          ctx.beginPath(); l.pts.forEach((p, i) => { const [x, y] = proj(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
          ctx.strokeStyle = P.halo; ctx.lineWidth = 5; ctx.stroke(); ctx.strokeStyle = l.col; ctx.lineWidth = 3; ctx.stroke();
        });
        ctx.globalAlpha = 1;
        ctx.font = '700 12px system-ui'; ctx.textBaseline = 'middle';
        // markers on the same spot (a day that starts and ends at home) share a dot
        const spots = [];
        const vis = d => F == null || d.g == null || d.g === F;
        for (const d of [...dots, ...pins].filter(vis)) {
          const [x, y] = proj(d.lat, d.lon);
          const near = spots.find(s => Math.abs(s.x - x) < 10 && Math.abs(s.y - y) < 10);
          if (near) { if (d.label && !near.labels.includes(d.label)) near.labels.push(d.label); continue; }
          spots.push({ x, y, col: d.col, labels: d.label ? [d.label] : [] });
        }
        if (this.mark) { const [x, y] = proj(this.mark.lat, this.mark.lon); spots.push({ x, y, col: '#ffb000', labels: [this.mark.label], big: 1 }); }
        const Wc = ctx.canvas.width / Math.min(2, devicePixelRatio || 1);
        for (const s of spots) {
          ctx.beginPath(); ctx.arc(s.x, s.y, s.big ? 8 : 6, 0, 7); ctx.fillStyle = s.col; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = P.halo; ctx.stroke();
          const txt = s.labels.length > 1 && s.labels[0] === 'START' && s.labels[1] === 'END' ? ['START · END', ...s.labels.slice(2)] : s.labels;
          txt.forEach((t, i) => {
            const w = ctx.measureText(t).width; const left = s.x + 12 + w > Wc - 4; const y = s.y + i * 15;
            ctx.textAlign = left ? 'right' : 'left'; ctx.fillStyle = P.ink; ctx.strokeStyle = P.halo; ctx.lineWidth = 3; ctx.strokeText(t, s.x + (left ? -12 : 12), y); ctx.fillText(t, s.x + (left ? -12 : 12), y);
          });
        }
        ctx.textAlign = 'left';
      },
      reserve(proj, used) { for (const d of [...dots, ...pins]) { const [x, y] = proj(d.lat, d.lon); used.push([x - 80, y - 8, 160, 40]); } }
    };
  }
  const bboxOf = pts => { const a = [90, -90, 180, -180]; for (const p of pts) { if (p[0] < a[0]) a[0] = p[0]; if (p[0] > a[1]) a[1] = p[0]; if (p[1] < a[2]) a[2] = p[1]; if (p[1] > a[3]) a[3] = p[1]; } return a; };

  // ── the month picker ──────────────────────────────────────────────────────
  // ‹ SEP   OCTOBER 2026   NOV ›  Left is earlier, right is later; an arrow
  // with no month that way is grey. Tap the middle: every month with data.
  const MONL = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const ymName = ym => MONL[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
  const ymShort = ym => MONL[+ym.slice(5, 7) - 1].slice(0, 3);
  const thisYm = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  // months: every month with data, any order. Returns the picker's HTML; bind()
  // after it is in the page. onPick(ym) is called with the month chosen.
  function monthPicker(ym, months, onPick) {
    const ms = [...new Set([...months, thisYm()])].sort();
    const i = ms.indexOf(ym), pv = i > 0 ? ms[i - 1] : null, nx = i >= 0 && i + 1 < ms.length ? ms[i + 1] : null;
    const id = 'mp' + Math.random().toString(36).slice(2, 7);
    const html = `<div class=ocmp id=${id}><button class=oa ${pv ? '' : 'disabled'} data-m="${pv || ''}">‹ ${pv ? ymShort(pv) : ''}</button><button class=om>${ymName(ym)}<i>▾</i></button><button class=oa ${nx ? '' : 'disabled'} data-m="${nx || ''}">${nx ? ymShort(nx) : ''} ›</button></div>`;
    function bind() {
      const el = document.getElementById(id); if (!el) return;
      el.querySelectorAll('.oa').forEach(b => b.onclick = () => b.dataset.m && onPick(b.dataset.m));
      el.querySelector('.om').onclick = () => {
        const ov = document.createElement('div'); ov.className = 'ocov';
        let h = '<div class=ocls><b>PICK A MONTH</b>';
        let yr = '';
        for (const m of ms.slice().reverse()) { if (m.slice(0, 4) !== yr) { yr = m.slice(0, 4); h += `<small>${yr}</small>`; } h += `<button data-m="${m}" class="${m === ym ? 'on' : ''}">${MONL[+m.slice(5, 7) - 1]}${m === thisYm() ? '<i>THIS MONTH</i>' : ''}</button>`; }
        ov.innerHTML = h + '<button class=x>CLOSE</button></div>';
        ov.onclick = e => { const m = e.target.closest('button')?.dataset.m; if (m) { ov.remove(); onPick(m); } else if (e.target === ov || e.target.classList.contains('x')) ov.remove(); };
        document.body.appendChild(ov);
      };
    }
    return { html, bind };
  }

  // ── shared styles ─────────────────────────────────────────────────────────
  const css = document.createElement('style');
  css.textContent = `
.ocmp{display:flex;align-items:stretch;gap:6px;margin:0 0 10px}.ocmp button{height:48px;border:0;background:#1c1c1c;color:inherit;font:700 14px system-ui;padding:0;margin:0;width:auto}
.ocmp .oa{flex:0 0 76px;color:#ffb000}.ocmp .oa:disabled{color:#555;background:#121212;opacity:1}.ocmp .om{flex:1;font:800 19px var(--cd,system-ui);letter-spacing:.3px}.ocmp .om i{font-style:normal;color:#949494;font-size:12px;margin-left:6px}
.ocov{position:fixed;inset:0;background:#000b;z-index:50;display:flex;align-items:flex-end}.ocls{background:#151515;width:100%;max-height:70vh;overflow:auto;border-radius:16px 16px 0 0;padding:16px 16px 30px}
.ocls b{display:block;color:#ffb000;font:800 16px system-ui;margin-bottom:6px}.ocls small{display:block;color:#949494;font:700 12px system-ui;margin:12px 0 4px}
.ocls button{height:auto;border-radius:0;display:flex;justify-content:space-between;width:100%;border:0;border-bottom:1px solid #222;background:none;color:inherit;font:700 17px system-ui;padding:12px 4px;text-align:left}.ocls button.on{color:#ffb000}.ocls button i{font:600 11px system-ui;color:#949494;font-style:normal}
.ocls .x{justify-content:center;color:#ffb000;border:0;margin-top:10px;background:none}
html.lt .ocmp button{background:#eceef2}html.lt .ocmp .oa:disabled{background:#f4f4f6;color:#bbb}html.lt .ocls{background:#fff}html.lt .ocls button{border-color:#e4e4e7}`;
  document.head.appendChild(css);

  // ── desktop view (2026-11-13) ─────────────────────────────────────────────
  // Derek: "there's no desktop view". The same pages on a computer: past
  // WIDE px the pages lay out in columns. TRIPS: the map on the left, the
  // list on the right. ECONOMY and TRUCK: the sections side by side. Only
  // CSS and regrouping; the pages draw exactly what they draw on a phone.
  const WIDE = 1000;
  const wide = () => innerWidth >= WIDE;
  const wcss = document.createElement('style');
  wcss.textContent = `
html.wd body{max-width:1440px;margin:0 auto}
html.wd .ocov{align-items:center;justify-content:center}html.wd .ocls{width:460px;border-radius:16px;max-height:80vh}
html.wd.p-tr #T .tw{display:flex;gap:20px;align-items:flex-start}html.wd.p-tr #T .tw>.wl{flex:1;min-width:0;position:sticky;top:8px;z-index:5}html.wd.p-tr #T .tw>.wr{flex:0 0 440px;min-width:0}
html.wd.p-tr #T .wl>.pin{position:static;padding-top:0}html.wd.p-tr #T .wl .mp{height:calc(100vh - 300px);min-height:360px;max-height:none}
html.wd.p-tr #T .wr>.cd:first-child,html.wd.p-tr #T .wr>.st:first-child{margin-top:0}
html.wd nav{z-index:20}
html.wd #T .lg2{display:grid;grid-template-columns:1fr 1fr;gap:0 20px;align-items:start}html.wd #T .lg2 h3:first-child{margin-top:0}
html.wd #T .ws{column-count:2;column-gap:20px}
html.wd #T .ws>.sec{break-inside:avoid;display:flow-root;min-width:0}html.wd #T .ws>.sec.all{column-span:all}
html.wd #T .gr svg{max-height:340px}
html.wd.p-tk #T .gr2{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px}html.wd.p-tk #T .gr2>.gr{margin:0}`;
  document.head.appendChild(wcss);
  const page = OCD.path.replace('/', '') || 'tr';
  // TRIPS: the map (the pinned block) on the left, the rest on the right; the
  // back link above, the speed chart and the downloads under both
  function regroupTrips(T) {
    const old = T.querySelector(':scope>.tw');
    if (old) {
      if ([...T.children].every(x => x === old || x.classList.contains('bk') || x.id === 'G' || x.classList.contains('dls'))) return;
      const flat = [...old.querySelectorAll(':scope>div>*')]; const rest = [...T.children].filter(x => x !== old);
      old.remove(); [...rest.filter(x => x.classList.contains('bk')), ...flat, ...rest.filter(x => !x.classList.contains('bk'))].forEach(x => T.appendChild(x));
    }
    const pin = T.querySelector(':scope>.pin'); if (!pin) return;
    const tw = document.createElement('div'); tw.className = 'tw';
    const l = document.createElement('div'); l.className = 'wl'; const r = document.createElement('div'); r.className = 'wr';
    tw.append(l, r); pin.before(tw); l.appendChild(pin);
    const below = [];
    for (const k of [...T.children]) {
      if (k === tw || k.classList.contains('bk')) continue;
      if (k.id === 'G' || k.classList.contains('dls')) below.push(k); else r.appendChild(k);
    }
    below.forEach(x => T.appendChild(x));
    dispatchEvent(new Event('resize'));
  }
  // group the page's flat list into sections, each starting at a heading
  function regroup(T) {
    if (!wide()) return;
    if (page === 'tr') return regroupTrips(T);
    const old = T.querySelector(':scope>.ws');
    if (old) {   // something new arrived after the last grouping: flatten, then group again
      if (T.children.length === 1) return;
      const flat = [...old.querySelectorAll(':scope>.sec>*,:scope>.sec>.gr2>*')].filter(x => !x.classList.contains('gr2'));
      const rest = [...T.children].filter(x => x !== old); old.remove(); flat.concat(rest).forEach(x => T.appendChild(x));
    }
    const kids = [...T.children]; if (!kids.length) return;
    const ws = document.createElement('div'); ws.className = 'ws';
    let sec = null, n = 0;
    const open = (all) => { sec = document.createElement('div'); sec.className = 'sec' + (all ? ' all' : ''); ws.appendChild(sec); n++; };
    for (const k of kids) {
      if (k.tagName === 'H3' || !sec) open(page === 'tk' && !sec);
      // the TRUCK tab bar and day picker run full width; on PARKED the charts pair up
      if (page === 'tk' && (k.classList.contains('sg3') || k.classList.contains('pkr'))) { if (sec.children.length) open(true); sec.classList.add('all'); }
      sec.appendChild(k);
    }
    if (page === 'tk') ws.querySelectorAll('.sec').forEach(s => {
      const g = [...s.children].filter(c => c.classList.contains('gr'));
      if (g.length > 1 && !s.querySelector('h3')) { const w = document.createElement('div'); w.className = 'gr2'; g[0].before(w); g.forEach(c => w.appendChild(c)); s.classList.add('all'); }
    });
    // a lone section left over on the right: let it run full width
    const secs = [...ws.children].filter(x => !x.classList.contains('all'));
    if (secs.length % 2 && secs.length > 1 && secs[secs.length - 1].children.length < 3) secs[secs.length - 1].classList.add('all');
    T.appendChild(ws);
  }
  function setWide() {
    document.documentElement.classList.toggle('wd', wide());
    document.documentElement.classList.add('p-' + page);
  }
  setWide(); addEventListener('resize', setWide);
  const watch = () => {
    const T = document.getElementById('T'); if (!T) return;
    let t = 0; const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { mo.disconnect(); regroup(T); mo.observe(T, { childList: true }); }, 60); });
    mo.observe(T, { childList: true }); regroup(T);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', watch); else watch();

  // a computer with a mouse: charts follow the pointer and the hints say "mouse"
  const MOUSE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  // A ZIP of a few small text files, made here (store only: no packing, the
  // files are a few KB). For the SUMMARY download: no work for the clock.
  function zipFiles(list) {
    const enc = new TextEncoder(), T = [];
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
    const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
    const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
    const parts = [], cen = []; let off = 0;
    for (const f of list) {
      const nm = enc.encode(f.name), data = enc.encode(f.text), c = crc(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
      h.setUint32(14, c, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
      parts.push(h, nm, data);
      const ce = new DataView(new ArrayBuffer(46));
      ce.setUint32(0, 0x02014b50, true); ce.setUint16(4, 20, true); ce.setUint16(6, 20, true); ce.setUint16(12, dt, true); ce.setUint16(14, dd, true);
      ce.setUint32(16, c, true); ce.setUint32(20, data.length, true); ce.setUint32(24, data.length, true); ce.setUint16(28, nm.length, true); ce.setUint32(42, off, true);
      cen.push(ce, nm); off += 30 + nm.length + data.length;
    }
    const csz = cen.reduce((a, x) => a + x.byteLength, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, list.length, true); e.setUint16(10, list.length, true); e.setUint32(12, csz, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cen, e], { type: 'application/zip' });
  }
  function save(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

  addEventListener('hashchange', () => document.querySelectorAll('.ocov').forEach(x => x.remove()));
  window.OC = { MOUSE, zipFiles, save, fileUrl, text, bytes, files, cached, monthTrack, makeMap, routeDrawer, bboxOf, nearestPlace, monthPicker, ymName, ymShort, thisYm, LT, PAL };
})();
