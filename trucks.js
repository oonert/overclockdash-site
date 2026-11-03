// Low-poly truck builders for the demo's tilt scene. Each returns a THREE.Group
// facing +x, wheels on y = 0, plus roofY (for the camp tent) and wheel info.
(function () {
  const M = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.1 }, o || {}));
  const lamp = (c, e) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: 0.6 });

  // extrude a side profile (x, y points) across the width, centred on z = 0
  function profile(pts, width, mat) {
    const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.lineTo(pts[0][0], pts[0][1]);
    const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false }); g.translate(0, 0, -width / 2);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
  }
  function kit(group) {
    return function part(geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  }
  function wheels(part, xs, r, w, track, rubber, rim) {
    for (const x of xs) for (const z of [track, -track]) {
      part(new THREE.CylinderGeometry(r, r, w, 28), rubber, x, r, z).rotation.x = Math.PI / 2;
      part(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 14), rim, x, r, z).rotation.x = Math.PI / 2;
    }
  }
  // dark half-round fender flare over a wheel
  function flare(part, x, y, r, z, mat) {
    const g = new THREE.CylinderGeometry(r, r, 0.12, 24, 1, false, Math.PI / 2 - 1.25, 2.5);
    const m = part(g, mat, x, y, z); m.rotation.x = Math.PI / 2; return m;
  }

  // ---- 3rd gen 4Runner (1996-2002): long boxy roof, flat hood, square nose
  function fourRunner(opt) {
    opt = Object.assign({ paint: 0xa8322b, lift: 0, tire: 0.5, trail: false }, opt || {});
    const g = new THREE.Group(), part = kit(g), L = opt.lift;
    const paint = M(opt.paint, { roughness: 0.45, metalness: 0.2 });
    const dark = M(0x22262b, { roughness: 0.9 }), trim = M(0x2f3338, { roughness: 0.8 });
    const glass = M(0x1b2630, { roughness: 0.15, metalness: 0.5 });
    const rubber = M(0x15171a, { roughness: 1 }), rim = opt.trail ? M(0x1e1f22, { roughness: 0.6 }) : M(0xa9aeb3, { roughness: 0.35, metalness: 0.7 });
    const W = 1.9, base = 0.62 + L;
    // body below the windows
    const body = profile([[-2.22, base + 0.1], [2.2, base + 0.1], [2.26, base + 0.72], [2.18, base + 0.86], [0.85, base + 0.9], [-2.22, base + 0.9]], W, paint);
    g.add(body);
    // windows (one dark glass block) and the roof
    g.add(profile([[0.85, base + 0.9], [0.3, base + 1.52], [-2.16, base + 1.52], [-2.2, base + 0.9]], W - 0.1, glass));
    g.add(profile([[0.34, base + 1.48], [-2.18, base + 1.48], [-2.18, base + 1.6], [0.26, base + 1.6]], W - 0.04, paint));
    // pillars: windshield edge, B, C and the wide D pillar
    for (const z of [W / 2 - 0.06, -(W / 2 - 0.06)]) {
      const a = profile([[0.85, base + 0.9], [0.3, base + 1.52], [0.2, base + 1.52], [0.72, base + 0.9]], 0.06, paint); a.position.z = z; g.add(a);
    }
    part(new THREE.BoxGeometry(0.14, 0.62, W - 0.06), paint, -0.25, base + 1.21, 0);
    part(new THREE.BoxGeometry(0.12, 0.62, W - 0.06), paint, -1.25, base + 1.21, 0);
    part(new THREE.BoxGeometry(0.22, 0.62, W - 0.06), paint, -2.08, base + 1.21, 0);
    // lower body cladding, bumpers, grille, lights
    part(new THREE.BoxGeometry(4.4, 0.16, W + 0.02), trim, 0, base + 0.18, 0);
    part(new THREE.BoxGeometry(0.2, 0.26, W + 0.04), opt.trail ? dark : trim, 2.3, base + 0.22, 0);
    part(new THREE.BoxGeometry(0.2, 0.24, W + 0.04), trim, -2.3, base + 0.2, 0);
    part(new THREE.BoxGeometry(0.06, 0.24, 0.82), dark, 2.25, base + 0.6, 0);
    for (const z of [0.66, -0.66]) part(new THREE.BoxGeometry(0.06, 0.2, 0.42), lamp(0xfff1b0, 0xffe08a), 2.25, base + 0.6, z);
    for (const z of [0.82, -0.82]) part(new THREE.BoxGeometry(0.06, 0.42, 0.2), lamp(0xff3b2e, 0xc01810), -2.25, base + 0.62, z);
    for (const z of [W / 2 + 0.06, -(W / 2 + 0.06)]) part(new THREE.BoxGeometry(0.14, 0.14, 0.12), dark, 0.62, base + 1.05, z);
    // roof rack
    for (const z of [0.78, -0.78]) part(new THREE.BoxGeometry(2.3, 0.06, 0.08), dark, -0.95, base + 1.66, z);
    for (const x of [-0.3, -1.6]) part(new THREE.BoxGeometry(0.08, 0.05, 1.56), dark, x, base + 1.7, 0);
    const r = opt.tire, xs = [1.32, -1.3];
    for (const x of xs) for (const z of [W / 2, -W / 2]) flare(part, x, r, r + 0.12, z, opt.trail ? dark : trim);
    wheels(part, xs, r, opt.trail ? 0.42 : 0.36, W / 2 - 0.08, rubber, rim);
    if (opt.trail) {
      // trail build: rock sliders, a light bar, a basket on the rack
      for (const z of [W / 2 + 0.04, -(W / 2 + 0.04)]) part(new THREE.BoxGeometry(1.7, 0.1, 0.12), dark, 0, base + 0.08, z);
      part(new THREE.BoxGeometry(0.1, 0.1, 1.4), lamp(0xfff6d8, 0xfff0b0), 0.36, base + 1.74, 0);
      part(new THREE.BoxGeometry(1.4, 0.16, 1.4), dark, -1.0, base + 1.8, 0);
    }
    return { group: g, roofY: base + 1.66 + (opt.trail ? 0.24 : 0.06), roofX: -0.95, tentLen: 1.9, half: W / 2, wheelX: xs[0], track: W / 2 - 0.08, wheelR: r };
  }

  // ---- 1st gen Tacoma (1995-2004): Xtracab and a bed
  function tacoma(opt) {
    opt = Object.assign({ paint: 0xe6e2d6 }, opt || {});
    const g = new THREE.Group(), part = kit(g);
    const paint = M(opt.paint, { roughness: 0.45, metalness: 0.15 });
    const dark = M(0x22262b, { roughness: 0.9 }), trim = M(0x2f3338, { roughness: 0.8 }), chrome = M(0xb9bec4, { roughness: 0.25, metalness: 0.85 });
    const glass = M(0x1b2630, { roughness: 0.15, metalness: 0.5 });
    const rubber = M(0x15171a, { roughness: 1 }), rim = M(0xa9aeb3, { roughness: 0.35, metalness: 0.7 });
    const W = 1.8, base = 0.62;
    // cab body, from the front to the back of the Xtracab
    g.add(profile([[-0.85, base + 0.1], [2.3, base + 0.1], [2.36, base + 0.66], [2.26, base + 0.8], [1.0, base + 0.86], [-0.85, base + 0.86]], W, paint));
    g.add(profile([[1.0, base + 0.86], [0.48, base + 1.46], [-0.82, base + 1.46], [-0.85, base + 0.86]], W - 0.1, glass));
    g.add(profile([[0.52, base + 1.42], [-0.84, base + 1.42], [-0.84, base + 1.52], [0.44, base + 1.52]], W - 0.04, paint));
    for (const z of [W / 2 - 0.06, -(W / 2 - 0.06)]) { const a = profile([[1.0, base + 0.86], [0.48, base + 1.46], [0.38, base + 1.46], [0.87, base + 0.86]], 0.06, paint); a.position.z = z; g.add(a); }
    part(new THREE.BoxGeometry(0.16, 0.6, W - 0.06), paint, -0.3, base + 1.16, 0);       // B pillar
    part(new THREE.BoxGeometry(0.1, 0.6, W - 0.06), paint, -0.8, base + 1.16, 0);        // cab back
    // the bed
    const bx0 = -0.95, bx1 = -2.45, bl = bx0 - bx1, bc = (bx0 + bx1) / 2;
    part(new THREE.BoxGeometry(bl, 0.12, W - 0.1), dark, bc, base + 0.22, 0);              // bed floor
    for (const z of [W / 2 - 0.04, -(W / 2 - 0.04)]) part(new THREE.BoxGeometry(bl, 0.82, 0.08), paint, bc, base + 0.5, z);
    part(new THREE.BoxGeometry(0.08, 0.82, W), paint, bx0, base + 0.5, 0);                 // bed front
    part(new THREE.BoxGeometry(0.08, 0.66, W), paint, bx1, base + 0.43, 0);                // tailgate
    for (const z of [W / 2 - 0.04, -(W / 2 - 0.04)]) part(new THREE.BoxGeometry(bl, 0.04, 0.12), dark, bc, base + 0.93, z);   // bed rail caps
    // trim, bumpers, grille, lights
    part(new THREE.BoxGeometry(0.2, 0.24, W + 0.04), chrome, 2.4, base + 0.2, 0);
    part(new THREE.BoxGeometry(0.22, 0.2, W + 0.02), chrome, -2.55, base + 0.18, 0);
    part(new THREE.BoxGeometry(0.06, 0.26, 0.8), dark, 2.35, base + 0.56, 0);
    for (const z of [0.64, -0.64]) part(new THREE.BoxGeometry(0.06, 0.2, 0.38), lamp(0xfff1b0, 0xffe08a), 2.33, base + 0.58, z);
    for (const z of [0.76, -0.76]) part(new THREE.BoxGeometry(0.06, 0.4, 0.18), lamp(0xff3b2e, 0xc01810), -2.49, base + 0.56, z);
    for (const z of [W / 2 + 0.06, -(W / 2 + 0.06)]) part(new THREE.BoxGeometry(0.14, 0.14, 0.12), dark, 0.78, base + 1.0, z);
    const r = 0.5, xs = [1.45, -1.6];
    for (const x of xs) for (const z of [W / 2, -W / 2]) flare(part, x, r, r + 0.12, z, trim);
    wheels(part, xs, r, 0.36, W / 2 - 0.08, rubber, rim);
    return { group: g, roofY: base + 1.58, roofX: -1.7, tentLen: 1.4, rack: { x0: -0.95, x1: -2.45, y: base + 1.58, w: W }, half: W / 2, wheelX: xs[0], track: W / 2 - 0.08, wheelR: r };
  }

  // ---- rooftop tents, deployed. info comes from a truck builder.
  function tent(kind, info) {
    const g = new THREE.Group(), part = kit(g);
    const shell = M(0x2a2c2f, { roughness: 0.7 }), canvas = M(0x9c8a62, { roughness: 1 }), fly = M(0x4f5a45, { roughness: 1 }), win = M(0x1a1d20, { roughness: 0.9 });
    const alu = M(0x9aa0a6, { roughness: 0.4, metalness: 0.7 });
    const X = info.roofX, Y = info.roofY, L = info.tentLen || 1.8, H = info.half;
    if (info.rack) {   // a bed rack at cab height, so the tent clears the bed
      const r = info.rack, cx = (r.x0 + r.x1) / 2, len = r.x0 - r.x1;
      for (const x of [r.x0 - 0.08, r.x1 + 0.08]) for (const z of [r.w / 2 - 0.06, -(r.w / 2 - 0.06)]) part(new THREE.BoxGeometry(0.07, Y - 1.53, 0.07), shell, x, (Y + 1.53) / 2, z);
      for (const z of [r.w / 2 - 0.06, -(r.w / 2 - 0.06)]) part(new THREE.BoxGeometry(len - 0.1, 0.07, 0.07), shell, cx, Y, z);
      for (const x of [r.x0 - 0.2, cx, r.x1 + 0.2]) part(new THREE.BoxGeometry(0.07, 0.06, r.w - 0.1), shell, x, Y + 0.02, 0);
    }
    function ladder(x, zTop, yTop, zFoot) {
      const len = Math.hypot(yTop, zFoot - zTop), ang = Math.atan2(zFoot - zTop, yTop);
      const lg = new THREE.Group(); lg.position.set(x, yTop, zTop); lg.rotation.x = -ang; g.add(lg);
      for (const dx of [-0.22, 0.22]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, len, 0.05), alu); m.position.set(dx, -len / 2, 0); m.castShadow = true; lg.add(m); }
      for (let k = 1; k < 7; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.04, 0.05), alu); m.position.set(0, -len * k / 7, 0); m.castShadow = true; lg.add(m); }
    }
    if (kind === 'soft') {
      // fold-out soft shell: half on the roof, half over the side on the ladder
      const z0 = -H + 0.15, z1 = H + 1.15, zc = (z0 + z1) / 2, w = z1 - z0, y0 = Y + 0.12;
      part(new THREE.BoxGeometry(L, 0.1, w), shell, X, Y + 0.06, zc);
      const s = new THREE.Shape(); const pts = [[z0, 0], [z1, 0], [z1, 0.72], [zc, 1.05], [z0, 0.72]];
      s.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => s.lineTo(q[0], q[1]));
      const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: L - 0.1, bevelEnabled: false }), canvas);
      body.rotation.y = -Math.PI / 2; body.position.set(X + (L - 0.1) / 2, y0, 0); body.castShadow = true; g.add(body);
      // rain fly over the peak and a window on each end
      const f = new THREE.Shape(); const fp = [[z0 - 0.05, 0.68], [zc, 1.1], [z1 + 0.05, 0.68], [z1 + 0.05, 0.62], [zc, 1.02], [z0 - 0.05, 0.62]];
      f.moveTo(fp[0][0], fp[0][1]); fp.slice(1).forEach(q => f.lineTo(q[0], q[1]));
      const fm = new THREE.Mesh(new THREE.ExtrudeGeometry(f, { depth: L + 0.1, bevelEnabled: false }), fly);
      fm.rotation.y = -Math.PI / 2; fm.position.set(X + (L + 0.1) / 2, y0, 0); fm.castShadow = true; g.add(fm);
      for (const x of [X + L / 2 - 0.04, X - L / 2 + 0.04]) part(new THREE.BoxGeometry(0.02, 0.36, 0.7), win, x, y0 + 0.42, zc);
      part(new THREE.BoxGeometry(L * 0.5, 0.34, 0.02), win, X, y0 + 0.4, z1 + 0.01);
      ladder(X, z1 - 0.05, Y, z1 + 0.55);
    } else if (kind === 'clam') {
      // hard-shell clamshell: the lid hinges at the front and opens to the back
      const w = 2 * H - 0.2, y0 = Y + 0.04;
      part(new THREE.BoxGeometry(L, 0.16, w), shell, X, y0 + 0.08, 0);
      const ang = 0.5, hx = X + L / 2;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(L, 0.1, w), shell); lid.castShadow = true;
      const lg = new THREE.Group(); lg.position.set(hx, y0 + 0.16, 0); lg.rotation.z = -ang; g.add(lg); lid.position.set(-L / 2, 0.05, 0); lg.add(lid);
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(-L, 0); s.lineTo(-L * Math.cos(ang), L * Math.sin(ang)); s.lineTo(0, 0);
      const side = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: w - 0.06, bevelEnabled: false }), canvas);
      side.position.set(hx, y0 + 0.16, -(w - 0.06) / 2); side.castShadow = true; g.add(side);
      part(new THREE.BoxGeometry(0.02, L * Math.sin(ang) * 0.55, w * 0.5), win, X - L / 2 + 0.02, y0 + 0.16 + L * Math.sin(ang) * 0.35, 0);
      ladder(X - L / 2 - 0.05, H - 0.1, Y, H + 0.55);
    } else {
      // pop-up hard shell: the lid lifts straight up on canvas walls
      const w = 2 * H - 0.2, y0 = Y + 0.04, lift = 0.95;
      part(new THREE.BoxGeometry(L, 0.16, w), shell, X, y0 + 0.08, 0);
      part(new THREE.BoxGeometry(L - 0.06, lift, w - 0.06), canvas, X, y0 + 0.16 + lift / 2, 0);
      part(new THREE.BoxGeometry(L + 0.04, 0.12, w + 0.04), shell, X, y0 + 0.16 + lift + 0.06, 0);
      for (const z of [w / 2 - 0.02, -(w / 2 - 0.02)]) part(new THREE.BoxGeometry(L * 0.55, 0.36, 0.02), win, X, y0 + 0.16 + lift * 0.55, z);
      part(new THREE.BoxGeometry(0.02, 0.36, w * 0.5), win, X - L / 2 + 0.02, y0 + 0.16 + lift * 0.55, 0);
      ladder(X - L / 2 - 0.05, H - 0.1, Y, H + 0.55);
    }
    return g;
  }

  window.TRUCKS = { fourRunner, tacoma, tent };
})();
