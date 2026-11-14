// shim.js: the clock's phone pages, running with no clock (the website demo).
//
// The pages are the real ones, as the clock serves them (wifi_page.h and the
// card's www folder). They ask the clock for things by absolute paths: /hello,
// /manifest, /file?n=trips-2026-10.csv, /zip?f=..., and they link to each other
// as /tk, /tr, /ec. On the website there is no clock at those paths, so this
// script, loaded first on every page, answers them from the files beside it:
//   fetch()                  -> the made-up card (card/), www/, canned answers
//   script.src = '/file?..'  -> www/<name>
//   a click on <a href=/tr>  -> tr.html (a path not in the demo: a short note)
//   saves (/upmk, /upec)     -> kept for this visit only (sessionStorage)
// Nothing leaves the visitor's browser and nothing reaches a clock.
// OCD_TABLE below is written by tools/web/make_phone_demo.py.
(function () {
  'use strict';
  var T = {"docs":{"/tk":"tk.html","/tr":"tr.html","/ec":"ec.html","/dc":"dc.html","/up":"up.html"},"assets":{"/dtr":"r/dtr.js","/n":"r/n.js","/uh":"r/uh.js","/c8":"r/c8.css","/h":"r/h.js","/c13":"r/c13.css","/c12":"r/c12.css","/c4":"r/c4.css","/c3":"r/c3.css","/c2":"r/c2.css","/c":"r/c.css","/m":"r/m.json","/dk":"r/dk.js","/dj":"r/dj.js","/lk":"r/lk.js","/c6":"r/c6.css"},"www":["common.js","econ.js","trips.js","truck.js","basemap.bin","basemap_lo.bin"],"sizes":{"battlog.csv":20526,"econ-2026-08.csv":11893,"econ-2026-09.csv":11868,"econ-2026-10.csv":15397,"econ-2026-11.csv":4652,"eng-2026-08.csv":37512,"eng-2026-09.csv":37051,"eng-2026-10.csv":47677,"eng-2026-11.csv":14446,"fuellog.csv":1972,"fuelspots_learned.csv":150,"health-2026-08.csv":16149,"health-2026-09.csv":16153,"health-2026-10.csv":20876,"health-2026-11.csv":6234,"parked.csv":374560,"roadtrip-days.csv":232,"roadtrips.csv":483,"track-2026-08.csv":373872,"track-2026-09.csv":311321,"track-2026-10.csv":456432,"track-2026-11.csv":118341,"trips-2026-08.csv":98745,"trips-2026-09.csv":84465,"trips-2026-10.csv":121360,"trips-2026-11.csv":31727},"api":{"/dtc":{"c":[["P0171","SYSTEM TOO LEAN (BANK 1)","The engine is getting more air than fuel. Often a vacuum leak or a dirty air meter.",0]],"pn":[],"ever":1,"busy":0,"fz":3,"ff":1,"fc":"P0171","fr":[["COOLANT",91],["RPM",2140],["SPEED",87],["LOAD",38],["STFT1",4.7],["LTFT1",12.5]]},"/pids":{"on":1,"q":99,"tot":4812,"nd":21,"eng":"5VZ-FE","pr":"ISO 9141-2","p":[["RPM",1895,2],["SPEED",96.7,2],["COOLANT",89,2],["LOAD",41.2,2],["IAT",24,2],["THROTTLE",23.5,2],["MAF",14.8,2],["LTFT",3.9,2],["STFT",2.3,2],["TIMING",18.5,2],["RUNTIME",1412,2],["O2B1S1",0.74,2],["O2B1S2",0.61,2],["DISTMIL",0,2],["DISTCLR",502,2],["WARMUPS",18,2],["MILTIME",95,2],["CLRTIME",1260,2]]},"/wh":{"m":0,"h":"","ip":"10.10.10.10","r":-50,"max":5,"n":[{"s":"Home wifi"},{"s":"Truck router"}]},"/vic":{"d":[{"m":"C0FFEE123456","p":0,"k":"1a2b"},{"m":"D4E5F6A7B8C9","p":0,"k":"9f3c"},{"m":"","p":0}],"lb":[{"s":"OK","a":4,"n":"87%","b":6},{"s":"OK","a":6,"n":"86%","b":6}],"cb":1,"sr":0},"/dts":{"h":1,"b":1,"max":20,"clk":1,"n":[{"n":"ALEX","k":0,"m":11,"d":17,"y":1995,"o":1,"i":0,"a":31,"t":4},{"n":"US","k":1,"m":1,"d":9,"y":2009,"o":1,"i":1,"a":18,"t":57},{"n":"SAM","k":0,"m":2,"d":3,"y":0,"o":1,"i":2,"a":-1,"t":82}],"x":{"n":"ALEX","k":0,"m":11,"d":17,"a":31,"t":4,"w":2}},"/status":{"gps fix":"3D, 9 sats","obd":"up","clock":"19:05:12","cabin":"68F","outside":"54F","tilt":2,"hdg":312,"alt":312,"up_s":5212,"heap free":98000,"heap block":61000,"card":"29.8 GB free","clients":1,"served":48},"/hello":{"fw":"0.99.156a","v":"0.99.156a","veh":"1997 4RUNNER SR5","hw":2,"sd":1,"name":"OVERCLOCK","map_kb":298,"fs_s":1284,"fs_l":37}}};
  var cs = document.currentScript;
  var BASE = cs ? cs.src.replace(/[^\/]*$/, '') : '';
  var page = location.pathname.replace(/^.*\//, '') || 'index.html';
  var vpath = '/';
  Object.keys(T.docs).forEach(function (k) { if (T.docs[k] === page) vpath = k; });
  var realFetch = window.fetch.bind(window);
  var whole = {};                                   // real file -> its bytes, fetched once
  function bytesOf(rel) {
    return whole[rel] || (whole[rel] = realFetch(BASE + rel).then(function (r) { if (!r.ok) throw new Error(rel); return r.arrayBuffer(); }));
  }
  function mem(k, v) {                              // this visit's saves
    try { if (v === undefined) return sessionStorage.getItem('ocd_' + k); sessionStorage.setItem('ocd_' + k, v); } catch (e) { mem._[k] = v === undefined ? mem._[k] : v; return mem._[k] == null ? null : mem._[k]; }
  }
  mem._ = {};
  function answer(body, type, status) {
    var n = typeof body === 'string' ? new Blob([body]).size : body.byteLength;
    return new Response(body, { status: status || 200, headers: { 'Content-Type': type, 'Content-Length': String(n) } });
  }
  var json = function (o) { return answer(JSON.stringify(o), 'application/json'); };
  var none = function () { return answer('', 'text/plain', 404); };
  function typeOf(n) { return /\.js$/.test(n) ? 'application/javascript' : /\.bin$/.test(n) ? 'application/octet-stream' : /\.json$/.test(n) ? 'application/json' : 'text/csv'; }
  function cardFile(n, d) {                         // the real file behind /file?n=&d=, or '' when the card has none
    n = String(n || '').replace(/^.*[\/\\]/, '');
    if (d === 'www') return T.www.indexOf(n) >= 0 ? 'www/' + n : '';
    if (d) return '';
    return T.sizes[n] != null ? 'card/' + n : '';
  }
  // a ZIP with nothing compressed, as the clock's own /zip sends
  var CRC = null;
  function crc32(u8) {
    if (!CRC) { CRC = []; for (var i = 0; i < 256; i++) { var c = i; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[i] = c >>> 0; } }
    var x = 0xFFFFFFFF; for (var j = 0; j < u8.length; j++) x = CRC[(x ^ u8[j]) & 255] ^ (x >>> 8);
    return (x ^ 0xFFFFFFFF) >>> 0;
  }
  function zipOf(list) {                            // [{name, data: Uint8Array}]
    var enc = new TextEncoder(), parts = [], cen = [], off = 0;
    list.forEach(function (f) {
      var nm = enc.encode(f.name), crc = crc32(f.data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true); h.setUint16(26, nm.length, true);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      parts.push(new Uint8Array(h.buffer), nm, f.data); cen.push(new Uint8Array(c.buffer), nm); off += 30 + nm.length + f.data.length;
    });
    var cl = 0; cen.forEach(function (b) { cl += b.length; });
    var e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, list.length, true); e.setUint16(10, list.length, true); e.setUint32(12, cl, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cen, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
  }
  function route(p, q, method, init) {
    if (p === '/file') {
      var n = q.get('n'), d = q.get('d') || '';
      if (d === 'app') { var s = mem('app_' + n); return s == null ? none() : answer(s, typeOf(n)); }
      var rel = cardFile(n, d); if (!rel) return none();
      var off = +q.get('off') || 0, len = +q.get('len') || 0;
      return bytesOf(rel).then(function (b) { return answer(len ? b.slice(off, off + Math.min(len, 16384)) : off ? b.slice(off) : b, typeOf(n)); });
    }
    if (p === '/manifest') return json({ files: Object.keys(T.sizes).map(function (k) { return { name: k, size: T.sizes[k] }; }), next: 0 });
    if (p === '/zip') {
      var names = (q.get('f') || '').split(',').filter(Boolean);
      if (!names.length || names.some(function (x) { return !cardFile(x, ''); })) return none();
      return Promise.all(names.map(function (x) { return bytesOf(cardFile(x, '')).then(function (b) { return { name: x, data: new Uint8Array(b) }; }); }))
        .then(function (fs) { var z = zipOf(fs); return new Response(z, { status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Length': String(z.size) } }); });
    }
    if (method === 'POST') {
      var body = init && init.body != null ? new Response(init.body).text() : Promise.resolve('');
      if (p === '/upmk') return body.then(function (t) { var old = mem('app_marks.csv'); if (old != null) mem('app_marks.bak', old); mem('app_marks.csv', t); return json({ ok: 1 }); });
      if (p === '/upec') return body.then(function (t) { mem('app_econ.json', t); return json({ ok: 1 }); });
      if (p === '/fsn') return json({ ok: 1 });
      return json({});
    }
    if (T.api[p]) return json(T.api[p]);
    return none();
  }
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : (input && input.url) || String(input), x;
    try { x = new URL(u, 'http://oc.invalid' + vpath); } catch (e) { return realFetch(input, init); }
    if (x.host !== 'oc.invalid') return realFetch(input, init);
    var m = ((init && init.method) || 'GET').toUpperCase();
    try { return Promise.resolve(route(x.pathname, x.searchParams, m, init)); } catch (e) { return Promise.reject(e); }
  };
  // where a clock path really lives in this folder ('' = not in the demo)
  function real(v) {
    var i = v.indexOf('#'), hash = i < 0 ? '' : v.slice(i), path = i < 0 ? v : v.slice(0, i), qi = path.indexOf('?'), qs = qi < 0 ? '' : path.slice(qi + 1); path = qi < 0 ? path : path.slice(0, qi);
    if (T.docs[path]) return BASE + T.docs[path] + hash;
    if (T.assets[path]) return BASE + T.assets[path];
    if (path === '/file') { var q = new URLSearchParams(qs), rel = cardFile(q.get('n'), q.get('d') || ''); return rel ? BASE + rel : ''; }
    return '';
  }
  // <script>.src = '/file?n=common.js&d=www' and the like
  var sd = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
  Object.defineProperty(HTMLScriptElement.prototype, 'src', {
    configurable: true, enumerable: true, get: sd.get,
    set: function (v) { v = String(v); sd.set.call(this, v.charAt(0) === '/' && v.charAt(1) !== '/' ? (real(v) || v) : v); }
  });
  function note(text) {
    var d = document.getElementById('ocdNote');
    if (!d) { d = document.createElement('div'); d.id = 'ocdNote'; d.style.cssText = 'position:fixed;left:16px;right:16px;bottom:92px;z-index:99999;background:#1c1c1e;color:#fff;border:1px solid #f6a800;border-radius:14px;padding:12px 14px;font:500 14px system-ui,sans-serif;text-align:center;transition:opacity .3s;max-width:520px;margin:0 auto'; document.body.appendChild(d); }
    d.textContent = text; d.style.opacity = '1'; clearTimeout(note.t); note.t = setTimeout(function () { d.style.opacity = '0'; }, 2600);
  }
  // links between the pages
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null; if (!a) return;
    var h = a.getAttribute('href'); if (!h || h.charAt(0) !== '/' || h.charAt(1) === '/') return;
    e.preventDefault(); e.stopPropagation();
    var r = real(h);
    if (!r) { note('That page is not part of this demo. On a real clock it opens here.'); return; }
    if (/^\/file\?/.test(h)) { var dl = document.createElement('a'); dl.href = r; dl.download = r.replace(/^.*\//, ''); document.body.appendChild(dl); dl.click(); dl.remove(); return; }
    location.href = r;
  }, true);
  // OCD.path stands in for location.pathname in the pages' own scripts (the
  // tab bar lights the tab whose path this is); OCD.go for "location.href = '/ec#..'".
  window.OCD = { path: vpath, base: BASE, real: real, go: function (v) { var r = real(v); if (r) location.href = r; else note('That page is not part of this demo.'); }, note: note };
  // tell the page that frames this one (the website) which tab is showing
  try { if (parent !== window) parent.postMessage({ ocd: 'page', path: vpath, hash: location.hash }, '*'); } catch (e) {}
})();
