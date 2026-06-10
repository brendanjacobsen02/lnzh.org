/*
 * nebula-glint.js — ambient "lingering supernova" for the special nebula mode.
 *
 * A whisper-quiet pixel starfield drawn behind everything: sparse warm/icy
 * flecks that mostly sit near-invisible and occasionally GLINT (a brief sharp
 * flare, then fade), plus a few barely-there gas motes drifting for depth — as
 * if the supernova burst settled and a little of it stayed.
 *
 * On-brand, not generic: pixel squares (image-rendering: pixelated) echoing the
 * 8-bit theme-toggle/supernova, NOT soft glowy particle-js dots. Deliberately
 * non-intrusive — low alpha, slow, sparse.
 *
 * It ALSO paints a glittery pixel trail that follows the cursor — little star
 * flecks that scatter off the pointer, settle, and twinkle out (a separate,
 * FOREGROUND canvas, since the ambient layer sits behind content). Mouse/pen
 * only, cosmic-mode only.
 *
 * Gated on the special mode: runs only while <html data-palette="cosmic">.
 * A MutationObserver starts/stops it as the palette flips. The ambient canvas
 * sits at z-index:-1 (above the page background, below content); the cursor
 * trail rides a separate canvas above content. Both are pointer-events:none.
 * Reduced-motion → a single static sprinkle, no animation, no cursor trail.
 */
