// truck.js - the phone's TRUCK tab (2026-11-13). Lives on the card at
// /www/truck.js and is loaded by the /tk shell (wifi_page.h PAGE_TRUCK). The
// card reads and the charts' shared bits are in /www/common.js.
//
// Derek, 2026-11-13: "what other data logs live on the card that we can
// display this way?" ... "Let's do all 3 now." Three pages, all drawn by the
// phone from logs the clock already writes:
//   PARKED   parked.csv           a row every wake while parked: starter
//                                  battery, house battery, solar, fridge, temps
//   BATTERY  battlog.csv          every start: resting volts, the cranking dip,
//                                  the charging volts
//            health-YYYY-MM.csv   key-on / key-off snapshots: the house battery
//   ENGINE   eng-YYYY-MM.csv      a summary per drive: the light, readiness
//                                  (smog), fuel trims, coolant, transmission
// The clock computes nothing for this page: it only serves bytes.
//
// PAGES (by location.hash): '' or #p[=N]  PARKED (N: the park, 0 newest)
//                           #b            BATTERY
//                           #e            ENGINE
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const T = $('#T');
  let OC = null, FILES = {};
  const title = t => { const h = $('h1.pt'); if (h) h.textContent = t; };
  const css = document.createElement('style');
  css.textContent = `
#T{padding-bottom:12px}
#T .sg3{display:flex;gap:6px;margin:0 0 12px}#T .sg3 a{flex:1;text-align:center;padding:12px 0;background:#1c1c1c;color:#bbb;font:800 15px system-ui;text-decoration:none;letter-spacing:.4px}#T .sg3 a.on{background:#ffb000;color:#111}
#T h3{font:800 18px var(--cd,system-ui);color:#ffb000;text-transform:uppercase;margin:22px 0 8px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}#T h3 span{color:#949494;font:600 12px system-ui;text-align:right}
#T .cd{background:#141414;border-radius:12px;padding:14px 16px;margin:0 0 10px}#T .cd>b{display:block;font-size:17px}#T .cd p{margin:6px 0 0;color:#bbb;font-size:14px;line-height:1.35}
#T .vd{display:flex;align-items:center;gap:12px}#T .vd .dot{flex:none;width:14px;height:14px;border-radius:50%}#T .vd b{font:800 22px var(--cd,system-ui)}
#T .st{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}#T .st>div{padding:8px 4px;text-align:center}#T .st b{display:block;font-size:19px}#T .st small{color:#949494;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
#T .gr{background:#141414;border-radius:12px;padding:12px 12px 6px;margin-bottom:10px;touch-action:pan-y}#T .gr>small{display:flex;justify-content:space-between;color:#949494;font-size:11px;text-transform:uppercase;letter-spacing:.5px}#T .gr>small i{font-style:normal;color:#ffb000}#T .gr svg{display:block;width:100%;margin-top:4px}
#T .rd{position:sticky;top:0;z-index:5;background:#1d1a10;border:1.5px solid #ffb000;border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:14px;display:none}#T .rd.on{display:block}#T .rd b{display:block;font-size:15px;margin-bottom:2px}
#T .pkr{display:flex;align-items:stretch;gap:6px;margin:0 0 10px}#T .pkr button{height:48px;border:0;background:#1c1c1c;color:#ffb000;font:700 14px system-ui;padding:0;margin:0}#T .pkr .oa{flex:0 0 76px}#T .pkr .oa:disabled{color:#555;background:#121212;opacity:1}#T .pkr .om{flex:1;color:inherit;font:800 17px var(--cd,system-ui)}#T .pkr .om i{font-style:normal;color:#949494;font-size:12px;margin-left:6px}
#T .ln{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #222;font-size:15px}#T .ln:last-child{border:0}#T .ln span:last-child{font-weight:700}
#T .ok{color:#7fd13b}#T .am{color:#ffb000}#T .bad{color:#ff5e5e}#T .dim{color:#777}#T .nt{color:#949494;font-size:13px;margin:6px 2px 0}
#T a.mo{display:inline-block;margin-top:8px;color:#ffb000;font:800 13px system-ui;text-decoration:none}
html.lt #T .cd,html.lt #T .gr{background:#fff}html.lt #T .sg3 a,html.lt #T .pkr button{background:#eceef2;color:#555}html.lt #T .sg3 a.on{background:#ffb000;color:#111}html.lt #T .rd{background:#fff7e0}html.lt #T .cd p{color:#444}html.lt #T .ln{border-color:#e4e4e7}`;
  document.head.appendChild(css);

  // ── helpers ───────────────────────────────────────────────────────────────
  const H = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
  const F = c => c * 9 / 5 + 32;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const tm = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13) || 0, +s.slice(14, 16) || 0);
  const ampm = d => (d.getHours() % 12 || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (d.getHours() < 12 ? ' AM' : ' PM');
  const day = d => MON[d.getMonth()] + ' ' + d.getDate();
  const dayLong = d => DOW[d.getDay()] + ' ' + MON[d.getMonth()] + ' ' + d.getDate();
  const dur = ms => { const h = Math.round(ms / 36e5); return h < 24 ? h + ' h' : Math.floor(h / 24) + ' day' + (h >= 48 ? 's' : '') + (h % 24 ? ' ' + (h % 24) + ' h' : ''); };
  const num = v => v === '' || v == null ? NaN : +v;
  // a CSV with its header line (a file can restart its header after an update)
  function rows(t) {
    let h = null; const out = [];
    for (const l of t.split(/\r?\n/)) {
      if (!l || l[0] === '#') continue; const c = l.split(',');
      if (!/^\d/.test(c[0])) { h = c; continue; }
      if (!h) continue; const o = {}; h.forEach((k, i) => o[k] = c[i]); out.push(o);
    }
    return out;
  }
  async function read(n) { return FILES[n] ? rows(await OC.cached(n, FILES[n])) : []; }
  async function readMonths(prefix) { let o = []; for (const n of Object.keys(FILES).filter(n => n.startsWith(prefix) && /\d{4}-\d{2}\.csv$/.test(n)).sort()) o = o.concat(await read(n)); return o; }

  // ── charts: time on the bottom, a finger slides a cursor across all of them
  // series: [{v:[...], col, label}], t: [Date...]. lines: [{y, col, label}]
  const charts = [];
  function chart(id, name, unit, t, series, opt) {
    opt = opt || {};
    const W = 340, Hh = opt.h || 120, x0 = 6, x1 = W - 6, y0 = 10, y1 = Hh - 18;
    const all = []; series.forEach(s => s.v.forEach(v => { if (!isNaN(v)) all.push(v); })); (opt.lines || []).forEach(l => all.push(l.y));
    if (!all.length) return '';
    let mn = opt.min != null ? Math.min(opt.min, ...all) : Math.min(...all), mx = opt.max != null ? Math.max(opt.max, ...all) : Math.max(...all);
    if (mx - mn < (opt.span || 1)) { const c = (mx + mn) / 2; mn = c - (opt.span || 1) / 2; mx = c + (opt.span || 1) / 2; }
    const ta = +t[0], tb = +t[t.length - 1] || ta + 1;
    const X = d => x0 + (x1 - x0) * ((+d - ta) / Math.max(1, tb - ta)), Y = v => y1 - (y1 - y0) * ((v - mn) / (mx - mn));
    let s = `<svg viewBox="0 0 ${W} ${Hh}">`;
    for (const l of opt.lines || []) s += `<line x1=${x0} x2=${x1} y1=${Y(l.y)} y2=${Y(l.y)} stroke="${l.col}" stroke-dasharray="3 3"/><text x=${x1} y=${Y(l.y) - 3} fill="${l.col}" font-size=10 text-anchor=end>${l.label}</text>`;
    for (const se of series) {
      if (opt.dots) { se.v.forEach((v, i) => { if (!isNaN(v)) s += `<circle cx=${X(t[i]).toFixed(1)} cy=${Y(v).toFixed(1)} r=3 fill="${se.col}"/>`; }); continue; }
      let p = '', on = false;
      se.v.forEach((v, i) => { if (isNaN(v)) { on = false; return; } p += (on ? 'L' : 'M') + X(t[i]).toFixed(1) + ',' + Y(v).toFixed(1); on = true; });
      s += `<path d="${p}" fill=none stroke="${se.col}" stroke-width=2.2 stroke-linejoin=round />`;
    }
    s += `<text x=${x0} y=${y0 + 2} fill="#949494" font-size=10>${H(fmtU(mx, unit))}</text><text x=${x0} y=${y1 - 3} fill="#949494" font-size=10>${H(fmtU(mn, unit))}</text>`;
    s += `<line class=cur x1=-9 x2=-9 y1=${y0} y2=${y1} stroke="#ffb000" stroke-width=2 />`;
    s += `<text x=${x0} y=${Hh - 3} fill="#949494" font-size=11>${opt.l0 || ''}</text><text x=${x1} y=${Hh - 3} fill="#949494" font-size=11 text-anchor=end>${opt.l1 || ''}</text></svg>`;
    charts.push({ id, X, t, x0, x1 });
    const leg = series.length > 1 ? series.map(se => `<i style="color:${se.col}">● ${H(se.label)}</i>`).join(' ') : '';
    return `<div class=gr id=${id}><small><span>${H(name)}</span><span>${leg}</span></small>${s}</div>`;
  }
  const fmtU = (v, u) => u === '%' ? Math.round(v) + '%' : u === 'V' ? v.toFixed(1) + ' V' : u === 'W' ? Math.round(v) + ' W' : u === '°F' ? Math.round(v) + '°F' : (Math.round(v * 10) / 10) + (u ? ' ' + u : '');
  // a finger on any chart moves every chart's cursor to the same time, and
  // read(i) fills the readout at the top
  function bindCursor(t, readout) {
    const rd = $('#RD');
    const at = (svg, cx) => {
      const r = svg.getBoundingClientRect(); const x = (cx - r.left) / r.width * 340;
      const ta = +t[0], tb = +t[t.length - 1]; const want = ta + (tb - ta) * Math.max(0, Math.min(1, (x - 6) / 328));
      let i = 0, best = Infinity; t.forEach((d, k) => { const e = Math.abs(+d - want); if (e < best) { best = e; i = k; } });
      for (const c of charts) { const l = $('#' + c.id + ' .cur'); if (l) { const xx = c.X(t[i]); l.setAttribute('x1', xx); l.setAttribute('x2', xx); } }
      rd.innerHTML = readout(i); rd.classList.add('on');
    };
    for (const c of charts) {
      const el = $('#' + c.id); if (!el) continue; const svg = el.querySelector('svg'); let down = false;
      el.onpointerdown = e => { down = true; at(svg, e.clientX); };
      el.onpointermove = e => { if (down || e.pointerType === 'mouse') at(svg, e.clientX); };
      el.onpointerup = el.onpointercancel = el.onpointerleave = () => { down = false; };
    }
  }
  const tabs = on => `<div class=sg3>${[['p', 'PARKED'], ['b', 'BATTERY'], ['e', 'ENGINE']].map(([k, n]) => `<a href="#${k}" class="${k === on ? 'on' : ''}">${n}</a>`).join('')}</div>`;

  // ── PAGE: PARKED ──────────────────────────────────────────────────────────
  // A park is a run of wake rows with no drive in between: a gap longer than
  // a couple of wake intervals means the truck was driven (or was off the card).
  function parks(R) {
    R = R.filter(r => /^20\d\d-[01]\d-[0-3]\d [0-2]\d:/.test(r.timestamp || '')).sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);   // a row stamped 0000-00-00 (the clock had no time) is left out
    const t = R.map(r => tm(r.timestamp)); const gaps = []; for (let i = 1; i < t.length; i++) gaps.push(t[i] - t[i - 1]);
    const med = gaps.length ? gaps.slice().sort((a, b) => a - b)[gaps.length >> 1] : 9e5;
    const out = []; let cur = null;
    R.forEach((r, i) => {
      if (!cur || t[i] - t[i - 1] > Math.max(1.7 * med, 20 * 6e4)) { cur = { R: [], t: [] }; out.push(cur); }
      cur.R.push(r); cur.t.push(t[i]);
    });
    return out.filter(p => p.R.length >= 3 && p.t[p.t.length - 1] - p.t[0] >= 3 * 36e5).reverse();      // 3 h or more (a stop at the store is not a park); newest first
  }
  async function pageParked(n) {
    title('TRUCK'); T.innerHTML = tabs('p') + '<p class=nt>Reading the card…</p>';
    const P = parks(await read('parked.csv'));
    if (!P.length) { T.innerHTML = tabs('p') + '<p class=nt>No parked rows on the card yet. The clock writes one every time it wakes while the truck is parked.</p>'; return; }
    n = Math.max(0, Math.min(P.length - 1, n || 0)); const p = P[n], R = p.R, t = p.t;
    const col = k => R.map(r => num(r[k])), has = k => R.some(r => r[k] !== '' && r[k] != null && !isNaN(+r[k]));
    const a = t[0], b = t[t.length - 1];
    let h = tabs('p') + `<div class=pkr><button class=oa ${n + 1 < P.length ? '' : 'disabled'} data-n=${n + 1}>‹ OLDER</button><button class=om>${day(a)}${day(a) !== day(b) ? ' to ' + day(b) : ''}<i>▾</i></button><button class=oa ${n ? '' : 'disabled'} data-n=${n - 1}>NEWER ›</button></div>`;
    h += `<div class=cd><b>Parked ${dur(b - a)}${n === 0 ? '' : ''}</b><p>${dayLong(a)} ${ampm(a)} to ${dayLong(b)} ${ampm(b)} · ${R.length} check-ins</p>`;
    const st = []; const first = k => { const v = col(k).find(x => !isNaN(x)); return v; }, last = k => { const v = col(k).filter(x => !isNaN(x)); return v[v.length - 1]; };
    if (has('shunt_soc_pct')) st.push(`<div><b>${Math.round(first('shunt_soc_pct'))}% → ${Math.round(last('shunt_soc_pct'))}%</b><small>house battery</small></div>`);
    if (has('volts')) st.push(`<div><b>${Math.min(...col('volts').filter(x => !isNaN(x))).toFixed(1)} V</b><small>starter low</small></div>`);
    if (has('sol_pv_w')) st.push(`<div><b>${Math.max(...col('sol_pv_w').filter(x => !isNaN(x))).toFixed(0)} W</b><small>solar peak</small></div>`);
    if (has('fridge_C')) { const f = col('fridge_C').filter(x => !isNaN(x)); st.push(`<div><b>${Math.round(F(Math.min(...f)))}–${Math.round(F(Math.max(...f)))}°F</b><small>fridge</small></div>`); }
    if (has('outside_C')) { const f = col('outside_C').filter(x => !isNaN(x)); st.push(`<div><b>${Math.round(F(Math.min(...f)))}–${Math.round(F(Math.max(...f)))}°F</b><small>outside</small></div>`); }
    h += `<div class=st>${st.slice(0, 6).join('')}</div></div>`;
    // what stands out: plain-English notes worked out from the rows
    const notes = [];
    const v = col('volts').filter(x => !isNaN(x));
    if (v.length && Math.max(...v) > 13.6) notes.push(`<b class=am>The starter battery read up to ${Math.max(...v).toFixed(1)} V while parked.</b> Above 13.6 V with the engine off means something was charging it: a plug-in charger, solar or a DC-DC charger.`);
    else if (v.length && Math.min(...v) < 12.2) notes.push(`<b class=am>The starter battery fell to ${Math.min(...v).toFixed(1)} V.</b> Below about 12.2 V a lead-acid battery is under half charged; a few more days could mean a slow start.`);
    if (has('shunt_soc_pct')) { const days = (b - a) / 864e5; const used = first('shunt_soc_pct') - last('shunt_soc_pct'); if (days >= 0.75 && used > 0) notes.push(`The house battery used about <b>${(used / days).toFixed(0)}% a day</b>${has('sol_pv_w') ? ', with solar putting some back each afternoon' : ''}.`); }
    if (has('fridge_C')) { const f = col('fridge_C').filter(x => !isNaN(x)); const hi = F(Math.max(...f)); notes.push(hi > 41 ? `<b class=am>The fridge reached ${Math.round(hi)}°F.</b> Food safety guidance is 40°F or below.` : `The fridge stayed at or below ${Math.round(hi)}°F the whole time.`); }
    if (notes.length) h += `<div class=cd><b>WHAT STANDS OUT</b>${notes.map(x => `<p>${x}</p>`).join('')}</div>`;
    h += `<div class=rd id=RD></div><p class=nt style="margin:0 2px 8px">${OC.MOUSE ? 'Move the mouse' : 'Slide a finger'} along any chart to read every one at that time.</p>`;
    const l0 = day(a), l1 = day(b);
    charts.length = 0;
    if (has('volts')) h += chart('C1', 'Starter battery', 'V', t, [{ v: col('volts'), col: '#4da3ff', label: 'starter' }], { l0, l1, span: 1, lines: [{ y: 12.2, col: '#ff5e5e', label: 'half charged' }] });
    if (has('shunt_soc_pct')) h += chart('C2', 'House battery', '%', t, [{ v: col('shunt_soc_pct'), col: '#3ddc5b', label: 'charge' }], { l0, l1, min: 0, max: 100 });
    if (has('sol_pv_w')) h += chart('C3', 'Solar', 'W', t, [{ v: col('sol_pv_w'), col: '#ffb000', label: 'solar' }], { l0, l1, min: 0, span: 10 });
    if (has('fridge_C') || has('freezer_C')) h += chart('C4', 'Fridge and freezer', '°F', t, [{ v: col('fridge_C').map(F), col: '#4dd0e1', label: 'fridge' }, ...(has('freezer_C') ? [{ v: col('freezer_C').map(F), col: '#c678dd', label: 'freezer' }] : [])], { l0, l1, span: 10 });
    if (has('cabin_C') || has('outside_C')) h += chart('C5', 'Inside and outside', '°F', t, [{ v: col('cabin_C').map(F), col: '#ff9f43', label: 'inside' }, { v: col('outside_C').map(F), col: '#9aa0a6', label: 'outside' }], { l0, l1, span: 10 });
    if (has('baro_hpa')) h += chart('C6', 'Barometer (weather)', 'hPa', t, [{ v: col('baro_hpa'), col: '#9aa0a6', label: 'pressure' }], { l0, l1, span: 4 });
    T.innerHTML = h;
    T.querySelectorAll('.pkr .oa').forEach(x => x.onclick = () => { if (!x.disabled) location.hash = '#p=' + x.dataset.n; });
    T.querySelector('.pkr .om').onclick = () => {
      const ov = document.createElement('div'); ov.className = 'ocov';
      ov.innerHTML = '<div class=ocls><b>PICK A PARK</b>' + P.map((q, i) => { const s0 = q.t[0], s1 = q.t[q.t.length - 1]; const so = q.R.map(r => num(r.shunt_soc_pct)).filter(x => !isNaN(x)); return `<button data-n=${i} class="${i === n ? 'on' : ''}">${day(s0)}${day(s0) !== day(s1) ? ' to ' + day(s1) : ''} · ${dur(s1 - s0)}<i>${so.length > 1 ? 'house ' + Math.round(so[0]) + '% → ' + Math.round(so[so.length - 1]) + '%' : ''}</i></button>`; }).join('') + '<button class=x>CLOSE</button></div>';
      ov.onclick = e => { const k = e.target.closest('button')?.dataset.n; if (k != null) { ov.remove(); location.hash = '#p=' + k; } else if (e.target === ov || e.target.classList.contains('x')) ov.remove(); };
      document.body.appendChild(ov);
    };
    bindCursor(t, i => {
      const r = R[i], parts = [];
      if (!isNaN(num(r.volts))) parts.push('starter ' + (+r.volts).toFixed(2) + ' V');
      if (!isNaN(num(r.shunt_soc_pct))) parts.push('house ' + Math.round(+r.shunt_soc_pct) + '%');
      if (!isNaN(num(r.sol_pv_w))) parts.push('solar ' + Math.round(+r.sol_pv_w) + ' W');
      if (!isNaN(num(r.fridge_C))) parts.push('fridge ' + Math.round(F(+r.fridge_C)) + '°F');
      if (!isNaN(num(r.cabin_C))) parts.push('inside ' + Math.round(F(+r.cabin_C)) + '°F');
      if (!isNaN(num(r.outside_C))) parts.push('outside ' + Math.round(F(+r.outside_C)) + '°F');
      return `<b>${dayLong(t[i])} ${ampm(t[i])}</b>${parts.join(' · ')}`;
    });
  }

  // ── PAGE: BATTERY ─────────────────────────────────────────────────────────
  // The starter battery's test is the one a shop does: how far the volts dip
  // while the starter cranks. Above 10 V is healthy; 9.6 V is the usual
  // pass line for a load test; below it the battery is weak. The charging
  // volts say whether the alternator is doing its job (13.8 to 14.8 V).
  async function pageBattery() {
    title('TRUCK'); T.innerHTML = tabs('b') + '<p class=nt>Reading the card…</p>';
    const B = await read('battlog.csv');
    const of = k => B.filter(r => r.type === k).map(r => ({ t: tm(r.timestamp), v: +r.volts })).filter(x => !isNaN(x.v));
    const crank = of('CRANK'), rest = of('REST'), chrg = of('CHRG');
    let h = tabs('b');
    if (!crank.length && !rest.length) { T.innerHTML = h + '<p class=nt>No battery readings on the card yet. The clock logs one at every start.</p>'; return; }
    // a session can log several CRANK rows (each a new low): keep each start's lowest
    const starts = []; for (const c of crank) { const l = starts[starts.length - 1]; if (l && c.t - l.t < 10 * 6e4) { if (c.v < l.v) l.v = c.v; } else starts.push({ t: c.t, v: c.v }); }
    const lastC = starts[starts.length - 1], lastR = rest[rest.length - 1], lastG = chrg[chrg.length - 1];
    const verdict = !lastC ? null : lastC.v >= 10 ? ['HEALTHY', '#3ddc5b', 'The last start dipped to ' + lastC.v.toFixed(2) + ' V. A healthy battery stays above 10 V while cranking.'] : lastC.v >= 9.6 ? ['WATCH IT', '#ffb000', 'The last start dipped to ' + lastC.v.toFixed(2) + ' V, between 9.6 and 10 V. It still passes, but it is getting weaker. Cold mornings make it worse.'] : ['WEAK', '#ff5e5e', 'The last start dipped to ' + lastC.v.toFixed(2) + ' V, below 9.6 V, the usual pass line for a battery load test. Have it tested.'];
    h += `<h3>STARTER BATTERY <span>EVERY START ON THE CARD</span></h3>`;
    if (verdict) h += `<div class=cd><div class=vd><span class=dot style="background:${verdict[1]}"></span><b style="color:${verdict[1]}">${verdict[0]}</b></div><p>${verdict[2]}</p>`;
    // trend: the last 10 starts against the first 10
    if (starts.length >= 12) {
      const avg = a => a.reduce((s, x) => s + x.v, 0) / a.length; const k = Math.min(10, starts.length >> 1);
      const d = avg(starts.slice(-k)) - avg(starts.slice(0, k));
      h += `<p>${Math.abs(d) < 0.15 ? `The cranking dip has held steady since ${day(starts[0].t)}.` : d < 0 ? `<b class=am>The cranking dip is ${Math.abs(d).toFixed(1)} V deeper than it was in ${MON[starts[0].t.getMonth()]}.</b> That is how a battery ages: watch it.` : `The cranking dip is ${d.toFixed(1)} V better than in ${MON[starts[0].t.getMonth()]}.`}</p>`;
    }
    h += `<div class=st>${lastR ? `<div><b>${lastR.v.toFixed(2)} V</b><small>at rest</small></div>` : ''}${lastC ? `<div><b>${lastC.v.toFixed(2)} V</b><small>cranking</small></div>` : ''}${lastG ? `<div><b>${lastG.v.toFixed(2)} V</b><small>charging</small></div>` : ''}</div></div>`;
    h += `<div class=rd id=RD></div>`;
    charts.length = 0;
    if (starts.length > 1) h += chart('B1', 'Cranking dip, each start', 'V', starts.map(x => x.t), [{ v: starts.map(x => x.v), col: '#4da3ff', label: 'dip' }], { dots: true, l0: day(starts[0].t), l1: day(lastC.t), span: 1.5, lines: [{ y: 10, col: '#3ddc5b', label: 'healthy above 10' }, { y: 9.6, col: '#ff5e5e', label: 'weak below 9.6' }] });
    if (rest.length > 1) h += chart('B2', 'Resting volts, before each start', 'V', rest.map(x => x.t), [{ v: rest.map(x => x.v), col: '#9aa0a6', label: 'rest' }], { dots: true, l0: day(rest[0].t), l1: day(lastR.t), span: 1, lines: [{ y: 12.6, col: '#3ddc5b', label: 'fully charged 12.6' }, { y: 12.2, col: '#ff5e5e', label: 'half 12.2' }] });
    if (chrg.length > 1) {
      const lo = Math.min(...chrg.map(x => x.v)), hi = Math.max(...chrg.map(x => x.v));
      h += chart('B3', 'Charging volts, engine running', 'V', chrg.map(x => x.t), [{ v: chrg.map(x => x.v), col: '#3ddc5b', label: 'charging' }], { dots: true, l0: day(chrg[0].t), l1: day(lastG.t), span: 1.2, lines: [{ y: 13.8, col: '#ffb000', label: '13.8' }, { y: 14.8, col: '#ffb000', label: '14.8' }] });
      h += `<p class=nt>${lo >= 13.7 && hi <= 14.9 ? `<span class=ok>The alternator is charging normally</span> (${lo.toFixed(1)} to ${hi.toFixed(1)} V; normal is about 13.8 to 14.8 V).` : `<span class=am>Charging ran ${lo.toFixed(1)} to ${hi.toFixed(1)} V.</span> Normal is about 13.8 to 14.8 V; outside that, have the alternator checked.`}</p>`;
    }
    // the house battery, from the key-on / key-off snapshots
    const HL = await readMonths('health-');
    const soc = HL.filter(r => r.shunt_soc_pct !== '' && !isNaN(+r.shunt_soc_pct));
    const cells = HL.filter(r => r.cell1_mv && +r.cell1_mv > 0);
    if (soc.length > 1 || cells.length) {
      h += `<h3>HOUSE BATTERY <span>AT EACH KEY-ON AND KEY-OFF</span></h3>`;
      const soh = HL.map(r => num(r.batt_soh_pct)).filter(x => !isNaN(x));
      if (soh.length) h += `<div class=cd><div class=vd><span class=dot style="background:${soh[soh.length - 1] >= 80 ? '#3ddc5b' : '#ffb000'}"></span><b>${Math.round(soh[soh.length - 1])}% HEALTH</b></div><p>The battery's own estimate of how much of its original capacity is left.</p></div>`;
      if (soc.length > 1) h += chart('B4', 'Charge', '%', soc.map(r => tm(r.timestamp)), [{ v: soc.map(r => +r.shunt_soc_pct), col: '#3ddc5b', label: 'charge' }], { dots: true, min: 0, max: 100, l0: day(tm(soc[0].timestamp)), l1: day(tm(soc[soc.length - 1].timestamp)) });
      if (cells.length > 1) {
        const spread = cells.map(r => { const c = [1, 2, 3, 4].map(i => +r['cell' + i + '_mv']).filter(x => x > 0); return Math.max(...c) - Math.min(...c); });
        h += chart('B5', 'Cell balance (gap between cells)', 'mV', cells.map(r => tm(r.timestamp)), [{ v: spread, col: '#c678dd', label: 'gap' }], { dots: true, min: 0, span: 50, lines: [{ y: 50, col: '#ffb000', label: 'watch above 50 mV' }], l0: day(tm(cells[0].timestamp)), l1: day(tm(cells[cells.length - 1].timestamp)) });
      }
    }
    T.innerHTML = h;
    bindCursor(starts.length > 1 ? starts.map(x => x.t) : rest.map(x => x.t), i => { const s = starts[i]; return s ? `<b>${dayLong(s.t)} ${ampm(s.t)}</b>cranking dip ${s.v.toFixed(2)} V` : ''; });
  }

  // ── PAGE: ENGINE ──────────────────────────────────────────────────────────
  // One summary per drive in eng-YYYY-MM.csv, a row per driving condition
  // (IDLE / LOW / HIGH / LOAD) and engine warmth. The readiness bits are the
  // engine computer's own self-tests: a smog check wants them finished.
  const MONS = ['Misfire', 'Fuel system', 'Components', 'Catalyst', 'Heated catalyst', 'Evaporative (EVAP)', 'Secondary air', 'A/C', 'Oxygen sensors', 'O2 sensor heaters', 'EGR'];
  async function pageEngine() {
    title('TRUCK'); T.innerHTML = tabs('e') + '<p class=nt>Reading the card…</p>';
    const E = await readMonths('eng-');
    let h = tabs('e');
    if (!E.length) { T.innerHTML = h + '<p class=nt>No engine summaries on the card yet. The clock writes one per drive when the engine computer answers.</p>'; return; }
    // per drive: the warm cruise rows (LOW and HIGH) are where trims mean the most
    const D = new Map();
    for (const r of E) {
      let d = D.get(r.drive_id); if (!d) { d = { id: r.drive_id, t: tm(r.drive_id.replace('T', ' ')), mil: +r.mil, stored: +r.stored, pending: +r.pending, sup: +r.mon_sup, inc: +r.mon_inc, trim: [], cool: -1e9, trans: -1e9 }; D.set(r.drive_id, d); }
      if (r.warm === '1' && (r.cond === 'LOW' || r.cond === 'HIGH') && r.ltft_avg !== '') d.trim.push(+r.ltft_avg + (+r.stft_avg || 0));
      if (r.coolant_max !== '') d.cool = Math.max(d.cool, +r.coolant_max);
      if (r.trans_max !== '' && r.trans_max != null) d.trans = Math.max(d.trans, +r.trans_max);
      d.mil = Math.max(d.mil, +r.mil || 0); d.stored = Math.max(d.stored, +r.stored || 0); d.pending = Math.max(d.pending, +r.pending || 0);
      if (r.mon_sup !== '') { d.sup = +r.mon_sup; d.inc = +r.mon_inc; }
    }
    const DR = [...D.values()].sort((a, b) => a.t - b.t), last = DR[DR.length - 1];
    // readiness: bits 3-10 (the once-per-drive tests); 0-2 run all the time
    const want = []; for (let b = 3; b < 11; b++) if (last.sup & (1 << b)) want.push(b);
    const notReady = want.filter(b => last.inc & (1 << b));
    h += `<h3>READY FOR SMOG? <span>AS OF ${day(last.t).toUpperCase()}</span></h3><div class=cd>`;
    h += last.mil ? `<div class=vd><span class=dot style="background:#ff5e5e"></span><b class=bad>CHECK ENGINE LIGHT ON</b></div><p>A lit light fails a smog check. See the codes on the CODES tab.</p><a class=mo href="/dc">SEE THE CODES ›</a>`
      : !want.length ? `<div class=vd><span class=dot style="background:#777"></span><b>NO ANSWER YET</b></div><p>The engine computer has not reported its self-tests yet.</p>`
      : notReady.length ? `<div class=vd><span class=dot style="background:#ffb000"></span><b class=am>${notReady.length} NOT READY YET</b></div><p>The engine computer has not finished ${notReady.length === 1 ? 'this self-test' : 'these self-tests'} since the codes were last cleared or the battery was disconnected. A few days of mixed driving usually finishes ${notReady.length === 1 ? 'it' : 'them'}. Many states allow one or two not ready; check yours.</p>`
      : `<div class=vd><span class=dot style="background:#3ddc5b"></span><b class=ok>ALL READY</b></div><p>Every self-test this engine runs has finished, and the check engine light is off.</p>`;
    if (want.length) h += '<div style="margin-top:8px">' + want.map(b => `<div class=ln><span>${MONS[b]}</span><span class="${last.inc & (1 << b) ? 'am' : 'ok'}">${last.inc & (1 << b) ? 'not ready' : 'ready'}</span></div>`).join('') + '</div>';
    if (last.stored || last.pending) h += `<p><b class=am>${last.stored} stored, ${last.pending} pending code${last.stored + last.pending === 1 ? '' : 's'}.</b></p><a class=mo href="/dc">SEE THE CODES ›</a>`;
    h += '</div>';
    // fuel trims
    const tr = DR.filter(d => d.trim.length);
    h += `<div class=rd id=RD></div>`;
    charts.length = 0;
    if (tr.length > 1) {
      const v = tr.map(d => d.trim.reduce((a, x) => a + x, 0) / d.trim.length);
      const recent = v.slice(-5).reduce((a, x) => a + x, 0) / Math.min(5, v.length), early = v.slice(0, 5).reduce((a, x) => a + x, 0) / Math.min(5, v.length);
      h += `<h3>FUEL TRIMS <span>WARM, AT CRUISE, EACH DRIVE</span></h3><div class=cd><p style="margin:0">${Math.abs(recent) <= 10 ? `<span class=ok>Normal.</span> The engine computer is adding ${recent >= 0 ? recent.toFixed(1) + '% more' : Math.abs(recent).toFixed(1) + '% less'} fuel than its base map, inside the usual ±10%.` : `<b class=am>The engine computer is adding ${recent >= 0 ? recent.toFixed(0) + '% more' : Math.abs(recent).toFixed(0) + '% less'} fuel than its base map.</b> Beyond ±10% usually means ${recent > 0 ? 'extra air getting in (a vacuum leak) or a weak fuel supply' : 'too much fuel (a leaking injector) or a sensor reading wrong'}. Worth a look.`}${Math.abs(recent - early) >= 3 ? ` <b class=am>It has moved ${(recent - early).toFixed(1)} points since ${day(tr[0].t)}</b>; a slow drift is the early sign.` : ''}</p></div>`;
      h += chart('E1', 'Total fuel trim', '%', tr.map(d => d.t), [{ v, col: '#4da3ff', label: 'trim' }], { dots: true, span: 12, lines: [{ y: 10, col: '#ffb000', label: '+10%' }, { y: -10, col: '#ffb000', label: '−10%' }, { y: 0, col: '#555', label: '' }], l0: day(tr[0].t), l1: day(tr[tr.length - 1].t) });
    }
    const co = DR.filter(d => d.cool > -1e9), tx = DR.filter(d => d.trans > -1e9);
    if (co.length > 1 || tx.length > 1) {
      h += `<h3>TEMPERATURES <span>HOTTEST EACH DRIVE</span></h3>`;
      if (co.length > 1) { const hi = Math.max(...co.map(d => F(d.cool))); h += chart('E2', 'Coolant', '°F', co.map(d => d.t), [{ v: co.map(d => F(d.cool)), col: '#ff9f43', label: 'coolant' }], { dots: true, span: 20, lines: [{ y: 230, col: '#ff5e5e', label: 'hot 230°F' }], l0: day(co[0].t), l1: day(co[co.length - 1].t) }); h += `<p class=nt>${hi < 220 ? `<span class=ok>Normal.</span> The hottest drive reached ${Math.round(hi)}°F.` : `<b class=am>A drive reached ${Math.round(hi)}°F.</b> Watch the coolant level and the fan.`}</p>`; }
      if (tx.length > 1) { const hi = Math.max(...tx.map(d => F(d.trans))); h += chart('E3', 'Transmission', '°F', tx.map(d => d.t), [{ v: tx.map(d => F(d.trans)), col: '#c678dd', label: 'trans' }], { dots: true, span: 20, lines: [{ y: 220, col: '#ff5e5e', label: 'hot 220°F' }], l0: day(tx[0].t), l1: day(tx[tx.length - 1].t) }); h += `<p class=nt>${hi < 200 ? `<span class=ok>Normal.</span> The hottest drive reached ${Math.round(hi)}°F.` : `<b class=am>A drive reached ${Math.round(hi)}°F.</b> Fluid life drops fast above 200°F: towing, hills and heat do it.`}</p>`; }
    }
    T.innerHTML = h;
    const pts = tr.length > 1 ? tr : co;
    bindCursor(pts.map(d => d.t), i => { const d = pts[i]; return `<b>${dayLong(d.t)} ${ampm(d.t)} drive</b>${d.trim.length ? 'trim ' + (d.trim.reduce((a, x) => a + x, 0) / d.trim.length).toFixed(1) + '%' : ''}${d.cool > -1e9 ? ' · coolant ' + Math.round(F(d.cool)) + '°F' : ''}${d.trans > -1e9 ? ' · trans ' + Math.round(F(d.trans)) + '°F' : ''} · <a class=mo style="margin:0" href="/tr#d=${d.id.slice(0, 10)}">SEE THE DRIVE ›</a>`; });
  }

  async function route() {
    const h = location.hash;
    try {
      FILES = await OC.files();
      if (h === '#b') return await pageBattery();
      if (h === '#e') return await pageEngine();
      return await pageParked(+(h.match(/^#p=(\d+)/)?.[1] || 0));
    } catch (e) { T.innerHTML = '<p class=nt>Could not read the card: ' + H(e.message || e) + '</p>'; }
  }
  const sc = document.createElement('script'); sc.src = '/file?n=common.js&d=www';
  sc.onload = () => { OC = window.OC; addEventListener('hashchange', () => { scrollTo(0, 0); route(); }); route(); };
  sc.onerror = () => { T.innerHTML = '<p class=nt>common.js is not on the card. Copy the <b>www</b> folder from the firmware zip to the card, then reload.</p>'; };
  document.head.appendChild(sc);
})();
