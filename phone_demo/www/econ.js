// econ.js - the phone's ECONOMY tab (0.99.153). Lives on the card at
// /www/econ.js and is loaded by the /ec shell (wifi_page.h PAGE_ECON). The
// map, the card reads and the month picker are in /www/common.js.
//
// Derek, 2026-11-07: "should we have a dedicated fuel/econ page on the phone?"
// Everything is worked out by the phone from the card's own files, fetched
// through /file:
//   econ-YYYY-MM.csv      the clock's ECONOMY rows (a row every 5 minutes of a
//                         drive, cumulative; the last row of each drive counts)
//   telemetry-*.csv       days from before econ files existed: the same numbers
//                         worked out here once (MAF -> gallons, speed -> bands)
//                         and kept in this phone's storage
//   trips-YYYY-MM.csv     every mile driven (the TRIPS tab's total), so the
//                         two tabs agree; fuel is known only where the engine
//                         answered
//   fuellog.csv           fill-ups, prices, the clock's estimate vs the pump
//   fuelspots_learned.csv stations the clock learned; POST /fsn names one
// Spend is fuel BURNED x price PAID (Derek: "better than nothing").
//
// 2026-11-12, Derek's review: the calendar month picker; TOTAL on a finished
// month; "time spent idling" in words; every station has its own page (map,
// totals, its fill-ups, the name box); tap a chart for that day or that speed;
// anything that looks like a button does something.
//
// PAGES (by location.hash): '' or #m=YYYY-MM   the month
//                           #s=n:NAME or #s=p:LAT,LON   one station
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const T = $('#T');
  const title = t => { const h = $('h1.pt'); if (h) h.textContent = t; };
  const MI = 0.621371, BANDS = 9, IDLE_MPH = 2;
  let OC = null;
  const css = document.createElement('style');
  css.textContent = `
#T .pg b{display:block;color:#ffb000;font:800 18px var(--cd,system-ui)}#T .pg small{color:#949494;font:700 12px system-ui;letter-spacing:.5px}#T .pg .pb{position:relative;height:14px;background:#262626;border-radius:7px;overflow:hidden;margin:16px 0 8px}#T .pg .pb i{position:absolute;left:0;top:0;margin:0;display:block;height:100%;background:#ffb000;border-radius:7px}#T .pg .pn{display:flex;justify-content:space-between;font:700 14px system-ui}#T .pg p{color:#aaa;font-size:14px;margin:12px 0 0}
#T{padding-bottom:12px}
#T h3{font:800 18px var(--cd,system-ui);color:#ffb000;text-transform:uppercase;margin:22px 0 8px;display:flex;justify-content:space-between;align-items:baseline;gap:8px}#T h3 span{color:#949494;font:600 12px system-ui;text-align:right}
#T .bk{display:block;color:#ffb000;font:700 14px system-ui;margin:-4px 0 10px;text-decoration:none}
#T .cd{background:#141414;border-radius:12px;padding:16px;margin:0 0 10px}
#T .big{font:800 46px system-ui;line-height:1}#T .big small{font:700 16px system-ui;color:#949494;margin-left:6px}
#T .st{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px}#T .st>div{border-radius:10px;padding:10px 6px;text-align:center}
#T .st>div.tp{background:#1c1c1c;cursor:pointer}#T .st>div.tp small:after{content:' ›';color:#ffb000}
#T .st b{display:block;font-size:19px}#T .st small{color:#949494;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
#T .gr{background:#141414;border-radius:12px;padding:12px 12px 6px;margin-bottom:10px}#T .gr>small{color:#949494;font-size:11px;text-transform:uppercase;letter-spacing:.5px}#T .gr svg{display:block;width:100%}#T .gr [data-k]{cursor:pointer}
#T .nt{color:#949494;font-size:13px;margin:6px 2px 0}
#T .rw{display:flex;justify-content:space-between;align-items:center;background:#141414;border-radius:12px;padding:12px 14px;margin-bottom:8px;color:inherit;text-decoration:none}
#T .rw .lf{min-width:0;flex:1}#T .rw .lf b{display:block;font-size:17px}#T .rw .lf small{color:#949494;font-size:13px;display:block}
#T .rw .r{text-align:right;flex:none;margin-left:10px}#T .rw .r b{font-size:19px;display:block}#T .rw .r small{color:#949494;font-size:12px}
#T .ch{color:#666;margin-left:8px;font-size:20px;flex:none}#T .rw.hi{outline:2px solid #ffb000}
#T .rw *,#T .big *,#T .st *{background:transparent}#T .ok{color:#7fd13b}#T .am{color:#ffb000}
#T .dp{background:#1d1a10;border:1.5px solid #ffb000;border-radius:12px;padding:12px 14px;margin:-2px 0 10px}#T .dp b{display:block;font-size:16px}#T .dp small{display:block;color:#bbb;font-size:13px;margin-top:2px}#T .dp a{display:inline-block;margin-top:8px;color:#ffb000;font:800 13px system-ui;text-decoration:none}
#T .cd.tp{cursor:pointer}#T .cd .mo{color:#ffb000;font:700 13px system-ui;margin-top:8px}
#T .ll{margin-top:10px;border-top:1px solid #262626}#T .ll div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #262626;font-size:14px}#T .ll small{color:#949494}
#T .nm{display:flex;gap:8px;margin-top:8px}#T .nm input{flex:1;min-width:0;background:#000;border:1px solid #333;border-radius:8px;color:#fff;padding:10px;font:600 15px system-ui;text-transform:uppercase}#T .nm button{height:44px;border:2px solid #ffb000;background:none;color:#ffb000;border-radius:8px;font:800 14px system-ui;padding:0 14px}
#T .btn{display:block;text-align:center;border:2px solid #ffb000;color:#ffb000;border-radius:12px;padding:14px;font:800 18px system-ui;margin:16px 0;background:none;width:100%}
#T .mp{background:#0b0b0b;border-radius:12px;overflow:hidden;position:relative;height:230px;touch-action:none;margin-bottom:10px}#T .mp canvas{display:block;width:100%;height:100%}
html.lt #T .cd,html.lt #T .rw,html.lt #T .gr{background:#fff}html.lt #T .st>div.tp{background:#eceef2}html.lt #T .big{color:#111}html.lt #T .nm input{background:#fff;color:#111;border-color:#ccc}html.lt #T .dp{background:#fff7e0}html.lt #T .dp small{color:#555}html.lt #T .mp{background:#f7f7f9}`;
  document.head.appendChild(css);
  const LT = () => document.documentElement.classList.contains('lt');
  const fg = () => LT() ? '#111' : '#fff', dim = () => LT() ? '#bbb' : '#444', grn = () => LT() ? '#4c9a12' : '#7fd13b', AM = '#ffb000';
  const H = s => String(s).replace(/[&<>"]/g, c => '&#' + c.charCodeAt(0) + ';');
  const MON = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], Mon = m => MON[m].slice(0, 1) + MON[m].slice(1, 3).toLowerCase();
  const usd = (v, d) => '$' + (+v).toFixed(d == null ? 0 : d);
  const dim0 = (y, m) => new Date(y, m, 0).getDate();
  const dayName = k => { const d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)); return DOW[d.getDay()] + ' ' + Mon(d.getMonth()) + ' ' + d.getDate(); };
  const mins = s => { const m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; };

  // ── the card ──────────────────────────────────────────────────────────────
  let FILES = {};
  const text = n => OC.text(n);
  const lines = t => t.split(/\r?\n/).filter(l => l && l[0] !== '#');
  function table(t) { const L = lines(t); if (!L.length) return []; const h = L[0].split(','); return L.slice(1).map(l => { const c = l.split(','), o = {}; h.forEach((k, i) => o[k] = c[i]); return o; }); }
  function cache(k, size, make) {
    let c = null; try { c = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
    if (c && c.s === size) return Promise.resolve(c.v);
    return make().then(v => { try { localStorage.setItem(k, JSON.stringify({ s: size, v })); } catch (e) {} return v; });
  }

  // a day: {mi, gal (raw), spend, idleS, idleG, bm[9], bg[9]}
  const blank = () => ({ mi: 0, gal: 0, spend: 0, idleS: 0, idleG: 0, bm: new Array(BANDS).fill(0), bg: new Array(BANDS).fill(0) });
  const add = (a, b) => { a.mi += b.mi; a.gal += b.gal; a.spend += b.spend; a.idleS += b.idleS; a.idleG += b.idleG; for (let i = 0; i < BANDS; i++) { a.bm[i] += b.bm[i]; a.bg[i] += b.bg[i]; } return a; };

  // the clock's econ rows: the last row of each drive, filed under its date
  async function econDays() {
    const days = {};
    for (const n of Object.keys(FILES).filter(n => /^econ-\d{4}-\d{2}\.csv$/.test(n)).sort()) {
      const last = {};
      for (const r of table(await text(n))) last[r.drive_id] = r;
      for (const r of Object.values(last)) {
        const d = r.drive_id.slice(0, 10), x = days[d] || (days[d] = blank());
        const o = blank(); o.mi = +r.miles; o.gal = +r.gal_raw; o.spend = +r.spend_usd; o.idleS = +r.idle_s; o.idleG = +r.idle_gal_raw;
        for (let b = 0; b < BANDS; b++) { o.bm[b] = +r['b' + b * 10 + '_mi'] || 0; o.bg[b] = +r['b' + b * 10 + '_gal'] || 0; }
        add(x, o);
      }
    }
    return days;
  }
  // a telemetry day worked out here (raw gallons; spend priced below)
  function teleDay(t) {
    const rows = table(t); const o = blank(); let lastE = null, lastId = null;
    let cal = 1; const m = /speed_cal=([\d.]+)/.exec(t.slice(0, 600)); if (m) cal = +m[1];
    for (const r of rows) {
      const e = +r.elapsed_s; const dt = (lastId === r.drive_id && lastE != null) ? Math.min(Math.max(e - lastE, 0), 5) : 1;
      lastE = e; lastId = r.drive_id;
      if (!r.rpm || !(+r.rpm > 300)) continue;
      const g = (+r.maf_g_s || 0) * dt / 14.7 / 2835;
      const kph = r.gps_speed_kmh !== '' && r.gps_speed_kmh != null && +r.gps_hdop < 2 ? +r.gps_speed_kmh : (+r.speed_kmh || 0) * cal;
      const mph = kph * MI, mi = mph * dt / 3600;
      o.gal += g; o.mi += mi;
      if (mph < IDLE_MPH) { o.idleS += dt; o.idleG += g; }
      else { const b = Math.min(BANDS - 1, Math.floor(mph / 10)); o.bm[b] += mi; o.bg[b] += g; }
    }
    return o;
  }
  // every mile driven, by day, from the TRIPS tab's own files (odometer)
  async function tripMiles() {
    const out = {};
    for (const n of Object.keys(FILES).filter(n => /^trips-\d{4}-\d{2}\.csv$/.test(n))) {
      const first = {}, last = {};
      for (const l of (await OC.cached(n, FILES[n])).split('\n')) {
        if (!l || l[0] < '0' || l[0] > '9') continue; const r = l.split(',');
        if (!(r[0] in first)) first[r[0]] = +r[6]; last[r[0]] = +r[6];
      }
      for (const id of Object.keys(first)) { const d = id.slice(0, 10); out[d] = (out[d] || 0) + Math.max(0, (last[id] - first[id]) * MI); }
    }
    return out;
  }

  let FUEL = [], LEARN = [];
  async function fuel() {
    if (FILES['fuellog.csv']) FUEL = table(await text('fuellog.csv')).map(r => ({ t: r.timestamp, date: (r.timestamp || '').slice(0, 10), gal: +r.gallons, ppg: +r.price_per_gal, usd: +r.total_cost_usd, mpg: +r.seg_mpg || 0, est: +r.obd_gal_since || 0, flag: r.flag, st: r.station || '', lat: +r.gps_lat || 0, lon: +r.gps_lon || 0 })).filter(f => f.date);
    if (FILES['fuelspots_learned.csv']) LEARN = lines(await text('fuelspots_learned.csv')).map(l => l.split(',')).filter(c => c.length >= 2 && !isNaN(+c[0]));
  }
  const priceOn = d => { let p = 0; for (const f of FUEL) if (f.date <= d && f.ppg > 0) p = f.ppg; return p || (FUEL.find(f => f.ppg > 0) || {}).ppg || 0; };
  function pooledCal() {          // the clock's pooled rule: newest clean fills up to 60 pumped gallons
    let g = 0, o = 0;
    for (const f of FUEL.slice().reverse()) { if (f.flag !== 'OK' || !(f.est > 0)) continue; if (g >= 60) break; g += f.gal; o += f.est; }
    return o > 0 ? g / o : 1;
  }

  // ── stations ──────────────────────────────────────────────────────────────
  // A station is a PLACE: fill-ups within ~150 m of each other (a name alone
  // would lump every Shell in the country together), plus the clock's learned
  // spot there. A fill with no position goes by its name. The key is what the
  // TRIPS tab links to: p:LAT,LON (any fill's position there) or n:NAME.
  const near = (a, b, c, d) => Math.abs(a - c) < 0.0014 && Math.abs(b - d) < 0.002;
  const fits = (x, lat, lon, nm) => x.lat && near(x.lat, x.lon, lat, lon) && (!x.n || !nm || x.n === nm);
  function stations() {
    const S = [];
    for (const f of FUEL) {
      let s = f.lat ? S.find(x => fits(x, f.lat, f.lon, f.st)) : S.find(x => !x.lat && x.n === f.st);
      if (!s) { s = { n: f.st, lat: f.lat, lon: f.lon, F: [], learn: null }; S.push(s); }
      if (!s.n && f.st) s.n = f.st;
      s.F.push(f);
    }
    for (const c of LEARN) {
      const lat = +c[0], lon = +c[1], nm = (c[2] || '').trim();
      let s = S.find(x => fits(x, lat, lon, nm));
      if (!s) { s = { n: nm, lat, lon, F: [], learn: null }; S.push(s); }
      s.learn = c; if (nm) s.n = nm;
    }
    S.forEach(s => { s.key = s.lat ? 'p:' + (+s.lat).toFixed(4) + ',' + (+s.lon).toFixed(4) : 'n:' + s.n; s.c = s.F.length; s.gal = s.F.reduce((a, f) => a + f.gal, 0); s.usd = s.F.reduce((a, f) => a + f.usd, 0); s.last = s.F.length ? s.F[s.F.length - 1].date : ''; });
    return S;
  }
  const findStation = key => {
    const S = stations();
    if (key.startsWith('p:')) { const [a, b] = key.slice(2).split(',').map(Number); return S.find(x => x.lat && near(x.lat, x.lon, a, b)); }
    return S.find(x => x.key === key);
  };
  const PLACE = {};
  async function placeOf(s) { const k = (+s.lat).toFixed(3) + ',' + (+s.lon).toFixed(3); if (!(k in PLACE)) PLACE[k] = s.lat ? await OC.nearestPlace(+s.lat, +s.lon, 30) : ''; return PLACE[k]; }

  // ── charts ────────────────────────────────────────────────────────────────
  // the month's running spend; a tap area per day (data-k = the date)
  function line(ym, days, vals, prev, max) {
    const W = 340, Hh = 110, x = d => 6 + (W - 12) * (d / days), y = v => Hh - 18 - (Hh - 30) * (v / max);
    let s = `<svg viewBox="0 0 ${W} ${Hh}">`;
    for (let d = 0; d <= days; d += 5) s += `<line x1=${x(d)} x2=${x(d)} y1=8 y2=${Hh - 18} stroke="${dim()}" stroke-dasharray="1 3"/>`;
    if (prev && prev.length > 1) s += `<polyline fill=none stroke="${dim()}" stroke-width=2 points="${prev.map((v, d) => x(d * days / (prev.length - 1)) + ',' + y(v)).join(' ')}"/>`;
    if (vals.length > 1) {
      s += `<polyline fill=none stroke="${grn()}" stroke-width=3 points="${vals.map((v, d) => x(d) + ',' + y(v)).join(' ')}"/>`;
      const n = vals.length - 1; s += `<circle cx=${x(n)} cy=${y(vals[n])} r=5 fill="${fg()}"/>`;
    }
    s += `<circle class=cur r=0 fill="${AM}"/>`;
    for (let d = 1; d <= days; d++) s += `<rect data-k="${ym}-${String(d).padStart(2, '0')}" x=${x(d - 1)} y=0 width=${x(d) - x(d - 1)} height=${Hh - 14} fill=transparent />`;
    return s + `<text x=6 y=${Hh - 2} fill="#949494" font-size=12>1ST</text><text x=${W - 6} y=${Hh - 2} fill="#949494" font-size=12 text-anchor=end>${days}TH</text></svg>`;
  }
  // bars; a tap area per bar (data-k = keys[i]); sel draws a white outline
  // (2026-11-14: the outline's stroke-width was unquoted and sat against the "/>". The
  // browser read the value as "2.5/" and the picked bar's <rect> never closed, so every
  // bar after it was swallowed inside it and vanished. Quote a value that ends a tag.)
  function bars(labels, vals, best, fmt, keys, sel) {
    const W = 340, Hh = 150, n = vals.length, sl = (W - 4) / n, pos = vals.filter(v => v > 0), mx = pos.length ? Math.max(...pos) : 1;
    let s = `<svg viewBox="0 0 ${W} ${Hh}">`;
    vals.forEach((v, i) => {
      const x = 2 + i * sl + 3, w = sl - 6, h = v > 0 ? (Hh - 52) * v / mx : 2, y = Hh - 20 - h, c = i === best ? AM : grn();
      s += v > 0 ? `<rect x=${x} y=${y} width=${w} height=${h} rx=3 fill="${c}" ${keys && keys[i] === sel ? `stroke="${fg()}" stroke-width="2.5"` : ''} />` : `<rect x=${x} y=${Hh - 22} width=${w} height=2 fill="${dim()}"/>`;
      if (v > 0) s += `<text x=${x + w / 2} y=${y - 6} fill="${i === best ? AM : '#949494'}" font-size=${i === best ? 15 : 12} font-weight=800 text-anchor=middle>${fmt(v)}</text>`;
      s += `<text x=${x + w / 2} y=${Hh - 4} fill="${i === best ? AM : '#949494'}" font-size=12 text-anchor=middle>${labels[i]}</text>`;
      if (keys) s += `<rect data-k="${keys[i]}" x=${2 + i * sl} y=0 width=${sl} height=${Hh} fill=transparent />`;
    });
    return s + '</svg>';
  }

  function progress(done, tot, t0, left) {
    const f = tot ? done / tot : 0, el = (Date.now() - t0) / 1000;
    const eta = done > 0 ? el / done * (tot - done) : tot / 250e3;   // ~250 KB/s until it knows
    const tl = eta < 60 ? 'under a minute' : 'about ' + Math.round(eta / 60) + ' min';
    return `<div class="cd pg"><b>WORKING OUT YOUR ECONOMY</b><small>FIRST TIME ONLY</small>
<div class=pb><i style="width:${(100 * f).toFixed(1)}%"></i></div>
<div class=pn><span>${(done / 1e6).toFixed(1)} of ${(tot / 1e6).toFixed(1)} MB</span><span>${tl} left</span></div>
<p>Reading ${left} older drive file${left === 1 ? '' : 's'} the clock wrote before it kept economy rows. Keep this screen open.</p>
<p>When it finishes, the result is saved on the card, so this page opens right away next time, on this phone or any other.</p></div>`;
  }
  // ── loading ───────────────────────────────────────────────────────────────
  let DAYS = {}, TMI = {}, CAL = 1, LOADED = false;
  async function load() {
    if (LOADED) return;
    title('ECONOMY'); T.innerHTML = '<p class=nt>Reading the card…</p>';
    await fuel(); CAL = pooledCal();
    DAYS = await econDays(); TMI = await tripMiles();
    // days another phone or computer already worked out (POST /upec, below)
    let saved = {};
    try { const r = await fetch(OC.fileUrl('econ.json', 'app')); if (r.ok) { const t = await r.text(); if (t.startsWith('# OVERCLOCK econ')) saved = JSON.parse(t.slice(t.indexOf('\n') + 1)); } } catch (e) {}
    for (const [d, o] of Object.entries(saved)) if (!DAYS[d] && o && o.mi >= 0) DAYS[d] = o;
    // days from before the clock wrote econ files: from telemetry, once, last 90 days
    const cut = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
    const todo = Object.keys(FILES).filter(n => /^telemetry-\d{4}-\d{2}-\d{2}\.csv$/.test(n)).map(n => [n, n.slice(10, 20)]).filter(([n, d]) => !DAYS[d] && d >= cut);
    // the first time only: a bar by bytes, with the time left (Derek: "2 of 17"
    // said nothing about how long). The worked-out days are then saved to the
    // card (/app/econ.json), so any phone or computer skips this next time.
    const fromTele = {};
    const tot = todo.reduce((a, [n]) => a + FILES[n], 0); let done = 0; const t0 = Date.now();
    for (let i = 0; i < todo.length; i++) {
      const [n, d] = todo[i];
      T.innerHTML = progress(done, tot, t0, todo.length - i);
      try {
        const o = await cache('oc_ec_' + n, FILES[n], async () => teleDay(await text(n)));
        o.spend = o.gal * CAL * priceOn(d); DAYS[d] = o; fromTele[d] = o;
      } catch (e) {}
      done += FILES[n];
    }
    if (todo.length) try { await fetch('/upec', { method: 'POST', body: '# OVERCLOCK econ v1\n' + JSON.stringify(Object.assign(saved, fromTele)) }); } catch (e) {}
    LOADED = true;
  }
  function month(ym) { const o = blank(), per = []; let tmi = 0; const [y, m] = ym.split('-').map(Number); for (let d = 1; d <= dim0(y, m); d++) { const k = ym + '-' + String(d).padStart(2, '0'); per.push(DAYS[k] ? DAYS[k].spend : 0); if (DAYS[k]) add(o, DAYS[k]); tmi += TMI[k] || 0; } return { o, per, tmi }; }
  const prevYm = ym => { let [y, m] = ym.split('-').map(Number); m--; if (!m) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); };
  const allMonths = () => [...new Set([...Object.keys(DAYS), ...Object.keys(TMI), ...FUEL.map(f => f.date)].map(d => d.slice(0, 7)))];
  const dayTrips = k => TMI[k] ? `<a href="/tr#d=${k}">SEE THIS DAY IN TRIPS ›</a>` : '';

  // ── PAGE: the month ───────────────────────────────────────────────────────
  let YM = null, PICK = { sp: null, mph: null, idle: null }, OPEN_LEARN = false;
  async function pageMonth() {
    await load(); title('ECONOMY');
    YM = location.hash.match(/#m=(\d{4}-\d{2})/)?.[1] || OC.thisYm();
    if (!Object.keys(DAYS).length && !FUEL.length) { T.innerHTML = '<p class=nt>No driving on the card yet. ECONOMY fills in as you drive.</p>'; return; }
    PICK = { sp: null, mph: null, idle: null };
    draw(); scrollTo(0, 0);
  }
  function draw() {
    const [y, m] = YM.split('-').map(Number), price = FUEL.length ? FUEL[FUEL.length - 1].ppg : 0;
    const { o, per, tmi } = month(YM), prev = month(prevYm(YM));
    const cur = YM === OC.thisYm(), done = YM < OC.thisYm();
    const cum = [0]; let run = 0, upto = 0; per.forEach((v, i) => { if (DAYS[YM + '-' + String(i + 1).padStart(2, '0')]) upto = i + 1; });
    if (!cur && upto) upto = per.length;
    for (let i = 0; i < upto; i++) { run += per[i]; cum.push(run); }
    const pc = [0]; let pr = 0; prev.per.forEach(v => { pr += v; pc.push(pr); });
    const galR = o.gal * CAL, idleCost = o.idleG * CAL * (price || 0);
    const allMi = Math.max(tmi, o.mi);
    const mp = OC.monthPicker(YM, allMonths(), mm => { location.hash = '#m=' + mm; });
    let h = mp.html + `<div class=cd><div class=big>${usd(o.spend)}<small>${done ? 'TOTAL' : 'SO FAR'}</small></div><p class=nt style="margin:4px 0 0">Fuel burned × price paid</p>
<div class=st><div class=tp data-go=SP><b>${o.mi > 1 ? usd(o.spend / o.mi, 2) : '--'}</b><small>PER MI</small></div><div class=tp data-go=MS><b>${galR > 0.1 ? (o.mi / galR).toFixed(1) : '--'}</b><small>MPG</small></div><div class=tp data-go=ID><b>${usd(idleCost, 2)}</b><small>IDLING</small></div></div></div>
<div class=gr id=SP><small>SPEND, DAY BY DAY · TAP A DAY</small>${line(YM, per.length, cum, pr > 0 ? pc : null, Math.max(10, run, pr) * 1.15)}</div><div id=SPd></div>
<p class=nt>${pr > 0 ? `Grey line: ${MON[(m + 10) % 12].slice(0, 3)} (${usd(pr)}). ` : ''}${o.mi.toFixed(0)} miles, ${galR.toFixed(1)} gallons burned.${allMi - o.mi > 5 ? ` <b class=am>Fuel is known for ${o.mi.toFixed(0)} of the ${allMi.toFixed(0)} miles driven</b>; the rest had no engine data (the engine link was down, or the drive is older than the card's drive files).` : ''}</p>`;
    // mpg by speed: every day on the card
    const all = blank(); Object.values(DAYS).forEach(d => add(all, d));
    const lab = ['10', '20', '30', '40', '50', '60', '70', '80'], mpg = [];
    for (let b = 1; b < BANDS; b++) mpg.push(all.bg[b] * CAL > 0.2 ? all.bm[b] / (all.bg[b] * CAL) : 0);
    let best = -1; mpg.forEach((v, i) => { if (v > 0 && (best < 0 || v > mpg[best])) best = i; });
    const mk = lab.map((x, i) => String(i));
    h += `<h3 id=MS>MPG BY SPEED <span>EVERY DRIVE ON THE CARD</span></h3><div class=gr id=MB><small>MPH (EACH BAR IS 10 MPH WIDE) · TAP A BAR</small>${bars(lab, mpg, best, v => v.toFixed(1), mk, PICK.mph)}</div><div id=MBd></div>`;
    if (best >= 0) h += `<p class=nt>Best at ${lab[best]}-${+lab[best] + 10} mph (${mpg[best].toFixed(1)} mpg).${mpg[5] > 0 && mpg[6] > 0 ? ` At 75 instead of 65 your truck uses about ${Math.max(0, 100 * (mpg[5] / mpg[6] - 1)).toFixed(0)}% more fuel.` : ''}</p>`;
    // idling: the month's last 7 days (this month: the last 7 up to today)
    const endD = cur ? new Date() : new Date(y, m - 1, dim0(y, m)), im = [], wl = [], wk = [];
    for (let k = 6; k >= 0; k--) { const t = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate() - k), key = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); im.push(DAYS[key] ? DAYS[key].idleS / 60 : 0); wl.push(String(t.getDate())); wk.push(key); }
    let ib = 0; im.forEach((v, i) => { if (v > im[ib]) ib = i; });
    const w0 = new Date(wk[0].slice(0, 4), +wk[0].slice(5, 7) - 1, +wk[0].slice(8, 10)), w6 = new Date(wk[6].slice(0, 4), +wk[6].slice(5, 7) - 1, +wk[6].slice(8, 10));
    h += `<h3 id=ID>TIME SPENT IDLING <span>ENGINE RUNNING, TRUCK STOPPED</span></h3><div class=cd><div class=st style="margin-top:0"><div><b>${mins(o.idleS)}</b><small>IDLING</small></div><div><b>${(o.idleG * CAL).toFixed(1)} gal</b><small>FUEL BURNED</small></div><div><b>${usd(idleCost, 2)}</b><small>FUEL COST</small></div></div></div>
<div class=gr id=IB><small>MINUTES IDLING · ${Mon(w0.getMonth()).toUpperCase()} ${w0.getDate()} TO ${w0.getMonth() !== w6.getMonth() ? Mon(w6.getMonth()).toUpperCase() + ' ' : ''}${w6.getDate()} · TAP A DAY</small>${bars(wl, im, im[ib] > 0 ? ib : -1, v => v.toFixed(0), wk, PICK.idle)}</div><div id=IBd></div>`;
    // fill-ups
    const F = FUEL.filter(f => f.date.slice(0, 7) === YM);
    const S = stations();
    const keyOf = f => (S.find(s => s.F.includes(f)) || {}).key || '';
    h += `<h3>FILL-UPS <span>${F.length} IN ${MON[m - 1].slice(0, 3)} · TAP FOR THE STATION</span></h3>`;
    if (!F.length) h += '<p class=nt>None logged this month.</p>';
    F.slice().reverse().forEach(f => {
      const ok = f.flag === 'OK' && f.est > 0, est = f.est * CAL, err = ok ? (f.gal / est - 1) * 100 : null;
      h += `<a class=rw href="#s=${encodeURIComponent(keyOf(f))}&f=${encodeURIComponent(f.t)}"><div class=lf><b>${H(f.st || 'Unnamed station')}</b><small>${f.date.slice(5).replace('-', '/')} · ${f.gal.toFixed(1)} gal at ${usd(f.ppg, 2)}${f.mpg ? ' · ' + f.mpg.toFixed(1) + ' mpg' : ''}</small>
<small>${err == null ? (f.flag && f.flag !== 'OK' ? H(f.flag.toLowerCase()) + ' fill' : '') : 'Clock guessed ' + est.toFixed(1) + ' gal, ' + (Math.abs(err) < 5 ? '<span class=ok>' : '<span class=am>') + Math.abs(err).toFixed(0) + '% ' + (err > 0 ? 'low' : 'high') + '</span>'}</small></div><div class=r><b>${usd(f.usd, 2)}</b></div><div class=ch>›</div></a>`;
    });
    // fuel learning: tap for the fill-ups it learns from
    const clean = FUEL.filter(f => f.flag === 'OK' && f.est > 0), n = clean.length;
    h += `<div class="cd tp" id=FL><b>FUEL LEARNING</b><p class=nt style="margin-top:6px">${n ? `Pooled over the last ${Math.min(n, 8)} clean fill-ups the clock's own estimate runs <b class=am>${Math.abs((CAL - 1) * 100).toFixed(0)}% ${CAL >= 1 ? 'low' : 'high'}</b>, so it corrects for that. A short fill and the next long one cancel out.` : 'Log a few full fill-ups and the clock learns how far off its own estimate runs.'}</p>`;
    if (n) h += OPEN_LEARN ? `<div class=ll>${clean.slice(-8).reverse().map(f => `<div><span>${f.date.slice(5).replace('-', '/')} ${H(f.st || 'Unnamed')}</span><span>guessed ${f.est.toFixed(1)} · <b>pumped ${f.gal.toFixed(1)} gal</b></span></div>`).join('')}<div><small>Guessed is the clock's own count before the correction.</small></div></div><div class=mo>HIDE ‹</div>` : '<div class=mo>SEE THE FILL-UPS IT LEARNS FROM ›</div>';
    h += '</div>';
    // stations: every one its own page
    h += `<h3>STATIONS <span>WHERE YOU FILL · TAP FOR THE MAP</span></h3>`;
    const SS = S.slice().sort((a, b) => (b.c - a.c) || (b.last < a.last ? -1 : 1));
    SS.forEach(s => {
      h += `<a class=rw href="#s=${encodeURIComponent(s.key)}"><div class=lf><b>${s.n ? H(s.n) : 'Unnamed station'}</b><small data-pl="${s.key}">${s.n ? '' : '<span class=am>Tap to name it</span> · '}${s.c ? s.c + ' fill-up' + (s.c > 1 ? 's' : '') + (s.last ? ' · last ' + s.last.slice(5).replace('-', '/') : '') : 'no fill-ups on this card'}</small></div>${s.c ? `<div class=r><b>${usd(s.F.reduce((a, f) => a + f.ppg, 0) / s.c, 2)}</b><small>AVG PER GAL</small></div>` : ''}<div class=ch>›</div></a>`;
    });
    h += `<button class=btn id=dl>DOWNLOAD ECONOMY (CSV)</button>`;
    T.innerHTML = h; mp.bind();
    // every station gets the nearest town, once the base map answers
    SS.filter(s => s.lat).forEach(async s => { const p = await placeOf(s); const el = T.querySelector(`[data-pl="${CSS.escape(s.key)}"]`); if (p && el) el.insertAdjacentHTML('afterbegin', 'Near ' + H(p) + ' · '); });
    T.querySelectorAll('.st .tp').forEach(t => t.onclick = () => $('#' + t.dataset.go).scrollIntoView({ behavior: 'smooth', block: 'center' }));
    // spend chart: a day
    const showSp = k => {
      const d = DAYS[k], el = $('#SPd'), c = $('#SP .cur');
      if (!k) { el.innerHTML = ''; c.setAttribute('r', 0); return; }
      const i = +k.slice(8, 10), W = 340, x = 6 + (W - 12) * ((i - 0.5) / per.length);
      c.setAttribute('cx', x); c.setAttribute('cy', 100); c.setAttribute('r', 4);
      const g = d ? d.gal * CAL : 0;
      el.innerHTML = `<div class=dp><b>${dayName(k)}</b><small>${d ? `${d.mi.toFixed(1)} mi · ${g.toFixed(1)} gal · ${usd(d.spend, 2)}${g > 0.1 ? ' · ' + (d.mi / g).toFixed(1) + ' mpg' : ''}` : TMI[k] ? `${TMI[k].toFixed(1)} mi driven, no engine data for fuel` : 'No driving this day.'}</small>${dayTrips(k)}</div>`;
    };
    $('#SP svg').querySelectorAll('[data-k]').forEach(r => r.onclick = () => { PICK.sp = PICK.sp === r.dataset.k ? null : r.dataset.k; showSp(PICK.sp); });
    // mpg by speed: a speed band
    const showMb = k => {
      $('#MB svg').outerHTML = bars(lab, mpg, best, v => v.toFixed(1), mk, k); bindMb();
      const el = $('#MBd'); if (k == null) { el.innerHTML = ''; return; }
      const b = +k + 1, tot = all.bm.reduce((a, x) => a + x, 0);
      el.innerHTML = `<div class=dp><b>${lab[k]}-${+lab[k] + 10} mph</b><small>${all.bm[b].toFixed(0)} mi · ${tot > 0 ? (100 * all.bm[b] / tot).toFixed(0) : 0}% of your driving · ${(all.bg[b] * CAL).toFixed(1)} gal${mpg[k] > 0 ? ' · ' + mpg[k].toFixed(1) + ' mpg' : ''}</small></div>`;
    };
    const bindMb = () => $('#MB svg').querySelectorAll('[data-k]').forEach(r => r.onclick = () => { PICK.mph = PICK.mph === r.dataset.k ? null : r.dataset.k; showMb(PICK.mph); });
    bindMb();
    // idling: a day
    const showIb = k => {
      $('#IB svg').outerHTML = bars(wl, im, im[ib] > 0 ? ib : -1, v => v.toFixed(0), wk, k); bindIb();
      const el = $('#IBd'); if (!k) { el.innerHTML = ''; return; }
      const d = DAYS[k], p = priceOn(k);
      el.innerHTML = `<div class=dp><b>${dayName(k)}</b><small>${d && d.idleS ? `${mins(d.idleS)} idling · ${(d.idleG * CAL).toFixed(2)} gal · ${usd(d.idleG * CAL * p, 2)}` : 'No idling logged.'}</small>${dayTrips(k)}</div>`;
    };
    const bindIb = () => $('#IB svg').querySelectorAll('[data-k]').forEach(r => r.onclick = () => { PICK.idle = PICK.idle === r.dataset.k ? null : r.dataset.k; showIb(PICK.idle); });
    bindIb();
    $('#FL').onclick = () => { if (!n) return; OPEN_LEARN = !OPEN_LEARN; const y0 = scrollY; draw(); scrollTo(0, y0); };
    $('#dl').onclick = () => {
      let csv = 'date,miles,gallons,mpg,spend_usd,idle_min,idle_gallons\n';
      Object.keys(DAYS).sort().forEach(d => { const x = DAYS[d], g = x.gal * CAL; csv += `${d},${x.mi.toFixed(1)},${g.toFixed(2)},${g > 0.1 ? (x.mi / g).toFixed(1) : ''},${x.spend.toFixed(2)},${(x.idleS / 60).toFixed(0)},${(x.idleG * CAL).toFixed(2)}\n`; });
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'overclock-economy.csv'; a.click();
    };
  }

  // ── PAGE: a station ───────────────────────────────────────────────────────
  async function pageStation(key, hiT) {
    await load();
    const s = findStation(key);
    const back = `<a class=bk href="#m=${YM || OC.thisYm()}">‹ ECONOMY</a>`;
    if (!s) { title('STATION'); T.innerHTML = back + '<p class="nt am">That station is not on the card.</p>'; return; }
    const pl = await placeOf(s);
    title(s.n || 'UNNAMED STATION');
    const avg = s.c ? s.F.reduce((a, f) => a + f.ppg, 0) / s.c : 0;
    let h = back + `<div class=mp id=M></div>${pl ? `<p class=nt style="margin:-4px 2px 10px">Near ${H(pl)}</p>` : ''}
<div class=st style="margin-top:0"><div><b>${s.c}</b><small>FILL-UPS</small></div><div><b>${s.gal.toFixed(1)}</b><small>GALLONS</small></div><div><b>${usd(s.usd)}</b><small>SPENT</small></div></div>
<div class=st style="margin-top:4px"><div><b>${s.c ? usd(avg, 2) : '--'}</b><small>AVG PER GAL</small></div><div><b>${s.c ? usd(Math.min(...s.F.map(f => f.ppg)), 2) : '--'}</b><small>LOWEST</small></div><div><b>${s.c ? usd(Math.max(...s.F.map(f => f.ppg)), 2) : '--'}</b><small>HIGHEST</small></div></div>`;
    if (s.learn) h += `<h3>${s.n ? 'RENAME THIS STATION' : 'NAME THIS STATION'}</h3><div class=cd><p class=nt style="margin:0 0 4px">The clock learned this station from a fill-up. The name shows on the clock's fill-up prompt and here.</p><div class=nm><input id=sn maxlength=20 value="${H(s.n || '')}" placeholder="E.G. ARCO WOODLAND"><button id=sb>SAVE</button></div><p class=nt id=sm></p></div>`;
    h += `<h3>FILL-UPS HERE <span>NEWEST FIRST</span></h3>`;
    if (!s.c) h += '<p class=nt>No fill-ups at this station on the card.</p>';
    s.F.slice().reverse().forEach(f => {
      h += `<a class="rw${f.t === hiT ? ' hi' : ''}" href="/tr#d=${f.date}"><div class=lf><b>${dayName(f.date)}</b><small>${f.gal.toFixed(1)} gal at ${usd(f.ppg, 2)}${f.mpg ? ' · ' + f.mpg.toFixed(1) + ' mpg' : ''}</small></div><div class=r><b>${usd(f.usd, 2)}</b><small>SEE THE DAY</small></div><div class=ch>›</div></a>`;
    });
    T.innerHTML = h;
    // the map: a pin per fill-up (they scatter a few metres), or the learned spot
    const pins = s.F.filter(f => f.lat).map(f => ({ lat: f.lat, lon: f.lon, col: '#e3342f' }));
    if (!pins.length && s.lat) pins.push({ lat: +s.lat, lon: +s.lon, col: '#e3342f' });
    if (pins.length) {
      const bb = OC.bboxOf(pins.map(p => [p.lat, p.lon])); const pad = 0.012;
      OC.makeMap($('#M'), [bb[0] - pad, bb[1] + pad, bb[2] - pad * 1.4, bb[3] + pad * 1.4], OC.routeDrawer([], pins, []));
    } else $('#M').outerHTML = '<p class=nt>No position for this station.</p>';
    const hi = T.querySelector('.rw.hi'); if (hi) hi.scrollIntoView({ block: 'center' });
    const sb = $('#sb');
    if (sb) sb.onclick = async () => {
      const v = $('#sn').value.trim().toUpperCase(); if (!v) return;
      $('#sm').textContent = 'Saving…';
      try {
        const r = await fetch('/fsn', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'lat=' + encodeURIComponent(s.learn[0]) + '&lon=' + encodeURIComponent(s.learn[1]) + '&n=' + encodeURIComponent(v) });
        const j = await r.json();
        if (j.ok) { s.learn[2] = v; $('#sm').innerHTML = '<span class=ok>Saved.</span> The clock uses it from the next fill-up prompt.'; title(v); }
        else $('#sm').textContent = j.why || 'Not saved.';
      } catch (e) { $('#sm').textContent = 'Not saved: lost the dash.'; }
    };
  }

  // ── routing ───────────────────────────────────────────────────────────────
  async function route() {
    const h = location.hash;
    try {
      FILES = await OC.files();
      const m = /^#s=([^&]+)(?:&f=(.+))?$/.exec(h);
      if (m) return await pageStation(decodeURIComponent(m[1]), m[2] ? decodeURIComponent(m[2]) : '');
      return await pageMonth();
    } catch (e) { T.innerHTML = '<p class="nt am">Could not read the card: ' + H(e.message || e) + '</p>'; }
  }
  const sc = document.createElement('script'); sc.src = '/file?n=common.js&d=www';
  sc.onload = () => { OC = window.OC; addEventListener('hashchange', () => { scrollTo(0, 0); route(); }); route(); };
  sc.onerror = () => { T.innerHTML = '<p class="nt am">common.js is not on the card. Copy the <b>www</b> folder from the firmware zip to the card, then reload.</p>'; };
  document.head.appendChild(sc);
})();