(function () {
  'use strict';
  if (window.__nebulaGlint) return;            // single init per document
  window.__nebulaGlint = true;

  var FLECKS = ['#fff4d6', '#ffd9a0', '#ffe9b3', '#cfe8ff', '#cfe8ff'];  // warm + a little ice
  var GAS    = ['#5a1aa0', '#2a3fb0', '#0e6d8c'];                        // deep nebula motes
  var FLARE_GAS = ['#5a1a7a', '#7a1d6b', '#43135e', '#123a63', '#0e4d5c', '#1d6d7a']; // supernova gas
  // cursor-trail glitter: mostly warm/icy starlight, a little cosmic violet
  var SPARKS = ['#fff4d6', '#ffe9b3', '#cfe8ff', '#fff4d6', '#cfe8ff', '#c8b8ff', '#a48cf0'];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas, ctx, W, H, dpr, flecks, motes, flares, nextFlare, raf = 0, running = false, t0 = 0;
  // cursor trail: its own foreground canvas + a pool of glitter sparks
  var cur, cctx, sparks = [], lastPX = null, lastPY = null, prevT = 0, pointerBound = false;

  function isActive() {
    return document.documentElement.getAttribute('data-palette') === 'cosmic';
  }

  function build() {
    var area = W * H;
    var n = Math.round(area / 11000);                 // a touch denser: ~115 on a 1440×900
    n = Math.max(32, Math.min(200, n));
    flecks = [];
    for (var i = 0; i < n; i++) {
      flecks.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 1 + Math.floor(Math.random() * 3),         // 1–3 px pixel squares
        c: FLECKS[(Math.random() * FLECKS.length) | 0],
        base: 0.05 + Math.random() * 0.14,            // resting brightness (dim)
        tw: 0.4 + Math.random() * 0.9,                // twinkle speed
        ph: Math.random() * 6.2832,                   // twinkle phase
        vx: (Math.random() - 0.5) * 0.03,             // very slow drift
        vy: (Math.random() - 0.5) * 0.03,
        glint: 0                                       // active glint envelope 0..1
      });
    }
    motes = [];
    var m = Math.max(2, Math.round(area / 520000));    // 2–4 faint gas motes
    for (var k = 0; k < m; k++) {
      motes.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 70 + Math.random() * 120,
        c: GAS[(Math.random() * GAS.length) | 0],
        a: 0.03 + Math.random() * 0.035,              // barely there
        tw: 0.12 + Math.random() * 0.18, ph: Math.random() * 6.2832,
        vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05
      });
    }
    flares = [];
    nextFlare = 700 + Math.random() * 1400;            // first flare soon after start
  }

  // A small supernova-flavoured flare: a ragged patch of pixel nebula gas + a few
  // bright flecks that ignites and dissolves at (cx,cy). Born at time `t`.
  function spawnFlare(t) {
    var cx = Math.random() * W, cy = Math.random() * H;
    var R = 60 + Math.random() * 120;
    var CELL = 12 + (Math.random() * 8 | 0);
    var cells = [];
    for (var y = cy - R; y < cy + R; y += CELL) {
      for (var x = cx - R; x < cx + R; x += CELL) {
        var d = Math.hypot(x - cx, y - cy) / R;
        if (d > 1) continue;
        if (Math.random() > (1 - d * d) * 0.9 + 0.1) continue;    // dense core, ragged edge
        cells.push({ x: x | 0, y: y | 0, s: CELL + 1, ring: d,
                     c: FLARE_GAS[(Math.random() * FLARE_GAS.length) | 0] });
      }
    }
    var flk = [], nf = 4 + (Math.random() * 4 | 0);               // a few glowing flecks
    for (var i = 0; i < nf; i++) {
      flk.push({ x: (cx + (Math.random() - 0.5) * R * 1.4) | 0,
                 y: (cy + (Math.random() - 0.5) * R * 1.4) | 0,
                 s: 2 + (Math.random() * 2 | 0), ph: Math.random() * 6.2832,
                 c: FLECKS[(Math.random() * FLECKS.length) | 0] });
    }
    // Break the perfect circle: the glow is several offset "lobes" of varying size,
    // each breathing + drifting on its own, so the bloom is lumpy and a bit erratic.
    var lobes = [{ ox: (Math.random() - 0.5) * R * 0.3, oy: (Math.random() - 0.5) * R * 0.3,
                   r: R * (0.4 + Math.random() * 0.2), c: '#fff4d6', w: 0.9,
                   ph: Math.random() * 6.2832, sp: 0.8 + Math.random() * 0.6,
                   dx: (Math.random() - 0.5), dy: (Math.random() - 0.5) }];   // warm core
    var nl = 3 + (Math.random() * 4 | 0);
    for (var lj = 0; lj < nl; lj++) {
      var ang = Math.random() * 6.2832, dist = R * (0.25 + Math.random() * 0.6);
      lobes.push({ ox: Math.cos(ang) * dist, oy: Math.sin(ang) * dist,
                   r: R * (0.4 + Math.random() * 0.65),
                   c: FLARE_GAS[(Math.random() * FLARE_GAS.length) | 0],
                   w: 0.4 + Math.random() * 0.7, ph: Math.random() * 6.2832,
                   sp: 0.7 + Math.random() * 1.0, dx: (Math.random() - 0.5), dy: (Math.random() - 0.5) });
    }
    flares.push({ cx: cx, cy: cy, R: R, cells: cells, flecks: flk, lobes: lobes, born: t,
                  life: 1100 + Math.random() * 800,            // slower, breathing: ~1.1-1.9s
                  pulses: 2 + (Math.random() * 2 | 0),         // 2-3 gentle throbs
                  flash: FLARE_GAS[(Math.random() * FLARE_GAS.length) | 0] });
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (cur) {
      cur.width = W * dpr; cur.height = H * dpr;
      cur.style.width = W + 'px'; cur.style.height = H + 'px';
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    build();
  }

  /* ---- cursor glitter trail (foreground canvas) ---- */
  function spawnSparks(x, y, n, dx, dy) {
    for (var i = 0; i < n; i++) {
      if (sparks.length > 150) { sparks.shift(); }   // hard cap
      var ang = Math.random() * 6.2832, spd = 0.25 + Math.random() * 1.0;
      sparks.push({
        x: x + (Math.random() - 0.5) * 7,
        y: y + (Math.random() - 0.5) * 7,
        vx: Math.cos(ang) * spd - dx * 0.018,        // scatter, biased to trail behind motion
        vy: Math.sin(ang) * spd - dy * 0.018 - 0.15, // a touch of initial lift, then it settles
        s: 1 + (Math.random() * 3 | 0),              // 1–3 px pixel flecks
        c: SPARKS[(Math.random() * SPARKS.length) | 0],
        age: 0, dur: 480 + Math.random() * 620,      // ~0.5–1.1 s
        ph: Math.random() * 6.2832,
        cross: Math.random() < 0.3                   // a third get a twinkle cross
      });
    }
  }
  function onPointerMove(e) {
    if (e.pointerType === 'touch') { return; }       // it's a *cursor* trail
    var x = e.clientX, y = e.clientY;
    if (lastPX === null) { lastPX = x; lastPY = y; return; }
    var dx = x - lastPX, dy = y - lastPY, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) { return; }                         // need real movement to glitter
    spawnSparks(x, y, Math.min(4, 1 + (dist / 16 | 0)), dx, dy);
    lastPX = x; lastPY = y;
  }
  function bindPointer() {
    if (pointerBound) { return; }
    pointerBound = true; lastPX = lastPY = null;
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  }
  function unbindPointer() {
    if (!pointerBound) { return; }
    pointerBound = false;
    window.removeEventListener('pointermove', onPointerMove);
  }
  function drawSparks(t, dt) {
    cctx.clearRect(0, 0, W, H);
    if (!sparks.length) { return; }
    var k = dt / 16.67;                               // frame-rate-independent step
    cctx.globalCompositeOperation = 'lighter';        // additive → glows on the dark void
    for (var i = sparks.length - 1; i >= 0; i--) {
      var p = sparks[i];
      p.age += dt;
      if (p.age >= p.dur) { sparks.splice(i, 1); continue; }
      p.vy += 0.014 * k;                              // gentle settle
      p.vx *= Math.pow(0.95, k); p.vy *= Math.pow(0.985, k);
      p.x += p.vx * k; p.y += p.vy * k;
      var life = 1 - p.age / p.dur;                   // 1 → 0
      var tw = 0.65 + 0.35 * Math.sin(t * 0.02 + p.ph);
      var a = life * life * tw;                       // ease-out fade, twinkling
      if (a < 0.02) { continue; }
      cctx.globalAlpha = a > 1 ? 1 : a;
      cctx.fillStyle = p.c;
      var px = p.x | 0, py = p.y | 0;
      cctx.fillRect(px, py, p.s, p.s);
      if (p.cross && life > 0.4) {                    // a tiny + sparkle while it's bright
        cctx.globalAlpha = (a * 0.55);
        cctx.fillRect(px - p.s, py, p.s * 3, 1);
        cctx.fillRect(px, py - p.s, 1, p.s * 3);
      }
    }
    cctx.globalCompositeOperation = 'source-over';
    cctx.globalAlpha = 1;
  }

  function drawFrame(t) {
    ctx.clearRect(0, 0, W, H);

    // faint drifting gas — screen-blended so motes glow like the supernova gas
    ctx.globalCompositeOperation = 'screen';
    for (var j = 0; j < motes.length; j++) {
      var mo = motes[j];
      mo.x += mo.vx; mo.y += mo.vy;
      if (mo.x < -mo.r) mo.x = W + mo.r; else if (mo.x > W + mo.r) mo.x = -mo.r;
      if (mo.y < -mo.r) mo.y = H + mo.r; else if (mo.y > H + mo.r) mo.y = -mo.r;
      var pulse = mo.a * (0.7 + 0.3 * Math.sin(t * 0.001 * mo.tw + mo.ph));
      var g = ctx.createRadialGradient(mo.x, mo.y, 0, mo.x, mo.y, mo.r);
      g.addColorStop(0, mo.c); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = pulse; ctx.fillStyle = g;
      ctx.fillRect(mo.x - mo.r, mo.y - mo.r, mo.r * 2, mo.r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';

    // occasional supernova FLARES — a patch igniting + dissolving, here and there
    if (t > nextFlare && flares.length < 2) {
      spawnFlare(t);
      nextFlare = t + 3200 + Math.random() * 3200;          // slower gap between flares: every ~3.2-6.4s
    }
    for (var q = flares.length - 1; q >= 0; q--) {
      var fl = flares[q];
      var e = (t - fl.born) / fl.life;
      if (e >= 1) { flares.splice(q, 1); continue; }
      // Smooth THROB: a gentle breathing swell that never snaps to black — riding a
      // soft appear→disappear envelope. (No hard strobe; it pulses, it doesn't flash.)
      var env = Math.sin(e * Math.PI);
      var throb = 0.5 - 0.5 * Math.cos(e * 6.2832 * fl.pulses);   // 0..1, `pulses` swells
      var amp = env * (0.5 + 0.5 * throb);                        // breathes 0.5→1, never dark
      if (amp < 0.01) continue;

      // GLOW — a lumpy bloom of several offset lobes (breaks the perfect circle),
      // each breathing + drifting on its own for an erratic, organic glow.
      ctx.globalCompositeOperation = 'screen';
      for (var lk = 0; lk < fl.lobes.length; lk++) {
        var lo = fl.lobes[lk];
        var lw = 0.6 + 0.4 * Math.sin(e * 6.2832 * fl.pulses * lo.sp + lo.ph);  // own wave
        var la = amp * lo.w * 0.42 * lw;
        if (la < 0.006) continue;
        var lx = fl.cx + lo.ox + lo.dx * e * 16;          // slight drift over the flare's life
        var ly = fl.cy + lo.oy + lo.dy * e * 16;
        var lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lo.r);
        lg.addColorStop(0, lo.c); lg.addColorStop(1, 'transparent');
        ctx.globalAlpha = la > 1 ? 1 : la; ctx.fillStyle = lg;
        ctx.fillRect(lx - lo.r, ly - lo.r, lo.r * 2, lo.r * 2);
      }

      // subtle pixel-gas texture INSIDE the glow — low alpha, soft, keeps the 8-bit feel
      for (var ci = 0; ci < fl.cells.length; ci++) {
        var cc = fl.cells[ci];
        ctx.globalAlpha = amp * (0.07 + (1 - cc.ring) * 0.2);
        ctx.fillStyle = cc.c;
        ctx.fillRect(cc.x, cc.y, cc.s, cc.s);
      }

      // glowing flecks — a soft halo + a bright core (no hard cross)
      ctx.globalCompositeOperation = 'lighter';
      for (var fj = 0; fj < fl.flecks.length; fj++) {
        var ff = fl.flecks[fj];
        var hg = ctx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, 8);
        hg.addColorStop(0, ff.c); hg.addColorStop(1, 'transparent');
        ctx.globalAlpha = amp * 0.7; ctx.fillStyle = hg;
        ctx.fillRect(ff.x - 8, ff.y - 8, 16, 16);
        ctx.globalAlpha = amp; ctx.fillStyle = ff.c;
        ctx.fillRect(ff.x, ff.y, ff.s, ff.s);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // pixel star-flecks: gentle twinkle, rare sharp glint
    for (var i = 0; i < flecks.length; i++) {
      var f = flecks[i];
      f.x += f.vx; f.y += f.vy;
      if (f.x < 0) f.x += W; else if (f.x > W) f.x -= W;
      if (f.y < 0) f.y += H; else if (f.y > H) f.y -= H;
      var a = f.base + 0.06 * Math.sin(t * 0.001 * f.tw + f.ph);
      if (f.glint <= 0 && Math.random() < 0.0013) f.glint = 1;   // ignite a glint
      if (f.glint > 0) {
        a += f.glint * 0.6;                                       // flare up to ~0.7
        f.glint -= 0.018;                                         // ~1s decay
      }
      if (a <= 0.01) continue;
      ctx.globalAlpha = a > 0.85 ? 0.85 : a;
      ctx.fillStyle = f.c;
      ctx.fillRect(f.x | 0, f.y | 0, f.s, f.s);
      if (f.glint > 0.45) {                                       // tiny cross at peak glint
        ctx.globalAlpha = (f.glint - 0.45) * 0.5;
        ctx.fillRect((f.x | 0) - f.s, f.y | 0, f.s * 3, 1);
        ctx.fillRect(f.x | 0, (f.y | 0) - f.s, 1, f.s * 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    if (!running) return;
    if (!t0) t0 = now;
    var t = now - t0;
    var dt = t - prevT; if (dt <= 0 || dt > 50) { dt = 16; }    // clamp tab-switch jumps
    prevT = t;
    drawFrame(t);          // ambient glint (behind content)
    drawSparks(t, dt);     // cursor glitter (above content)
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'nebula-glint-layer';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;'
        + 'image-rendering:pixelated;';
      ctx = canvas.getContext('2d');
      document.body.appendChild(canvas);
      // cursor-trail layer: same full-viewport canvas, but ABOVE content
      cur = document.createElement('canvas');
      cur.className = 'nebula-cursor-layer';
      cur.setAttribute('aria-hidden', 'true');
      cur.style.cssText = 'position:fixed;inset:0;z-index:2147483640;pointer-events:none;'
        + 'image-rendering:pixelated;';
      cctx = cur.getContext('2d');
      document.body.appendChild(cur);
      window.addEventListener('resize', size, { passive: true });
    }
    canvas.style.display = 'block';
    size();
    if (reduce) { drawFrame(0); return; }     // static sprinkle, no animation, no trail
    cur.style.display = 'block';
    bindPointer();
    running = true; t0 = 0; prevT = 0; raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    unbindPointer();
    sparks.length = 0;
    if (canvas) { ctx.clearRect(0, 0, W, H); canvas.style.display = 'none'; }
    if (cur) { cctx.clearRect(0, 0, W, H); cur.style.display = 'none'; }
  }

  function sync() { if (isActive()) start(); else stop(); }

  function init() {
    new MutationObserver(sync).observe(document.documentElement,
      { attributes: true, attributeFilter: ['data-palette'] });
    sync();
  }
  if (document.body) init();
  else document.addEventListener('DOMContentLoaded', init);
})();
