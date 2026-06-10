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
 * Gated on the special mode: runs only while <html data-palette="cosmic">.
 * A MutationObserver starts/stops it as the palette flips. Canvas sits at
 * z-index:-1 (above the page background, below content), like critter-layer--back.
 * Reduced-motion → a single static sprinkle, no animation.
 */
(function () {
  'use strict';
  if (window.__nebulaGlint) return;            // single init per document
  window.__nebulaGlint = true;

  var FLECKS = ['#fff4d6', '#ffd9a0', '#ffe9b3', '#cfe8ff', '#cfe8ff'];  // warm + a little ice
  var GAS    = ['#5a1aa0', '#2a3fb0', '#0e6d8c'];                        // deep nebula motes
  var FLARE_GAS = ['#5a1a7a', '#7a1d6b', '#43135e', '#123a63', '#0e4d5c', '#1d6d7a']; // supernova gas
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var canvas, ctx, W, H, dpr, flecks, motes, flares, nextFlare, raf = 0, running = false, t0 = 0;

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
    var flk = [], nf = 6 + (Math.random() * 6 | 0);               // more, brighter flecks
    for (var i = 0; i < nf; i++) {
      flk.push({ x: (cx + (Math.random() - 0.5) * R * 1.5) | 0,
                 y: (cy + (Math.random() - 0.5) * R * 1.5) | 0,
                 s: 2 + (Math.random() * 2 | 0), ph: Math.random() * 6.2832,
                 c: FLECKS[(Math.random() * FLECKS.length) | 0] });
    }
    flares.push({ cx: cx, cy: cy, R: R, cells: cells, flecks: flk, born: t,
                  life: 700 + Math.random() * 400,             // fast: ~0.7-1.1s
                  pulses: 4 + (Math.random() * 3 | 0),         // fast strobe: 4-6 beats
                  flash: FLARE_GAS[(Math.random() * FLARE_GAS.length) | 0] });
  }

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
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
    if (t > nextFlare && flares.length < 3) {
      spawnFlare(t);
      nextFlare = t + 1000 + Math.random() * 2000;          // more often: every ~1-3s
    }
    for (var q = flares.length - 1; q >= 0; q--) {
      var fl = flares[q];
      var e = (t - fl.born) / fl.life;
      if (e >= 1) { flares.splice(q, 1); continue; }
      // Sharp fast STROBE: pow() narrows each beat to a bright spike with a near-dark
      // trough between, riding a smooth appear→disappear envelope.
      var env = Math.sin(e * Math.PI);
      var pulse = Math.pow(Math.abs(Math.sin(e * Math.PI * fl.pulses)), 3);
      var amp = env * pulse;
      if (amp < 0.012) continue;                              // dark between beats

      // bright bloom — pops on every beat
      ctx.globalCompositeOperation = 'lighter';
      var fg = ctx.createRadialGradient(fl.cx, fl.cy, 0, fl.cx, fl.cy, fl.R * 1.2);
      fg.addColorStop(0, '#fff4d6'); fg.addColorStop(0.35, fl.flash); fg.addColorStop(1, 'transparent');
      ctx.globalAlpha = amp * 0.55; ctx.fillStyle = fg;
      ctx.fillRect(fl.cx - fl.R * 1.2, fl.cy - fl.R * 1.2, fl.R * 2.4, fl.R * 2.4);

      // nebula gas blocks (screen) + a luminous core pass (lighter), brighter at peak
      ctx.globalCompositeOperation = 'screen';
      for (var ci = 0; ci < fl.cells.length; ci++) {
        var cc = fl.cells[ci];
        ctx.globalAlpha = amp * (0.25 + (1 - cc.ring) * 0.6);
        ctx.fillStyle = cc.c;
        ctx.fillRect(cc.x, cc.y, cc.s, cc.s);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (var ck = 0; ck < fl.cells.length; ck++) {
        var c2 = fl.cells[ck];
        if (c2.ring > 0.45) continue;
        ctx.globalAlpha = amp * 0.22 * (1 - c2.ring);
        ctx.fillStyle = c2.c;
        ctx.fillRect(c2.x, c2.y, c2.s, c2.s);
      }

      // bright flecks + fat star cross, strobing with the beat
      for (var fj = 0; fj < fl.flecks.length; fj++) {
        var ff = fl.flecks[fj];
        ctx.globalAlpha = amp > 1 ? 1 : amp;
        ctx.fillStyle = ff.c;
        ctx.fillRect(ff.x, ff.y, ff.s, ff.s);
        ctx.globalAlpha = (amp * 0.6) > 1 ? 1 : amp * 0.6;
        ctx.fillRect(ff.x - ff.s * 2, ff.y, ff.s * 5, 1);
        ctx.fillRect(ff.x, ff.y - ff.s * 2, 1, ff.s * 5);
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
    drawFrame(now - t0);
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
      window.addEventListener('resize', size, { passive: true });
    }
    canvas.style.display = 'block';
    size();
    if (reduce) { drawFrame(0); return; }     // static sprinkle, no animation
    running = true; t0 = 0; raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    if (canvas) { ctx.clearRect(0, 0, W, H); canvas.style.display = 'none'; }
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
