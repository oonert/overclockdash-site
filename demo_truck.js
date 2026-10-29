/* The demo truck's life, for every live clock on the site and for the
 * screenshot tool: the odometer, two trips under way, a fuel log with three
 * tanks behind it, records earned, states driven. One place, so the demo page,
 * the 3D viewer and the pictures all show the same truck.
 *
 *   OverclockDemoTruck.settings   saved values the firmware boots with
 *   OverclockDemoTruck.after      values written after the demo's first-boot
 *                                 setup (which sets the odometer itself), then
 *                                 the firmware boots again
 *   OverclockDemoTruck.skipMs     how far to run the demo drive ahead so the
 *                                 truck is rolling when the page opens
 *   OverclockDemoTruck.mount(el, opts)   OverclockClock.mount with all of that
 *                                 applied (the second boot is fast-forwarded)
 */
(function (global) {
  'use strict';
  const MI = 1609.344;
  const f = (x) => ({ f32: x });
  const f32s = (arr) => { const b = new Uint8Array(arr.length * 4), v = new DataView(b.buffer); arr.forEach((x, i) => v.setFloat32(i * 4, x, true)); return Array.from(b); };
  // The dash keeps the windshield odometer (odo_base_m, set once) apart from
  // the metres it has counted itself (odo_total_m); the live reading is the sum.
  const BASE_M = Math.round(186000 * MI), OWN_M = Math.round(1412 * MI), FILL_ODO_M = BASE_M + OWN_M - Math.round(183 * MI);

  // RECORDS: REC_N slots of { float value (metric), u32 unix time, char
  // where[24], char postal[4], u8 set, pad[3] } (records.h). The record
  // screen's font has no lowercase, so places are in capitals.
  const REC_IDS = ['farthest', 'topspeed', 'highest', 'lowest', 'steepest', 'hottest', 'coldest', 'roll', 'pitch', 'brake', 'launch', 'corner', 'rpm', 'coolant', 'lowv', 'highv', 'longdrive', 'bestday', 'roadtrip', 'bestmpg', 'worstmpg'];
  const REC = {
    farthest: [412, 'BEND', 'OR', '2026-07-19T14:20'], topspeed: [128, 'BIGGS JUNCTION', 'OR', '2026-07-18T11:05'],
    highest: [1648, 'SANTIAM PASS', 'OR', '2026-07-18T13:40'], lowest: [3, 'ASTORIA', 'OR', '2026-06-02T10:15'],
    rpm: [4850, 'HOOD RIVER', 'OR', '2026-07-18T12:12'], coolant: [101, 'MARYHILL', 'WA', '2026-07-18T12:30'],
  };
  function recordsBlob() {
    const b = new Uint8Array(REC_IDS.length * 40), v = new DataView(b.buffer);
    REC_IDS.forEach((id, i) => {
      const r = REC[id]; if (!r) return;
      const o = i * 40; v.setFloat32(o, r[0], true); v.setUint32(o + 4, Math.floor(new Date(r[3]).getTime() / 1000), true);
      for (let k = 0; k < Math.min(23, r[1].length); k++) b[o + 8 + k] = r[1].charCodeAt(k);
      for (let k = 0; k < Math.min(3, r[2].length); k++) b[o + 32 + k] = r[2].charCodeAt(k);
      b[o + 36] = 1;
    });
    return Array.from(b);
  }

  const settings = {
    clk_face: 0, clk_24h: 0, clk_page: 2, clk_color: 0x8FE0, clk_slots: [21, 1, 7, 16, 11, 12, 7, 8], scr_Slides: 0,
    trip_a_m: Math.round(48.3 * MI), trip_b_m: Math.round(1284.6 * MI),
    fl_odo: FILL_ODO_M, fl_full: 1, fl_price: 349, fl_lgal: f(17.4), fl_mpgl: f(18.6), fl_msum: f(55.6), fl_mn: f(3), fl_gsum: f(52.1), fl_gn: f(3),
    fl_mpg3: f32s([18.6, 17.9, 19.1]), fl_cal: f(1.02), fl_caln: 3, fl_tank: f(9.8), fl_lnpump: f(17.4), fl_lndash: f(17.1), fl_lnflag: 'OK',
    fl_rec0: '10/22,17.4,18.6,F', fl_rec1: '10/09,16.8,17.9,F', fl_rec2: '09/27,17.9,19.1,F',
    sb_visit: 'USA.WA;USA.OR;USA.ID;USA.MT;USA.CA;USA.NV;USA.UT;', sb_last: 'USA.WA', rec_v1: recordsBlob(),
    z60_best: 9870,
  };
  const after = { odo_base_m: BASE_M, odo_total_m: OWN_M };
  const SPLASH_MS = 14000, skipMs = 110000;

  // Mount, then give the truck its odometer and boot again, fast-forwarding
  // through the second splash and into the drive. Resolves once that is done.
  async function mount(el, opts) {
    opts = Object.assign({}, opts || {});
    opts.settings = Object.assign({}, settings, opts.settings || {});
    const clock = await global.OverclockClock.mount(el, opts);
    const until = (fn) => new Promise((res) => { const t = setInterval(() => { if (fn()) { clearInterval(t); res(); } }, 50); });
    clock.skip(SPLASH_MS);                        // through the first splash
    await until(() => clock.booted() && !clock.skipping());
    for (const k in after) clock.set(k, after[k]);
    clock.restart();
    clock.skip(SPLASH_MS + (opts.skip === undefined ? skipMs : opts.skip));
    await until(() => !clock.skipping());
    return clock;
  }

  global.OverclockDemoTruck = { settings, after, skipMs, mount, MI };
})(typeof window !== 'undefined' ? window : globalThis);
