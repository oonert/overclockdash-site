// trips.js - the phone's TRIPS tab (2026-11-06). Lives on the card at
// /www/trips.js and is loaded by the /tr shell (wifi_page.h PAGE_TRIPS). The
// map, the card reads and the month picker are in /www/common.js.
//
// Derek: "a trips page that shows a break down of drives by day. And showing
// a map?" Everything here is drawn by the phone from the card's own logs,
// fetched through /file (whole files, or off= / len= slices):
//   trips-YYYY-MM.csv     a row a minute per drive -> the day list, each drive
//   track-YYYY-MM.csv     a GPS point every 20 s   -> the route on the map
//   fuellog.csv           fill-ups                 -> the pins and the costs
//   roadtrips.csv, roadtrip-days.csv               -> the road trip pages
//   www/basemap.bin, www/basemap_lo.bin            -> the map under it all
// The clock computes nothing for this page: it only serves bytes.
//
// 2026-11-12, Derek's review: the map stays pinned at the top while the list
// scrolls under it; tap a day (or a trip, or a drive) and the map shows just
// that; road trips moved to their own page (they are rare, the days are
// daily); the month picker reads like a calendar; anything that looks like a
// button does something, and the rest is drawn flat; START / END on the map,
// never a state code.
//
// PAGES (by location.hash): '' or #m=YYYY-MM  the month: map, totals, days
//                           #d=YYYY-MM-DD     one day
//                           #r                the road trips
//                           #t=<start_unix>   one road trip
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const T = $('#T');
  const MI = 0.621371, FT = 3.28084;
  let OC = null;
  const title = (t, extra) => { const h = $('h1.pt'); if (h) { h.textContent = t; if (extra) h.insertAdjacentHTML('beforeend', extra); } };

  // ── styles (the page's own; /h gives the header, the tab bar and light mode) ──
  const css = document.createElement('style');
  css.textContent = `
#T{padding-bottom:12px}
h1.pt{display:flex;justify-content:space-between;align-items:center}h1.pt .rtl{font:700 13px system-ui;color:#ffb000;border:1.5px solid #ffb000;border-radius:16px;padding:5px 11px;text-decoration:none;letter-spacing:.3px}
#T h3{font:800 18px var(--cd,system-ui);color:#ffb000;text-transform:uppercase;margin:22px 0 8px;display:flex;justify-content:space-between;align-items:baseline}#T h3 span{color:#949494;font:600 12px system-ui}
#T .bk{display:block;color:#ffb000;font:700 14px system-ui;margin:-4px 0 10px;text-decoration:none}
#T .pin{position:sticky;top:0;z-index:5;background:#000;padding:6px 0 8px}
#T .cd{background:#141414;border-radius:12px;padding:16px;margin:0 0 10px}
#T .rw{display:flex;justify-content:space-between;align-items:center;background:#141414;border-radius:12px;padding:13px 14px;margin-bottom:8px;color:inherit;text-decoration:none;cursor:pointer}
#T .rw .l{min-width:0;flex:1}#T .rw .l b{display:block;font-size:18px}#T .rw .l small{color:#949494;font-size:13px;display:block}
#T .rw .r{text-align:right;flex:none;margin-left:10px}#T .rw .r b{font-size:20px;display:block}#T .rw .r small{color:#949494;font-size:12px}
#T .ch{color:#666;margin-left:8px;font-size:20px;flex:none}
#T .rw .go{display:none;flex:none;margin-left:10px;color:#111;background:#ffb000;border-radius:8px;padding:7px 10px;font:800 13px system-ui;text-decoration:none}
#T .rw.sel{outline:2px solid #ffb000;background:#1d1a10}#T .rw.sel *{background:transparent}#T .rw.sel .go{display:block;background:#ffb000}#T .rw.sel .ch{display:none}
#T .big{font:800 42px system-ui;line-height:1}#T .big small{font:700 16px system-ui;color:#949494;margin-left:6px}
#T .st{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}#T .st>div{border-radius:10px;padding:10px 6px;text-align:center}
#T .st>div.tp{background:#1c1c1c;cursor:pointer}#T .st>div.tp small:after{content:' ›';color:#ffb000}
#T .st b{display:block;font-size:19px}#T .st small{color:#949494;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
#T .mp{background:#0b0b0b;border-radius:12px;overflow:hidden;position:relative;height:34vh;min-height:210px;max-height:340px;touch-action:none}#T .mp canvas{display:block;width:100%;height:100%}
#T .lg{position:absolute;left:10px;bottom:8px;display:flex;gap:10px;font-size:12px;color:#aaa;pointer-events:none}#T .lg i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}
#T .sall{position:absolute;right:8px;top:8px;display:none;border:0;border-radius:16px;background:#ffb000;color:#111;font:800 12px system-ui;padding:0 12px;height:30px;width:auto}#T .mp.fo .sall{display:block}
#T .dls{display:flex;gap:8px;margin:16px 0}#T .dls .btn{margin:0;padding:12px 4px;font-size:15px}#T .dls .btn small{display:block;font:600 11px system-ui;color:#949494;margin-top:2px}
#T .btn{display:block;text-align:center;border:2px solid #ffb000;color:#ffb000;border-radius:12px;padding:14px;font:800 18px system-ui;margin:16px 0;background:none;width:100%}
#T table{width:100%;border-collapse:collapse;font-size:15px}#T td,#T th{padding:9px 6px;border-bottom:1px solid #222;text-align:right}#T td:first-child,#T th:first-child{text-align:left}#T th{color:#949494;font-weight:600;font-size:11px;text-transform:uppercase}
#T tr.dy{cursor:pointer}#T tr.dy.sel td{color:#ffb000}#T tr.dy td:last-child:after{content:' ›';color:#666}
#T .sts{font:700 16px system-ui;letter-spacing:.5px}#T .sts i{color:#555;font-style:normal;margin:0 6px}
#T .gr{background:#141414;border-radius:12px;padding:10px 10px 4px;margin-bottom:10px}#T .gr small{color:#949494;font-size:11px;text-transform:uppercase;letter-spacing:.5px}#T .gr svg{display:block;width:100%}#T .gr.sc{touch-action:none}
#T .nt{color:#949494;padding:14px 0}#T .er{color:#ffb000}#T .hint{color:#949494;font-size:12px;margin:2px 2px 0}
#T .rw.dv .l{display:block}#T .rw.dv .l b{display:inline}#T .rw.dv .l small{margin-top:3px}#T .dvt{display:flex;align-items:center;gap:10px;margin-top:8px}
#T .mk{flex:none;border:1.5px dashed #555;background:none;color:#949494;border-radius:8px;padding:6px 9px;font:800 12px system-ui;width:auto;height:auto;letter-spacing:.4px;cursor:pointer}
#T .mk.W{border:0;background:#2b6fd6;color:#fff}#T .mk.P{border:0;background:#333;color:#ddd}
#T .rw .nte{color:#cfcfcf;font-size:14px;font-style:italic;min-width:0}
#T .wk{display:flex;gap:6px;margin-top:10px;font:600 13px system-ui;color:#949494;align-items:center;flex-wrap:wrap}#T .wk b{color:#eee}#T .wk i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:4px;font-style:normal}
#T .wk a{margin-left:auto;color:#ffb000;font:800 13px system-ui;text-decoration:none}
.mks{display:flex;gap:8px;margin:12px 0}.ocls .mks button{flex:1;height:52px;border-radius:12px!important;display:flex;align-items:center;border:2px solid #555;background:#222;color:#ddd;font:800 16px system-ui;justify-content:center;text-align:center;padding:0}.ocls .mks button.on.W{background:#2b6fd6;border-color:#2b6fd6;color:#fff}.ocls .mks button.on.P{background:#555;border-color:#555;color:#fff}
.ocls .qk{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.ocls .qk button{width:auto;border:1.5px solid #444!important;border-radius:16px!important;padding:7px 11px;font:800 12px system-ui;color:#ddd;display:inline-block}.ocls .qk button.on{background:#ffb000;color:#111;border-color:#ffb000!important}
.ocls .dr{display:flex;gap:8px}.ocls .dr label{display:block!important;flex:1 1 0;min-width:0;padding:0!important;background:none!important;margin:0!important;font:700 11px system-ui;color:#949494;letter-spacing:.5px}.ocls .dr input{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;margin-top:4px;background:#0b0b0b;color:#eee;border:1.5px solid #333;border-radius:10px;padding:10px;font:16px system-ui;color-scheme:dark}
.ocls .kd{margin-top:12px}.ocls .kd button{display:block;text-align:left;white-space:normal;height:auto;width:100%;border:2px solid #333!important;border-radius:12px!important;padding:12px;margin-bottom:8px;background:#1b1b1b}.ocls .kd button.on{border-color:#ffb000!important;background:#1d1a10}.ocls .kd button b{color:#eee;font:800 16px system-ui;margin:0}.ocls .kd button.on b{color:#ffb000}.ocls .kd button i{display:block;white-space:normal!important;overflow:visible;font:500 13px system-ui;color:#aaa;margin-top:4px;font-style:normal}
.ocls textarea{width:100%;box-sizing:border-box;background:#0b0b0b;color:#eee;border:1.5px solid #333;border-radius:10px;padding:10px;font:16px system-ui;height:84px;min-height:0;resize:none;margin:0}
.ocls button.sv{display:flex;width:100%;height:50px;margin-top:12px;border:0;border-radius:12px!important;align-items:center;background:#ffb000;color:#111;font:800 17px system-ui;justify-content:center}
html.lt #T .pin{background:#f4f2ec}html.lt #T .cd,html.lt #T .rw,html.lt #T .gr{background:#fff}html.lt #T .st>div.tp{background:#eceef2}html.lt #T td,html.lt #T th{border-color:#ddd}
html.lt #T .mp{background:#f7f7f9}html.lt #T .lg{color:#555}html.lt #T .big{color:#111}html.lt #T .rw.sel{background:#fff7e0}`;
  document.head.appendChild(css);

  // ── the logs ──────────────────────────────────────────────────────────────
  let FILES = {};
  const csv = t => t.split('\n').filter((l, i) => l && l[0] !== '#' && !(i === 0 && /^[a-z_]+,/.test(l))).map(l => l.split(','));   // drop blank, comment and header rows
  const months = () => Object.keys(FILES).filter(n => /^trips-\d{4}-\d{2}\.csv$/.test(n)).map(n => n.slice(6, 13)).sort().reverse();
  // drives of a month: {id, date, start, mins, mi, avg, top, cool, place}
  async function drives(ym) {
    const n = 'trips-' + ym + '.csv'; if (!FILES[n]) return [];
    const rows = csv(await OC.cached(n, FILES[n])); const m = new Map();
    for (const r of rows) {
      const id = r[0]; let d = m.get(id);
      if (!d) { d = { id, date: id.slice(0, 10), start: id.slice(11, 16), odo0: +r[6], top: 0, cool: 0, place: '' }; m.set(id, d); }
      d.secs = +r[1]; d.odo1 = +r[6]; d.top = Math.max(d.top, +r[4] || 0); d.cool = Math.max(d.cool, +r[5] || 0); if (r[10]) d.place = r[10];
    }
    const out = [];
    for (const d of m.values()) {
      d.mi = Math.max(0, (d.odo1 - d.odo0) * MI); d.mins = Math.round(d.secs / 60);
      d.avg = d.secs > 60 ? d.mi / (d.secs / 3600) : 0; d.topMph = d.top * MI;
      if (d.mi >= 0.1 || d.mins >= 2) out.push(d);
    }
    return out.sort((a, b) => a.id < b.id ? -1 : 1);
  }
  // ── drive marks (2026-11-13): WORK or PERSONAL plus a note, per drive ─────
  // Derek: mark each drive, totals by month and year, a mileage log to hand
  // in. Kept on the card in /app/marks.csv (POST /upmk writes the whole file,
  // the clock keeps the old copy as marks.bak). A drive is keyed by its
  // drive_id (its start time), the same key the logs use.
  let MARKS = null;
  const MK_HEAD = '# OVERCLOCK mark v1\ndrive_id,type,note\n';
  function csvLine(l) { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; }
  async function marks() {
    if (MARKS) return MARKS; MARKS = new Map();
    try { const r = await fetch(OC.fileUrl('marks.csv', 'app')); if (r.ok) for (const l of (await r.text()).split('\n')) { if (!l || l[0] === '#' || l.startsWith('drive_id')) continue; const c = csvLine(l); if (c[1] === 'W' || c[1] === 'P') MARKS.set(c[0], { type: c[1], note: c[2] || '' }); } } catch (e) {}
    return MARKS;
  }
  async function saveMarks() {
    const q = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const body = MK_HEAD + [...MARKS.entries()].sort().map(([id, m]) => id + ',' + m.type + ',' + q(m.note.replace(/\n/g, ' '))).join('\n') + '\n';
    const r = await fetch('/upmk', { method: 'POST', body }); if (!r.ok) throw new Error('save failed');
  }
  const MKN = { W: 'WORK', P: 'PERSONAL' };
  const mkBtn = id => { const m = MARKS.get(id); return `<button class="mk ${m ? m.type : ''}" data-id="${id}">${m ? MKN[m.type] : '+ MARK'}</button>`; };
  // the sheet: WORK / PERSONAL, a note, SAVE (or CLEAR to unmark)
  function markSheet(d, label, done) {
    const m = MARKS.get(d.id) || { type: '', note: '' }; let ty = m.type;
    const ov = document.createElement('div'); ov.className = 'ocov';
    ov.innerHTML = `<div class=ocls><b>${label}</b><small>${n1(d.mi)} MI · ${d.mins} MIN${d.place ? ' · ' + esc(d.place) : ''}</small>
<div class=mks><button class="W${ty === 'W' ? ' on' : ''}" data-t=W>WORK</button><button class="P${ty === 'P' ? ' on' : ''}" data-t=P>PERSONAL</button></div>
<small>NOTE (WHERE, WHY) · OPTIONAL</small><textarea maxlength=120 placeholder="Site visit, Pasco">${esc(m.note)}</textarea>
<button class=sv>SAVE</button>${m.type ? '<button class=x data-c=1>CLEAR THE MARK</button>' : '<button class=x>CANCEL</button>'}</div>`;
    document.body.appendChild(ov);
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.querySelectorAll('.mks button').forEach(b => b.onclick = () => { ty = b.dataset.t; ov.querySelectorAll('.mks button').forEach(x => x.classList.toggle('on', x === b)); });
    ov.querySelector('.x').onclick = async e => { if (e.target.dataset.c) { MARKS.delete(d.id); await saveMarks(); done(); } ov.remove(); };
    ov.querySelector('.sv').onclick = async () => {
      if (!ty) { ov.querySelector('.mks').style.outline = '2px solid #ffb000'; return; }
      MARKS.set(d.id, { type: ty, note: ov.querySelector('textarea').value.trim() });
      const b = ov.querySelector('.sv'); b.textContent = 'SAVING…';
      try { await saveMarks(); ov.remove(); done(); } catch (err) { b.textContent = 'COULD NOT SAVE. TRY AGAIN'; }
    };
  }
  const mkTot = ds => { const t = { W: 0, P: 0, N: 0, nW: 0 }; for (const d of ds) { const m = MARKS.get(d.id); if (m) { t[m.type] += d.mi; if (m.type === 'W') t.nW++; } else t.N += d.mi; } return t; };
  let FUEL = null;
  async function fuel() {
    if (FUEL) return FUEL; FUEL = [];
    if (!FILES['fuellog.csv']) return FUEL;
    for (const r of csv(await OC.cached('fuellog.csv', FILES['fuellog.csv'])))
      FUEL.push({ t: r[0], date: r[0].slice(0, 10), gal: +r[3], ppg: +r[4], usd: +r[5], full: r[6] === '1', lat: +r[12], lon: +r[13], station: r[14] || '' });
    return FUEL;
  }
  // a fill-up's station page on the ECONOMY tab (econ.js reads the same key)
  const stationHref = f => '/ec#s=' + encodeURIComponent(f.lat ? 'p:' + f.lat.toFixed(4) + ',' + f.lon.toFixed(4) : 'n:' + f.station);
  async function roadTrips() {
    if (!FILES['roadtrips.csv']) return [];
    return csv(await OC.cached('roadtrips.csv', FILES['roadtrips.csv'])).filter(r => r.length > 8).reverse();
  }
  // The day's GPS rows from the month's track file, FOUND BY BISECTION: the
  // rows are in time order, so a few 300-byte peeks find where the day starts
  // and ends, and only that range is pulled. A month of track is ~1 MB; a day
  // is a few tens of KB. No index file, no clock code.
  const td = new TextDecoder();
  async function track(date) {
    const n = 'track-' + date.slice(0, 7) + '.csv'; const size = FILES[n]; if (!size) return [];
    const peek = async off => { const b = await OC.bytes(n, '', off, 400); const s = td.decode(b); const i = off ? s.indexOf('\n') + 1 : 0; return s.slice(i, i + 10); };
    async function first(pred) {
      let lo = 0, hi = size;
      while (hi - lo > 400) { const mid = (lo + hi) >> 1; const d = await peek(mid); if (!d || d < '2') { hi = mid; continue; } if (pred(d)) hi = mid; else lo = mid; }
      return lo;
    }
    const a = await first(d => d >= date), b = await first(d => d > date);
    if (b <= a) return [];
    const s = td.decode(await OC.bytes(n, '', a, Math.min(b - a + 400, 600000)));
    const out = [];
    for (const l of s.split('\n')) { if (!l.startsWith(date)) continue; const r = l.split(','); out.push({ t: r[0].slice(11, 19), id: r[1], lat: +r[2], lon: +r[3], alt: +r[4], kmh: +r[5] }); }
    return out;
  }

  // ── small helpers ─────────────────────────────────────────────────────────
  const COLS = ['#3ddc5b', '#ffb000', '#4da3ff', '#ff5e5e', '#c678dd', '#4dd0e1'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dt = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const niceDay = s => { const d = dt(s); return DOW[d.getDay()] + ' ' + MON[d.getMonth()] + ' ' + d.getDate(); };
  const longDay = s => { const d = dt(s); return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()] + ' ' + MON[d.getMonth()] + ' ' + d.getDate(); };
  const today = () => iso(new Date());
  const hm = mins => Math.floor(mins / 60) + ':' + String(mins % 60).padStart(2, '0');
  const ampm = t => { const h = +t.slice(0, 2); return (h % 12 || 12) + ':' + t.slice(3, 5) + (h < 12 ? ' AM' : ' PM'); };
  const n1 = x => x.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const n0 = x => Math.round(x).toLocaleString();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const addMin = (t, m) => { const x = +t.slice(0, 2) * 60 + +t.slice(3, 5) + m; return String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
  function spark(vals, col) {
    if (vals.length < 2) return '';
    const W = 360, H = 90, mn = Math.min(...vals), mx = Math.max(...vals), rg = (mx - mn) || 1;
    const pts = vals.map((v, i) => [10 + i * (W - 20) / (vals.length - 1), H - 10 - (v - mn) / rg * (H - 26)]);
    const p = pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ');
    return `<svg viewBox="0 0 ${W} ${H}"><polygon points="10,${H - 10} ${p} ${W - 10},${H - 10}" fill="${col}" opacity=".18"/><polyline points="${p}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/><line class=cur x1=-9 x2=-9 y1=4 y2=${H - 8} stroke="#ffb000" stroke-width=2 /><text x="${W - 10}" y="12" text-anchor="end" fill="#949494" font-size="11" font-family="system-ui">${Math.round(mx)}</text><text x="${W - 10}" y="${H - 12}" text-anchor="end" fill="#949494" font-size="11" font-family="system-ui">${Math.round(mn)}</text></svg>`;
  }
  function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = name; a.click(); }
  // The pinned map: a box at the top that stays while the list scrolls.
  // Returns {map, drawer, focus(g, bb), all} once lines are in.
  function pinnedMap(M, lines, pins, dots, legend, onAll) {
    const all = []; lines.forEach(l => all.push(...l.pts)); pins.forEach(p => all.push([p.lat, p.lon]));
    if (!all.length) { M.innerHTML = '<p class=nt style="padding:20px">No GPS trail here.</p>'; return null; }
    const drawer = OC.routeDrawer(lines, pins, dots); const box = OC.bboxOf(all);
    const map = OC.makeMap(M, box, drawer);
    const lg = document.createElement('div'); lg.className = 'lg'; lg.innerHTML = legend; M.appendChild(lg);
    const sa = document.createElement('button'); sa.className = 'sall'; sa.textContent = 'SHOW ALL'; sa.onclick = () => onAll(); M.appendChild(sa);
    return {
      map, drawer, box,
      focus(g, bb) { drawer.focus = g; drawer.mark = null; M.classList.toggle('fo', g != null); map.show(g != null && bb ? bb : box); map.draw(); },
      mark(m) { drawer.mark = m; map.draw(); }
    };
  }
  // tap a row to show it on the map; tap again (or SHOW ALL) for everything
  function selectable(sel, rows, pick) {
    rows.forEach(r => r.onclick = e => { if (e.target.closest('.go')) return; pick(r.dataset.k === sel() ? null : r.dataset.k); });
  }

  // ── PAGE: the month ───────────────────────────────────────────────────────
  async function pageList() {
    title('TRIPS'); T.innerHTML = '<p class=nt>Reading the card…</p>';
    const ms = months(), rts = await roadTrips();
    if (rts.length) title('TRIPS', `<a class=rtl href="#r">ROAD TRIPS · ${rts.length} ›</a>`);
    const ym = location.hash.match(/#m=(\d{4}-\d{2})/)?.[1] || OC.thisYm();
    const ds = await drives(ym); await marks(); const mt = mkTot(ds);
    const byDay = new Map();
    for (const d of ds) { const k = byDay.get(d.date) || { date: d.date, n: 0, mi: 0, mins: 0, w: 0 }; k.n++; k.mi += d.mi; k.mins += d.mins; if (MARKS.get(d.id)?.type === 'W') k.w++; byDay.set(d.date, k); }
    const days = [...byDay.values()].sort((a, b) => a.date < b.date ? 1 : -1);
    const mi = ds.reduce((s, d) => s + d.mi, 0), mins = ds.reduce((s, d) => s + d.mins, 0);
    const fu = (await fuel()).filter(f => f.date.startsWith(ym)); const gal = fu.reduce((s, f) => s + f.gal, 0);
    const mp = OC.monthPicker(ym, ms, m => { location.hash = '#m=' + m; });
    const done = ym < OC.thisYm();
    let h = `<div class=pin>${mp.html}<div class=mp id=M></div></div>
<div class=cd><div class=big>${n0(mi)}<small>MI ${done ? '' : 'SO FAR'}</small></div>
<div class=st><div class=tp id=tD><b>${ds.length}</b><small>drives</small></div><div><b>${n1(mins / 60)}</b><small>hours</small></div><div class=tp id=tM><b>${gal > 1 ? n1(mi / gal) : '--'}</b><small>mpg</small></div></div>
<div class=wk><span><i style="background:#2b6fd6"></i><b>${n0(mt.W)}</b> work</span>·<span><i style="background:#555"></i><b>${n0(mt.P)}</b> personal</span>·<span><b>${n0(mt.N)}</b> not marked</span><a href="#w=${ym.slice(0, 4)}">MILEAGE LOG ›</a></div></div>`;
    h += `<h3 id=BD>BY DAY <span>TAP A DAY TO SEE IT ON THE MAP</span></h3>`;
    const tdy = today();
    days.forEach((d, i) => {
      const name = d.date === tdy ? 'Today' : niceDay(d.date);
      h += `<div class=rw data-k="${d.date}"><div class=l><b><i style="color:${COLS[(days.length - 1 - i) % COLS.length]};font-style:normal">●</i> ${name}</b><small>${d.n} drive${d.n === 1 ? '' : 's'} · ${hm(d.mins)} driving${d.w ? ' · <span style="color:#6ea4ff">' + d.w + ' work</span>' : ''}</small></div><div class=r><b>${n1(d.mi)}</b><small>MI</small></div><a class=go href="#d=${d.date}">DETAILS ›</a></div>`;
    });
    if (!days.length) h += `<p class=nt>No drives ${done ? 'in ' + OC.ymName(ym).toLowerCase().replace(/^./, c => c.toUpperCase()) : 'yet this month'}.</p>`;
    h += `<button class=btn id=dlr>DOWNLOAD A DATE RANGE</button>`;
    T.innerHTML = h; mp.bind();
    $('#dlr').onclick = () => rangeSheet(ym);
    $('#tD').onclick = () => $('#BD').scrollIntoView({ behavior: 'smooth' });
    $('#tM').onclick = () => { OCD.go('/ec#m=' + ym); };
    // the map: every drive this month, a colour per day
    const tk = await OC.monthTrack(ym, 2); const dOrder = days.map(d => d.date).reverse();
    const byDate = new Map(); for (const p of tk) { if (!byDate.has(p.id)) byDate.set(p.id, { date: p.date, pts: [] }); byDate.get(p.id).pts.push([p.lat, p.lon]); }
    const lines = [...byDate.values()].map(x => ({ g: x.date, pts: x.pts, col: COLS[Math.max(0, dOrder.indexOf(x.date)) % COLS.length] }));
    const pins = fu.filter(f => f.lat && f.lon).map(f => ({ lat: f.lat, lon: f.lon, col: '#e3342f', g: f.date }));
    let sel = null;
    const pm = pinnedMap($('#M'), lines, pins, [], '<span>Each day its own colour</span>' + (pins.length ? '<span><i style="background:#e3342f"></i>Fill-ups</span>' : ''), () => pick(null));
    const pick = k => {
      sel = k; document.querySelectorAll('#T .rw[data-k]').forEach(r => r.classList.toggle('sel', r.dataset.k === k));
      if (pm) { const pts = []; lines.filter(l => l.g === k).forEach(l => pts.push(...l.pts)); pm.focus(k, pts.length ? OC.bboxOf(pts) : null); }
    };
    selectable(() => sel, document.querySelectorAll('#T .rw[data-k]'), pick);
  }

  // ── PAGE: a day ───────────────────────────────────────────────────────────
  async function pageDay(date) {
    const back = `<a class=bk href="#m=${date.slice(0, 7)}">‹ TRIPS</a>`;
    title(longDay(date)); T.innerHTML = back + '<p class=nt>Reading the card…</p>';
    const ds = (await drives(date.slice(0, 7))).filter(d => d.date === date); await marks();
    const fu = (await fuel()).filter(f => f.date === date);
    const mi = ds.reduce((s, d) => s + d.mi, 0), mins = ds.reduce((s, d) => s + d.mins, 0);
    let h = `${back}<div class=pin><div class=mp id=M></div></div>
<div class=st><div><b>${n1(mi)}</b><small>miles</small></div><div><b>${hm(mins)}</b><small>driving</small></div><div class=tp id=tT><b>${ds.length ? n0(Math.max(...ds.map(d => d.topMph))) : '--'}</b><small>top mph</small></div></div><h3>DRIVES <span>${OC.MOUSE ? 'CLICK' : 'TAP'} A TAG TO MARK WORK OR PERSONAL</span></h3>`;
    ds.forEach((d, i) => {
      const fill = fu.find(f => f.t.slice(11, 16) >= d.start && f.t.slice(11, 16) <= addMin(d.start, d.mins + 5));
      h += `<div class="rw dv" data-k="${i}"><div class=l><b><i style="color:${COLS[i % COLS.length]};font-style:normal">●</i> ${ampm(d.start)}${d.place ? ' · ' + esc(d.place) : ''}</b><small>${d.mins} min · avg ${n0(d.avg)} · top ${n0(d.topMph)} mph${d.cool ? ' · ' + Math.round(d.cool * 9 / 5 + 32) + '°F coolant' : ''}${fill ? ' · fill-up' + (fill.station ? ' at ' + esc(fill.station) : '') : ''}</small><div class=dvt>${mkBtn(d.id)}${MARKS.get(d.id)?.note ? '<span class=nte>' + esc(MARKS.get(d.id).note) + '</span>' : ''}</div></div><div class=r><b>${n1(d.mi)}</b><small>MI</small></div></div>`;
    });
    if (!ds.length) h += '<p class=nt>No drives logged.</p>';
    if (fu.length) h += `<h3>FILL-UPS <span>TAP FOR THE STATION</span></h3>`;
    for (const f of fu) h += `<a class=rw href="${stationHref(f)}"><div class=l><b>${esc(f.station || 'Unnamed station')}</b><small>${ampm(f.t.slice(11, 16))} · ${n1(f.gal)} gal · $${f.ppg.toFixed(2)}${f.full ? ' · full' : ''}</small></div><div class=r><b>$${f.usd.toFixed(2)}</b></div><div class=ch>›</div></a>`;
    h += '<div id=G></div><div class=dls><button class=btn id=dl>CSV<small>spreadsheet</small></button><button class=btn id=dg>GPX<small>Gaia, Garmin</small></button><button class=btn id=dk>KML<small>Google Earth</small></button></div>';
    T.innerHTML = h;
    T.querySelectorAll('.mk').forEach(b => b.onclick = e => { e.stopPropagation(); const i = ds.findIndex(d => d.id === b.dataset.id); markSheet(ds[i], 'Drive ' + (i + 1) + ' · ' + ampm(ds[i].start), () => { const nb = document.createElement('div'); nb.innerHTML = mkBtn(ds[i].id); const nn = nb.firstChild; nn.onclick = b.onclick; const box = b.parentNode; b.replaceWith(nn); box.querySelector('.nte')?.remove(); const m = MARKS.get(ds[i].id); if (m?.note) box.insertAdjacentHTML('beforeend', '<span class=nte>' + esc(m.note) + '</span>'); }); });
    // the route
    const tk = await track(date);
    const byId = new Map(); for (const p of tk) { if (!byId.has(p.id)) byId.set(p.id, []); byId.get(p.id).push(p); }
    const lines = []; let k = 0; const all = [];
    const order = ds.map(d => d.id); for (const id of byId.keys()) if (!order.includes(id)) order.push(id);
    for (const id of order) { const ps = byId.get(id); const g = String(k); const col = COLS[k++ % COLS.length]; if (!ps) continue; const pts = ps.map(p => [p.lat, p.lon]); lines.push({ g, pts, col }); all.push(...pts); }
    const pins = fu.filter(f => f.lat && f.lon).map(f => ({ lat: f.lat, lon: f.lon, col: '#e3342f', label: '$' + f.usd.toFixed(2) }));
    const dots = [];
    if (all.length) { dots.push({ lat: all[0][0], lon: all[0][1], col: OC.LT() ? '#333' : '#fff', label: 'START' }); const e = all[all.length - 1]; dots.push({ lat: e[0], lon: e[1], col: lines[lines.length - 1].col, label: 'END' }); }
    let sel = null;
    const pm = pinnedMap($('#M'), lines, pins, dots, lines.map((l, i) => `<span><i style="background:${l.col}"></i>Drive ${+l.g + 1}</span>`).join('') + (pins.length ? '<span><i style="background:#e3342f"></i>Fill-up</span>' : ''), () => pick(null));
    // graphs: the picked drive, or the longest. Slide a finger along the speed
    // chart and a dot follows on the map with the speed and the time.
    let best = order[0]; for (const id of order) if ((byId.get(id) || []).length > (byId.get(best) || []).length) best = id;
    const graphs = bi => {
      const ps = byId.get(order[bi]) || []; const d = ds[bi];
      $('#G').innerHTML = ps.length > 2 ? `<h3>DRIVE ${bi + 1}${d ? ' · ' + ampm(d.start) : ''}<span>${OC.MOUSE ? 'MOVE THE MOUSE' : 'SLIDE'} ALONG THE SPEED</span></h3><div class="gr sc" id=SP><small>Speed, mph</small>${spark(ps.map(p => p.kmh * MI), COLS[bi % COLS.length])}</div><div class=gr><small>Elevation, ft</small>${spark(ps.map(p => p.alt * FT), '#ffb000')}</div>` : '';
      const sp = $('#SP'); if (!sp || !pm) return;
      const svg = sp.querySelector('svg'), cur = svg.querySelector('.cur');
      const at = e => { const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * 360; const i = Math.max(0, Math.min(ps.length - 1, Math.round((x - 10) / 340 * (ps.length - 1)))); cur.setAttribute('x1', 10 + i * 340 / (ps.length - 1)); cur.setAttribute('x2', 10 + i * 340 / (ps.length - 1)); const p = ps[i]; pm.mark({ lat: p.lat, lon: p.lon, label: n0(p.kmh * MI) + ' MPH · ' + ampm(p.t.slice(0, 5)) }); };
      let down = false;
      sp.onpointerdown = e => { down = true; sp.setPointerCapture(e.pointerId); at(e); };
      sp.onpointermove = e => { if (down || e.pointerType === 'mouse') at(e); };
      sp.onpointerup = sp.onpointercancel = () => { down = false; };
    };
    const pick = kk => {
      sel = kk; document.querySelectorAll('#T .rw[data-k]').forEach(r => r.classList.toggle('sel', r.dataset.k === kk));
      if (pm) { const l = lines.find(x => x.g === kk); pm.focus(kk, l ? OC.bboxOf(l.pts) : null); }
      if (lines.length) graphs(kk != null ? +kk : order.indexOf(best));
    };
    selectable(() => sel, document.querySelectorAll('#T .rw[data-k]'), pick);
    pick(null);
    // top mph: a pin where it happened
    $('#tT').onclick = () => {
      if (!pm || !tk.length) return; let b = tk[0]; for (const p of tk) if (p.kmh > b.kmh) b = p;
      pick(null); pm.mark({ lat: b.lat, lon: b.lon, label: 'TOP ' + n0(b.kmh * MI) + ' MPH · ' + ampm(b.t.slice(0, 5)) });
      $('#M').scrollIntoView({ block: 'nearest' });
    };
    // downloads: the day, or just the picked drive
    const picked = () => sel != null ? tk.filter(p => p.id === order[+sel]) : tk;
    const fname = ext => 'overclock-' + date + (sel != null ? '-drive' + (+sel + 1) : '') + '.' + ext;
    $('#dg').onclick = () => download(fname('gpx'), gpx(fname(''), picked(), order));
    $('#dk').onclick = () => download(fname('kml'), kml(fname(''), picked(), order));
    $('#dl').onclick = () => {
      let t = 'drive,start,minutes,miles,avg_mph,top_mph,coolant_F\n';
      ds.forEach((d, i) => t += `${i + 1},${d.id},${d.mins},${d.mi.toFixed(1)},${d.avg.toFixed(1)},${d.topMph.toFixed(1)},${d.cool ? Math.round(d.cool * 9 / 5 + 32) : ''}\n`);
      t += '\ntime,drive,lat,lon,alt_ft,mph\n'; for (const p of picked()) t += `${p.t},${order.indexOf(p.id) + 1},${p.lat},${p.lon},${Math.round(p.alt * FT)},${(p.kmh * MI).toFixed(1)}\n`;
      download('overclock-' + date + '.csv', t);
    };
  }
  // GPX and KML: one track per drive, time and elevation on every point
  const byDrive = (pts, order) => { const m = new Map(); for (const p of pts) { if (!m.has(p.id)) m.set(p.id, []); m.get(p.id).push(p); } return [...m.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])); };
  const gpx = (name, pts, order) => '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="OVERCLOCK" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>' + esc(name) + '</name></metadata>\n' +
    byDrive(pts, order).map(([id, ps]) => '<trk><name>Drive ' + (order.indexOf(id) + 1) + '</name><trkseg>\n' + ps.map(p => `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.alt.toFixed(1)}</ele><time>${p.t}</time></trkpt>`).join('\n') + '\n</trkseg></trk>').join('\n') + '\n</gpx>\n';
  const kml = (name, pts, order) => '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>' + esc(name) + '</name>' +
    COLS.map((c, i) => `<Style id="d${i}"><LineStyle><color>ff${c.slice(5, 7)}${c.slice(3, 5)}${c.slice(1, 3)}</color><width>4</width></LineStyle></Style>`).join('') + '\n' +
    byDrive(pts, order).map(([id, ps]) => { const k = order.indexOf(id); return `<Placemark><name>Drive ${k + 1}</name><styleUrl>#d${k % COLS.length}</styleUrl><LineString><tessellate>1</tessellate><coordinates>\n` + ps.map(p => `${p.lon},${p.lat},${p.alt.toFixed(1)}`).join('\n') + '\n</coordinates></LineString></Placemark>'; }).join('\n') + '\n</Document></kml>\n';

  // the dates a road trip covers
  const tripDates = (r, dayRows) => { if (dayRows.length) return dayRows.map(x => x.date); const o = [], s = r[1].slice(0, 10); for (let i = 0; i < +r[7]; i++) { const d = dt(s); d.setDate(d.getDate() + i); o.push(iso(d)); } return o; };
  async function tripDays(start) { return FILES['roadtrip-days.csv'] ? csv(await OC.cached('roadtrip-days.csv', FILES['roadtrip-days.csv'])).filter(r => r[0] === String(start)).map(r => ({ day: +r[1], date: r[2], mi: +r[3], h: +r[4] })) : []; }

  // ── PAGE: the road trips ──────────────────────────────────────────────────
  async function pageRoadTrips() {
    const back = `<a class=bk href="#">‹ TRIPS</a>`;
    title('ROAD TRIPS'); T.innerHTML = back + '<p class=nt>Reading the card…</p>';
    const rts = await roadTrips();
    let h = `${back}<div class=pin><div class=mp id=M></div></div><h3>ROAD TRIPS <span>TAP ONE TO SEE IT ON THE MAP</span></h3>`;
    rts.forEach((r, i) => {
      const s = r[1].slice(0, 10), e = r[2].slice(0, 10); const states = r[15] ? r[15].trim().split(/\s+/).length : 0;
      h += `<div class=rw data-k="${r[3]}"><div class=l><b><i style="color:${COLS[i % COLS.length]};font-style:normal">●</i> ${esc(r[0])}</b><small>${MON[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)} to ${MON[+e.slice(5, 7) - 1]} ${+e.slice(8, 10)}, ${s.slice(0, 4)} · ${r[7]} day${+r[7] === 1 ? '' : 's'}${states ? ' · ' + states + ' state' + (states === 1 ? '' : 's') : ''}</small></div><div class=r><b>${n0(+r[6])}</b><small>MI</small></div><a class=go href="#t=${r[3]}">DETAILS ›</a></div>`;
    });
    if (!rts.length) h += '<p class=nt>No road trips yet. Start one on the clock: TRIP > ROAD TRIP.</p>';
    T.innerHTML = h;
    // every trip's trail, a colour per trip, thinned: one track read a day
    const lines = [];
    for (let i = 0; i < rts.length; i++) {
      const r = rts[i]; const dates = tripDates(r, await tripDays(r[3]));
      for (const d of dates) { const tk = await track(d); if (tk.length) lines.push({ g: r[3], pts: tk.filter((p, j) => j % 4 === 0).map(p => [p.lat, p.lon]), col: COLS[i % COLS.length] }); }
    }
    let sel = null;
    const pm = pinnedMap($('#M'), lines, [], [], '<span>Each trip its own colour</span>', () => pick(null));
    const pick = k => {
      sel = k; document.querySelectorAll('#T .rw[data-k]').forEach(r => r.classList.toggle('sel', r.dataset.k === k));
      if (pm) { const pts = []; lines.filter(l => l.g === k).forEach(l => pts.push(...l.pts)); pm.focus(k, pts.length ? OC.bboxOf(pts) : null); }
    };
    selectable(() => sel, document.querySelectorAll('#T .rw[data-k]'), pick);
  }

  // ── PAGE: a road trip ─────────────────────────────────────────────────────
  async function pageTrip(startUnix) {
    const back = `<a class=bk href="#r">‹ ROAD TRIPS</a>`;
    title('ROAD TRIP'); T.innerHTML = back + '<p class=nt>Reading the card…</p>';
    const rt = (await roadTrips()).find(r => r[3] === String(startUnix));
    if (!rt) { T.innerHTML = back + '<p class="nt er">That trip is not on the card.</p>'; return; }
    const name = rt[0], s = rt[1].slice(0, 10), e = rt[2].slice(0, 10), miles = +rt[6], days = +rt[7], hours = +rt[8], best = +rt[9], gal = +rt[10], spend = +rt[12], mpg = +rt[13];
    const states = rt[15] ? rt[15].trim().split(/\s+/).filter(Boolean) : [];
    const dayRows = await tripDays(startUnix);
    const fu = (await fuel()).filter(f => f.date >= s && f.date <= e);
    title(name);
    const dateOf = i => { const d = dt(s); d.setDate(d.getDate() + i); return iso(d); };
    let h = `${back}<div class=pin><div class=mp id=M></div></div>
<div class=st><div><b>${n0(miles)}</b><small>miles</small></div><div><b>${days}</b><small>days</small></div><div><b>${states.length || '--'}</b><small>states</small></div><div><b>${n1(hours)}</b><small>hours</small></div><div${fu.length ? ' class=tp id=tF' : ''}><b>$${n0(spend)}</b><small>fuel</small></div><div><b>${mpg > 0.05 ? n1(mpg) : '--'}</b><small>mpg</small></div></div>`;
    if (states.length) h += `<h3>STATES <span>IN ORDER</span></h3><div class=sts>${states.map(esc).join('<i>›</i>')}</div>`;
    // miles each day: tap a bar (or a row below) to see that day on the map
    const perDay = []; for (let i = 0; i < days; i++) { const r = dayRows.find(x => x.day === i + 1); perDay.push(r ? r.mi : 0); }
    const mx = Math.max(1, ...perDay); const rest = perDay.filter(x => !x).length;
    if (dayRows.length) {
      let bars = `<svg viewBox="0 0 360 110">`; const sl = 340 / days, bw = Math.max(2, Math.min(14, sl - 2));
      perDay.forEach((m, i) => { const x = 10 + i * sl, bh = m / mx * 80; bars += `<rect x="${(x - 1).toFixed(1)}" y="0" width="${sl.toFixed(1)}" height="100" fill="transparent" data-k="${i}"/><rect class=bar data-b="${i}" x="${x.toFixed(1)}" y="${(95 - bh).toFixed(1)}" width="${bw}" height="${Math.max(bh, 2).toFixed(1)}" rx="2" fill="${m === mx ? '#ffb000' : m ? '#3ddc5b' : '#444'}" style="pointer-events:none"/>`; });
      bars += `<text x="10" y="108" fill="#949494" font-size="11" font-family="system-ui">${MON[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}</text><text x="350" y="108" text-anchor="end" fill="#949494" font-size="11" font-family="system-ui">${MON[+e.slice(5, 7) - 1]} ${+e.slice(8, 10)}</text><text x="180" y="12" text-anchor="middle" fill="#ffb000" font-size="12" font-weight="700" font-family="system-ui">${n0(mx)} best day</text></svg>`;
      h += `<h3>MILES EACH DAY <span>${rest ? rest + ' REST DAY' + (rest === 1 ? '' : 'S') : 'TAP A DAY'}</span></h3><div class=gr id=MB>${bars}</div>`;
      h += `<h3>DAYS <span>TAP ONE TO SEE IT ON THE MAP</span></h3><table><tr><th>Day</th><th>Date</th><th>Miles</th><th>Hours</th><th>Fuel</th></tr>`;
      for (let i = 0; i < days; i++) {
        const ds = dateOf(i), d = dt(ds);
        const r = dayRows.find(x => x.day === i + 1); const f = fu.filter(x => x.date === ds).reduce((a, x) => a + x.usd, 0);
        h += `<tr class=dy data-k="${i}"><td>${i + 1}</td><td>${MON[d.getMonth()]} ${d.getDate()}</td>${r ? `<td>${n0(r.mi)}</td><td>${n1(r.h)}</td>` : '<td style="color:#777">rest</td><td></td>'}<td>${f ? '$' + n0(f) : ''}</td></tr>`;
      }
      h += '</table><div id=DS></div>';
    }
    if (fu.length) {
      h += `<h3 id=FU>FILL-UPS <span>TAP FOR THE STATION</span></h3>`;
      for (const f of fu) h += `<a class=rw href="${stationHref(f)}"><div class=l><b>${esc(f.station || 'Unnamed station')}</b><small>${MON[+f.date.slice(5, 7) - 1]} ${+f.date.slice(8, 10)} · ${n1(f.gal)} gal · $${f.ppg.toFixed(2)}${f.full ? ' · full' : ''}</small></div><div class=r><b>$${f.usd.toFixed(2)}</b></div><div class=ch>›</div></a>`;
    }
    h += '<div class=dls><button class=btn id=dl>CSV<small>spreadsheet</small></button><button class=btn id=dg>GPX<small>Gaia, Garmin</small></button><button class=btn id=dk>KML<small>Google Earth</small></button></div>';
    T.innerHTML = h;
    if ($('#tF')) $('#tF').onclick = () => $('#FU').scrollIntoView({ behavior: 'smooth' });
    // the route: every day's trail, days alternating colour, read a day at a time
    const need = tripDates(rt, dayRows); const lines = [], all = [];
    for (let i = 0; i < need.length; i++) {
      const tk = await track(need[i]); if (!tk.length) continue;
      const di = Math.round((dt(need[i]) - dt(s)) / 864e5);
      const pts = tk.filter((p, j) => j % 3 === 0).map(p => [p.lat, p.lon]); lines.push({ g: String(di), pts, col: di % 2 ? '#ffb000' : '#3ddc5b' }); all.push(...pts);
    }
    const pins = fu.filter(f => f.lat && f.lon).map(f => ({ lat: f.lat, lon: f.lon, col: '#e3342f', g: String(Math.round((dt(f.date) - dt(s)) / 864e5)) }));
    const dots = all.length ? [{ lat: all[0][0], lon: all[0][1], col: OC.LT() ? '#333' : '#fff', label: 'START' }, { lat: all[all.length - 1][0], lon: all[all.length - 1][1], col: '#ffb000', label: 'END' }] : [];
    let sel = null;
    const pm = pinnedMap($('#M'), lines, pins, dots, '<span><i style="background:#3ddc5b"></i><i style="background:#ffb000"></i>Days alternate</span>' + (pins.length ? '<span><i style="background:#e3342f"></i>Fill-ups</span>' : ''), () => pick(null));
    const pick = k => {
      sel = k;
      document.querySelectorAll('#T tr.dy').forEach(r => r.classList.toggle('sel', r.dataset.k === k));
      document.querySelectorAll('#MB .bar').forEach(b => b.setAttribute('stroke', b.dataset.b === k ? (OC.LT() ? '#111' : '#fff') : 'none'));
      if (pm) { const l = lines.find(x => x.g === k); pm.focus(k, l ? OC.bboxOf(l.pts) : null); }
      const ds = $('#DS');
      if (ds) {
        if (k == null) ds.innerHTML = '';
        else { const i = +k, date = dateOf(i), r = dayRows.find(x => x.day === i + 1); ds.innerHTML = `<a class="rw sel" href="#d=${date}" style="margin-top:10px"><div class=l><b>Day ${i + 1} · ${niceDay(date)}</b><small>${r ? n0(r.mi) + ' mi · ' + n1(r.h) + ' h driving' : 'rest day'}</small></div><span class=go style="display:block">DAY DETAILS ›</span></a>`; }
      }
    };
    document.querySelectorAll('#T tr.dy, #MB rect[data-k]').forEach(r => r.onclick = () => pick(r.dataset.k === sel ? null : r.dataset.k));
    // GPX / KML of the whole trip: every day's full track, one track per day
    const tripPts = async () => { const o = []; for (let i = 0; i < need.length; i++) { const tk = await track(need[i]); for (const p of tk) o.push(Object.assign({}, p, { id: 'day' + (i + 1) })); } return o; };
    const dayOrder = need.map((d, i) => 'day' + (i + 1)); const slug = name.toLowerCase().replace(/\W+/g, '-');
    $('#dg').onclick = async () => download('overclock-' + slug + '.gpx', gpx(name, await tripPts(), dayOrder).replace(/<name>Drive (\d+)<\/name>/g, '<name>Day $1</name>'));
    $('#dk').onclick = async () => download('overclock-' + slug + '.kml', kml(name, await tripPts(), dayOrder).replace(/<name>Drive (\d+)<\/name>/g, '<name>Day $1</name>'));
    $('#dl').onclick = () => {
      let t = `name,start,end,miles,days,driving_h,best_day_mi,logged_gal,spend_usd,mpg,states\n${name},${s},${e},${miles},${days},${hours},${best},${gal},${spend},${mpg},${states.join(' ')}\n\nday,date,miles,driving_h\n`;
      for (const r of dayRows) t += `${r.day},${r.date},${r.mi},${r.h}\n`;
      t += '\nfill_time,station,gallons,price,cost\n'; for (const f of fu) t += `${f.t},${f.station},${f.gal},${f.ppg},${f.usd}\n`;
      download('overclock-' + slug + '.csv', t);
    };
  }

  // ── routing ───────────────────────────────────────────────────────────────
  // ── download a date range (2026-11-13) ───────────────────────────────────
  // Derek: pick the dates, get one ZIP. SUMMARY: a drives sheet and a fill-ups
  // sheet, made right here on the phone from files it already read (fast).
  // EVERYTHING: every log the clock wrote for those months, zipped by the
  // clock itself (GET /zip, the same as the FILES calendar), with a size and
  // a time up front.
  const RATE = 250e3;   // bytes a second the clock sends, roughly
  const nMon = (a, b) => { const [y0, m0] = a.split('-').map(Number), [y1, m1] = b.split('-').map(Number); return Math.max(1, (y1 - y0) * 12 + m1 - m0 + 1); };
  // a month's own files (a day file belongs to its month), inside the dates
  const monthFiles = (ym, a, b) => Object.keys(FILES).filter(n => { const m = n.match(/-(\d{4}-\d{2})(-\d{2})?\.csv$/); if (!m || m[1] !== ym) return false; return !m[2] || (m[1] + m[2] >= a && m[1] + m[2] <= b); });
  // SUMMARY: two sheets made here from what the phone already reads
  async function summaryZip(a, b) {
    await marks(); const q = v => /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v;
    let dv = 'date,start,end,miles,minutes,avg_mph,top_mph,odometer_start_mi,odometer_end_mi,type,note\n';
    for (let ym = a.slice(0, 7); ym <= b.slice(0, 7); ym = nextYm(ym))
      for (const d of await drives(ym)) { if (d.date < a || d.date > b) continue; const m = MARKS.get(d.id); dv += [d.date, d.start, addMin(d.start, d.mins), d.mi.toFixed(1), d.mins, d.avg.toFixed(0), d.topMph.toFixed(0), (d.odo0 * MI).toFixed(1), (d.odo1 * MI).toFixed(1), m ? MKN[m.type] : '', q(m ? m.note : '')].join(',') + '\n'; }
    let fv = 'date,time,station,gallons,price_per_gal,total_usd,full\n';
    for (const f of await fuel()) if (f.date >= a && f.date <= b) fv += [f.date, f.t.slice(11, 16), q(f.station || ''), f.gal.toFixed(1), f.ppg.toFixed(3), f.usd.toFixed(2), f.full ? 'yes' : 'no'].join(',') + '\n';
    return OC.zipFiles([{ name: 'drives.csv', text: dv }, { name: 'fill-ups.csv', text: fv }]);
  }
  const nextYm = ym => { let [y, m] = ym.split('-').map(Number); m++; if (m > 12) { m = 1; y++; } return y + '-' + String(m).padStart(2, '0'); };
  // EVERYTHING: one ZIP a month from the clock (GET /zip), one after the other,
  // so no ZIP passes the clock's file limit and a dropped month can be redone
  async function everything(a, b, btn) {
    const yms = []; for (let ym = a.slice(0, 7); ym <= b.slice(0, 7); ym = nextYm(ym)) yms.push(ym);
    for (let i = 0; i < yms.length; i++) {
      const fs = monthFiles(yms[i], a, b); if (!fs.length) continue;
      if (i === 0 && FILES['fuellog.csv']) fs.push('fuellog.csv');
      btn.textContent = yms.length > 1 ? `DOWNLOADING ${OC.ymName(yms[i])} (${i + 1} OF ${yms.length})…` : 'DOWNLOADING…';
      // the V1 clock zips at most 39 files at once: a big month goes in parts
      for (let k = 0, part = 1; k < fs.length; k += 38, part++) {
        const chunk = fs.slice(k, k + 38);
        const z = 'overclock-' + yms[i] + (fs.length > 38 ? '-part' + part : '') + '.zip';
        // fetched (not a plain link) so the bar shows real progress and the next
        // part starts only when this one is done (the clock sends one at a time)
        const url = '/zip?f=' + chunk.map(encodeURIComponent).join(',') + '&z=' + z + '&t=' + Math.floor(Date.now() / 1000);
        let r = await fetch(url); if (r.status === 503) { await new Promise(x => setTimeout(x, 4000)); r = await fetch(url); }
        if (!r.ok) throw new Error('zip ' + r.status);
        const len = +r.headers.get('Content-Length') || 0, rd = r.body.getReader(), bits = []; let got = 0;
        const lab = btn.textContent.replace(/….*$/, '');
        for (;;) { const { done, value } = await rd.read(); if (done) break; bits.push(value); got += value.length; btn.textContent = lab + '… ' + (got / 1e6).toFixed(1) + (len ? ' of ' + (len / 1e6).toFixed(1) : '') + ' MB'; }
        OC.save(z, new Blob(bits, { type: 'application/zip' }));
      }
    }
    btn.textContent = 'DONE · CHECK YOUR DOWNLOADS';
  }
  function rangeSheet(ym) {
    const ms = months().slice().sort(); const ymd = d => d.toISOString().slice(0, 10);
    const now = new Date(), y = now.getFullYear();
    const quick = { 'THIS MONTH': [ym + '-01', ymd(new Date(+ym.slice(0, 4), +ym.slice(5), 0))], 'LAST 3 MONTHS': [ymd(new Date(now - 90 * 864e5)), ymd(now)], ['ALL OF ' + y]: [y + '-01-01', y + '-12-31'], 'EVERYTHING ON THE CARD': [ms[0] + '-01', ymd(now)] };
    let [a, b] = quick['THIS MONTH'], kind = 'S';
    const ov = document.createElement('div'); ov.className = 'ocov';
    const files = () => { const m0 = a.slice(0, 7), m1 = b.slice(0, 7); return Object.keys(FILES).filter(n => { const m = n.match(/-(\d{4}-\d{2})(-\d{2})?\.csv$/); if (!m) return false; const k = m[2] ? m[1] + m[2] : m[1]; return m[2] ? k >= a && k <= b : m[1] >= m0 && m[1] <= m1; }); };
    const draw = () => {
      const fs = files(), big = fs.reduce((t, n) => t + FILES[n], 0) + (FILES['fuellog.csv'] || 0);
      const secs = big / RATE, tl = secs < 60 ? 'under a minute' : 'about ' + Math.round(secs / 60) + ' min';
      ov.innerHTML = `<div class=ocls><b>DOWNLOAD A DATE RANGE</b>
<div class=qk>${Object.keys(quick).map(k => `<button data-q="${k}" class="${quick[k][0] === a && quick[k][1] === b ? 'on' : ''}">${k}</button>`).join('')}</div>
<div class=dr><label>FROM<input type=date value="${a}" id=ra></label><label>TO<input type=date value="${b}" id=rb></label></div>
<div class=kd><button data-k=S class="${kind === 'S' ? 'on' : ''}"><b>SUMMARY</b><i>A row per drive with miles, times and your WORK / PERSONAL marks, plus every fill-up. Two spreadsheets. Seconds.</i></button>
<button data-k=E class="${kind === 'E' ? 'on' : ''}"><b>EVERYTHING</b><i>Every log the clock wrote: GPS tracks, engine, battery, economy, parked. ${fs.length + 1} files, ${(big / 1e6).toFixed(1)} MB, ${tl} over the clock's Wi-Fi.${nMon(a, b) > 1 ? ' One ZIP per month (' + nMon(a, b) + '), one after another.' : ''} Keep this screen open.</i></button></div>
<button class=sv>DOWNLOAD ZIP</button><button class=x>CANCEL</button></div>`;
      ov.querySelectorAll('.qk button').forEach(x => x.onclick = () => { [a, b] = quick[x.dataset.q]; draw(); });
      ov.querySelector('#ra').onchange = e => { a = e.target.value; draw(); }; ov.querySelector('#rb').onchange = e => { b = e.target.value; draw(); };
      ov.querySelectorAll('.kd button').forEach(x => x.onclick = () => { kind = x.dataset.k; draw(); });
      ov.querySelector('.x').onclick = () => ov.remove();
      ov.querySelector('.sv').onclick = async () => {
        const btn = ov.querySelector('.sv'); if (btn.disabled) return; btn.disabled = true;
        try {
          if (kind === 'S') { btn.textContent = 'MAKING THE SUMMARY…'; OC.save('overclock-summary-' + a + '_to_' + b.slice(5) + '.zip', await summaryZip(a, b)); btn.textContent = 'DONE · IN YOUR DOWNLOADS'; }
          else await everything(a, b, btn);
        } catch (e) { btn.textContent = 'COULD NOT DOWNLOAD. TRY AGAIN'; btn.disabled = false; }
      };
    };
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    document.body.appendChild(ov); draw();
  }

  // ── PAGE: the mileage log, a year of WORK drives ──────────────────────────
  async function pageLog(yr) {
    const back = `<a class=bk href="#m=${yr === OC.thisYm().slice(0, 4) ? OC.thisYm() : yr + '-12'}">‹ TRIPS</a>`;
    title('MILEAGE LOG'); T.innerHTML = back + '<p class=nt>Reading the card…</p>';
    await marks();
    const yrs = [...new Set(months().map(m => m.slice(0, 4)))].sort();
    const ms = months().filter(m => m.startsWith(yr)).sort();
    const all = []; for (const m of ms) all.push(...await drives(m));
    const t = mkTot(all);
    const yi = yrs.indexOf(yr);
    let h = `${back}<div class=ocmp><button class=oa ${yi > 0 ? '' : 'disabled'} onclick="location.hash='#w=${yrs[yi - 1]}'">‹ ${yi > 0 ? yrs[yi - 1] : ''}</button><button class=om>${yr}</button><button class=oa ${yi < yrs.length - 1 ? '' : 'disabled'} onclick="location.hash='#w=${yrs[yi + 1]}'">${yi < yrs.length - 1 ? yrs[yi + 1] + ' ›' : '›'}</button></div>
<div class=lg2><div><div class=cd><div class=big>${n0(t.W)}<small>WORK MI</small></div>
<div class=st><div><b>${t.nW}</b><small>work drives</small></div><div><b>${n0(t.P)}</b><small>personal mi</small></div><div><b>${n0(t.N)}</b><small>not marked</small></div></div></div>`;
    h += `<h3>BY MONTH <span>MILES</span></h3><div class=cd style="padding:6px 12px"><table><tr><th>Month</th><th>Work</th><th>Personal</th><th>Not marked</th></tr>`;
    for (const m of ms) { const mt = mkTot(all.filter(d => d.id.startsWith(m))); h += `<tr class=dy onclick="location.hash='#m=${m}'"><td>${OC.ymName(m).split(' ')[0].replace(/^(.)(.*)$/, (a, b, c) => b + c.toLowerCase())}</td><td style="color:#6ea4ff">${n0(mt.W)}</td><td>${n0(mt.P)}</td><td>${n0(mt.N)}</td></tr>`; }
    h += `</table></div><button class=btn id=dlw>DOWNLOAD ${yr} MILEAGE LOG (CSV)</button><p class=hint>Date, start and end time, start and end odometer, miles, and your note for each work drive. Ready for a spreadsheet or your accountant.</p></div><div><h3>WORK DRIVES <span>TAP ONE FOR ITS DAY</span></h3>`;
    const wd = all.filter(d => MARKS.get(d.id)?.type === 'W').reverse();
    for (const d of wd.slice(0, 40)) h += `<a class="rw dv" href="#d=${d.date}"><div class=l><b>${niceDay(d.date)} · ${ampm(d.start)}</b><small>${d.mins} min${d.place ? ' · ' + esc(d.place) : ''}</small>${MARKS.get(d.id).note ? '<div class=dvt><span class=nte>' + esc(MARKS.get(d.id).note) + '</span></div>' : ''}</div><div class=r><b>${n1(d.mi)}</b><small>MI</small></div><div class=ch>›</div></a>`;
    if (wd.length > 40) h += `<p class=nt>And ${wd.length - 40} more in the download.</p>`;
    if (!wd.length) h += `<p class=nt>No drives marked WORK in ${yr} yet. Open a day and tap + MARK on a drive.</p>`;
    h += '</div></div>';
    T.innerHTML = h;
    $('#dlw').onclick = () => download(`mileage-log-${yr}.csv`, 'date,start,end,odometer_start_mi,odometer_end_mi,miles,purpose\n' + wd.slice().reverse().map(d => [d.date, d.start, addMin(d.start, d.mins), (d.odo0 * MI).toFixed(1), (d.odo1 * MI).toFixed(1), d.mi.toFixed(1), '"' + (MARKS.get(d.id).note || '').replace(/"/g, '""') + '"'].join(',')).join('\n') + '\n');
  }

  async function route() {
    const h = location.hash;
    try {
      FILES = await OC.files();
      if (/^#d=\d{4}-\d{2}-\d{2}$/.test(h)) return await pageDay(h.slice(3));
      if (/^#t=\d+$/.test(h)) return await pageTrip(h.slice(3));
      if (h === '#r') return await pageRoadTrips();
      if (/^#w=\d{4}$/.test(h)) return await pageLog(h.slice(3));
      return await pageList();
    } catch (e) { T.innerHTML = '<p class="nt er">Could not read the card: ' + esc(e.message || e) + '</p>'; }
  }
  // common.js first (the map, the reads, the month picker), then the page
  const s = document.createElement('script'); s.src = '/file?n=common.js&d=www';
  s.onload = () => { OC = window.OC; addEventListener('hashchange', () => { scrollTo(0, 0); route(); }); route(); };
  s.onerror = () => { T.innerHTML = '<p class="nt er">common.js is not on the card. Copy the <b>www</b> folder from the firmware zip to the card, then reload.</p>'; };
  document.head.appendChild(s);
})();
