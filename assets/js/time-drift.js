/*
 * time-drift.js — /time/, adrift.
 *
 * You are adrift in the static of someone's memory: moments float past at
 * unknowable distances, humming, and you can reach out and hold one.
 *
 * No 3D anywhere. One scalar (`travel`) moves; depth is an illusion made of
 * blur + scale + opacity + drift-rate parallax. Some artifacts grow as they
 * near; some (huge:true) shrink — they loomed like planets and arrive as
 * motes — so the eye can never triangulate the space. That is the feeling.
 *
 * External file (no inline scripts) to satisfy the page CSP `script-src 'self'`.
 *
 * To hang real art later: set `src` on a memory (e.g. 'assets/images/time/x.png',
 * with a -dark.png sibling) — the drawn-kit slot takes over from the dithered
 * placeholder. `guide` is what to draw (press "g" / add ?guide to see labels).
 * `depth0` is how deep in the drift it lives. `≈` on a year marks a guess.
 */
(function () {
    'use strict';

    /* ================= the collection (edit me) ================= */
    // form: scrap | note | blob | window | whisper | neon | ghost | title
    // layer: 0..3 — drift-rate parallax (0 fastest/nearest-feeling)
    // huge: inverted scale curve (far = looming, near = small)
    // ax/ay: anchor in [-1..1] of the viewport (hand-scattered, never a grid)

    var ERAS = [
        { id: 0, label: 'school after school',            to: 2400 },
        { id: 1, label: 'stevenson — the writing wakes',  to: 6000 },
        { id: 2, label: 'lnzh.org & its little machines', to: 9000 },
        { id: 3, label: 'the threshold',                  to: 12000 }
    ];

    var MEMORIES = [
        { form: 'title', depth0: -150, ax: 0, ay: -0.05, layer: 0, era: 0,
          title: 'time', blurb: '', year: '', guide: '', huge: true },

        // era 0 — far apart, palest (the new kid keeps his distance)
        { form: 'blob', depth0: 900, ax: -0.45, ay: -0.15, layer: 2, era: 0, huge: true,
          year: '≈2012', title: 'hong kong',
          blurb: 'my cup of tea, and the smithfield road mcdonald’s.',
          href: null, src: null, ratio: '1 / 1', guide: 'hong kong — my cup of tea' },
        { form: 'scrap', depth0: 1700, ax: 0.5, ay: 0.2, layer: 1, era: 0, tilt: 2.5,
          year: '≈2017', title: 'palo alto',
          blurb: 'the bayland preserve, and the waverley street 7-eleven.',
          href: null, src: null, ratio: '3 / 2', guide: 'palo alto — the baylands' },
        { form: 'whisper', depth0: 2150, ax: -0.35, ay: 0.3, layer: 2, era: 0,
          year: '≈2020', title: 'the new kid, again',
          blurb: 'a rather inconspicuous role, each time.',
          href: '../blog/gossip/', src: null, ratio: '1 / 1', guide: 'a small portrait, half turned away' },

        // era 1 — the drift fills up (this is the heart)
        { form: 'scrap', depth0: 2750, ax: 0.4, ay: -0.25, layer: 0, era: 1, tilt: -2, huge: true,
          year: '2024', title: 'arriving at stevenson',
          blurb: 'a boarding school by the sea.',
          href: null, src: null, ratio: '4 / 5', guide: 'stevenson, the sea fog' },
        { form: 'note', depth0: 3150, ax: -0.55, ay: -0.05, layer: 1, era: 1,
          year: '2025', title: 'the philosophers',
          blurb: 'camus, schopenhauer, wittgenstein — a shelf.',
          href: '../list/', src: null, ratio: '16 / 9', guide: 'a shelf of paperback spines' },
        { form: 'blob', depth0: 3500, ax: 0.3, ay: 0.35, layer: 3, era: 1,
          year: '2025', title: 'tending the ferments',
          blurb: 'fermented beans, in any form.',
          href: null, src: null, ratio: '1 / 1', guide: 'a ferment jar, mid-bubble' },
        { form: 'note', depth0: 3850, ax: -0.4, ay: -0.3, layer: 1, era: 1,
          year: '2025', title: 'leonzhou7',
          blurb: 'white to play, somehow worse.',
          href: 'https://www.chess.com/member/leonzhou7', src: null, ratio: '1 / 1', guide: 'a chess position' },
        { form: 'neon', depth0: 4200, ax: 0.45, ay: 0.05, layer: 0, era: 1, tilt: 1.5,
          year: '2026', title: 'on existence',
          blurb: 'the first essay. the rest followed.',
          href: '../blog/existence/', src: null, ratio: '3 / 4', guide: 'an essay page, close up' },
        { form: 'whisper', depth0: 4550, ax: -0.3, ay: 0.15, layer: 2, era: 1,
          year: '2026', title: 'times i cried with you',
          blurb: 'the tender register.',
          href: '../blog/times-i-cried/', src: null, ratio: '3 / 4', guide: 'two cups of tea' },
        { form: 'scrap', depth0: 4900, ax: 0.55, ay: -0.2, layer: 1, era: 1, tilt: -4, crooked: true,
          year: '2026', title: 'my tomato sandwich',
          blurb: 'a sandwich, unreasonably considered.',
          href: '../blog/tomato/', src: null, ratio: '4 / 3', guide: 'a tomato sandwich' },
        { form: 'scrap', depth0: 5250, ax: -0.5, ay: -0.35, layer: 0, era: 1, tilt: 1.8,
          year: '2026', title: 'first photographs',
          blurb: 'a newer way of fixing things in place.',
          href: null, src: null, ratio: '3 / 2', guide: 'a still photograph' },
        { form: 'blob', depth0: 5650, ax: 0.25, ay: 0.3, layer: 2, era: 1,
          year: '2026', title: 'graduation',
          blurb: 'defeated by college applications; graduated anyway.',
          href: null, src: null, ratio: '1 / 1', guide: 'a cap, thrown' },

        // era 2 — busiest; the one glowing window
        { form: 'window', depth0: 6250, ax: -0.45, ay: 0.1, layer: 1, era: 2, huge: true,
          year: '2026', title: 'lnzh.org',
          blurb: 'hand-drawn, square-cornered. a home, not a portfolio.',
          href: '../', src: null, ratio: '16 / 10', guide: 'this site, from outside' },
        { form: 'scrap', depth0: 6650, ax: 0.5, ay: 0.3, layer: 2, era: 2, tilt: 3,
          year: '2026', title: 'the coffee project',
          blurb: 'espresso, americano, latte — real orders, no storefront.',
          href: '../archive/coffee/', src: null, ratio: '4 / 3', guide: 'a latte, mid-pour' },
        { form: 'note', depth0: 7050, ax: -0.55, ay: -0.2, layer: 1, era: 2, redact: true,
          year: '2026', title: 'the writing tool',
          blurb: 'one sentence at a time. no going back.',
          href: '../writing/', src: null, ratio: '4 / 3', guide: 'the editor, mid-redaction' },
        { form: 'note', depth0: 7450, ax: 0.35, ay: -0.05, layer: 2, era: 2, caret: true,
          year: '2026', title: 'the instagram worker',
          blurb: 'a little machine that fetches my photographs.',
          href: null, src: null, ratio: '16 / 9', guide: 'a tangle of wires, neatly labeled' },
        { form: 'neon', depth0: 7850, ax: -0.25, ay: 0.25, layer: 0, era: 2, tilt: -1, nova: true,
          year: '2026', title: 'the one-stroke puzzle',
          blurb: 'one stroke unlocks the cosmos.',
          href: null, src: null, ratio: '1 / 1', guide: 'a constellation, traced' },

        // era 3 — the field thins
        { form: 'scrap', depth0: 9500, ax: 0.4, ay: -0.1, layer: 0, era: 3, tilt: 0,
          year: '2026', title: 'the empty frame',
          blurb: 'reserved.',
          href: null, src: null, ratio: '4 / 5', guide: 'whatever happens next' },

        // the futures — dashed, brightest, receding (never arrived at)
        { form: 'ghost', depth0: 10350, ax: -0.5, ay: -0.05, layer: 0, era: 3, huge: true,
          year: 'someday', title: 'chef · philosopher · writer', blurb: 'still becoming.' },
        { form: 'ghost', depth0: 10650, ax: 0, ay: -0.15, layer: 0, era: 3, huge: true,
          year: 'someday', title: 'ai / ml research', blurb: 'a thread, being pulled.' },
        { form: 'ghost', depth0: 10500, ax: 0.5, ay: 0, layer: 0, era: 3, huge: true,
          year: 'someday', title: 'getxd.app', blurb: 'under construction.' },
        { form: 'ghost', depth0: 11050, ax: 0.08, ay: 0.32, layer: 0, era: 3, small: true,
          year: 'someday', title: '(no good at any of the above)', blurb: 'building anyway.' }
    ];

    /* ======================= constants ======================= */

    var TRAVEL_MAX = 9900;          // the futures stay out of reach
    var FORK_AT = 9000;             // decel band start
    var HOLD_AT = 320;              // focus docks a piece this far ahead
    var LAYER_M = [1.0, 0.78, 0.55, 0.34];

    var reduced = !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var drift, field, eraEl, railFill, grainCanvas, curtain, hint, whisperEl, museum;
    var floaters = [];
    var travel = 0, targetTravel = 0, glide = 0, travelEff = 0, tideW = 0;
    var raf = null, t0 = 0, prevT = 0, eraNow = -1, hintDone = false;
    var vw = 0, vh = 0, narrow = false;
    var emergeFar = 2600, emergeNear = 900;
    var held = null;
    var lastInputT = 0, idleWhisperAt = 0;
    var audioPokeT = 0;

    var IDLE_LINES = [
        'hold one · it’ll go quiet for you',
        'the bright part keeps moving',
        'nothing here is finished'
    ];
    var FORK_LINE = 'that part hasn’t happened. you can’t quite reach it.';

    function clampTravel(v) { return Math.max(0, Math.min(TRAVEL_MAX, v)); }

    function absUrl(p) {            // the --*-src rule: ABSOLUTE or it 404s
        return 'url("' + new URL(p, document.baseURI).href + '")';
    }

    function sizeViewport() {
        vw = window.innerWidth;
        vh = window.innerHeight;
        narrow = vw < 600;
        emergeFar = narrow ? 1500 : 2600;
        emergeNear = narrow ? 650 : 900;
    }

    /* ======================= dithered placeholders ======================= */
    // 1-bit Bayer-dithered soft shapes — photocopy scraps until real art lands.

    var BAYER = [
        [0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]
    ];

    function parseRatio(r) {
        var m = /([\d.]+)\s*\/\s*([\d.]+)/.exec(r || '1 / 1');
        return m ? parseFloat(m[1]) / parseFloat(m[2]) : 1;
    }

    function inkRGB() {
        var v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim();
        var c = document.createElement('canvas').getContext('2d');
        c.fillStyle = v || '#000';
        var s = c.fillStyle;                       // normalized #rrggbb
        return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    }

    function drawDither(canvas, seed) {
        var w = canvas.width, h = canvas.height;
        var ctx = canvas.getContext('2d');
        if (!ctx) { return; }
        ctx.clearRect(0, 0, w, h);
        // a soft scene implied, never depicted: 2-3 grayscale clouds
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        var g1 = ctx.createRadialGradient(
            w * (0.3 + (seed % 5) * 0.1), h * 0.35, 4,
            w * (0.3 + (seed % 5) * 0.1), h * 0.35, w * 0.7);
        g1.addColorStop(0, 'rgba(0,0,0,0.85)');
        g1.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, w, h);
        var g2 = ctx.createLinearGradient(0, h * (0.2 + (seed % 3) * 0.2), w, h);
        g2.addColorStop(0, 'rgba(0,0,0,0)');
        g2.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, w, h);

        var img = ctx.getImageData(0, 0, w, h);
        var d = img.data, ink = inkRGB();
        var x, y, i, lum, on;
        for (y = 0; y < h; y++) {
            for (x = 0; x < w; x++) {
                i = (y * w + x) * 4;
                lum = d[i] / 255;                                  // grayscale already
                lum = (lum - 0.5) * 1.7 + 0.5;                     // commit to ink or paper
                on = lum < (BAYER[y % 4][x % 4] + 0.5) / 16;       // darker = inked
                d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2];
                d[i + 3] = on ? 235 : 0;
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    function refreshDithers() {
        for (var i = 0; i < floaters.length; i++) {
            if (floaters[i].dither) { drawDither(floaters[i].dither, i); }
        }
    }

    function tornEdge(seed) {
        // a hand-wobbled clip-path polygon — every scrap torn differently
        var pts = [], n = 14, i, t, wob;
        for (i = 0; i <= n; i++) {                  // top edge, left → right
            t = i / n;
            wob = 1.4 + Math.sin(seed * 3.7 + i * 2.1) * 1.2;
            if (i % 2) { wob += 1.1; }
            pts.push((t * 100).toFixed(1) + '% ' + wob.toFixed(1) + '%');
        }
        for (i = 0; i <= n; i++) {                  // bottom edge, right → left
            t = i / n;
            wob = 98.6 - (Math.cos(seed * 2.3 + i * 1.7) * 1.2 + (i % 2 ? 1.1 : 0));
            pts.push(((1 - t) * 100).toFixed(1) + '% ' + wob.toFixed(1) + '%');
        }
        return 'polygon(' + pts.join(', ') + ')';
    }

    /* ======================= build the field ======================= */

    function plaque(f) {
        var p = document.createElement('div');
        p.className = 'plaque';
        var y = document.createElement('span');
        y.className = 'plaque-year';
        y.textContent = f.year;
        var t = document.createElement('span');
        t.className = 'plaque-title';
        t.textContent = f.title;
        var b = document.createElement('span');
        b.className = 'plaque-blurb';
        b.textContent = f.blurb;
        if (f.year) { p.appendChild(y); }
        p.appendChild(t);
        if (f.blurb) { p.appendChild(b); }
        if (f.href) {
            var a = document.createElement('a');
            a.className = 'plaque-read';
            a.href = f.href;
            if (/^https?:/.test(f.href)) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            }
            a.textContent = 'visit →';
            p.appendChild(a);
        } else if (f.nova) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'plaque-read plaque-nova';
            btn.textContent = 'play →';
            btn.addEventListener('click', openPuzzle);
            p.appendChild(btn);
        }
        return p;
    }

    function buildFace(f, idx) {
        var face = document.createElement('div');
        face.className = 'face face-' + f.form;

        if (f.form === 'title') {
            face.textContent = 'time';
            return face;
        }
        if (f.form === 'whisper') {
            face.textContent = f.blurb || f.title;
            return face;
        }
        if (f.form === 'note') {
            var n1 = document.createElement('span');
            n1.className = 'note-line';
            n1.textContent = f.title;
            var n2 = document.createElement('span');
            n2.className = 'note-line note-body' + (f.redact ? ' note-redact' : '');
            n2.textContent = f.blurb;
            face.appendChild(n1);
            face.appendChild(n2);
            if (f.caret) {
                var c = document.createElement('span');
                c.className = 'note-caret';
                c.setAttribute('aria-hidden', 'true');
                face.appendChild(c);
            }
            return face;
        }
        if (f.form === 'blob') {
            return face;                              // the gradient IS the body
        }
        if (f.form === 'ghost') {
            if (!f.small) {
                var gf = document.createElement('div');
                gf.className = 'ghost-pane';
                face.appendChild(gf);
            }
            return face;
        }

        // scrap / neon / window: a dithered canvas under a drawn-kit slot
        var art = document.createElement('div');
        art.className = 'scrap-face drawn-frame';
        art.style.setProperty('--frame-pad', '0px');
        art.setAttribute('data-guide', f.guide);
        var ratio = parseRatio(f.ratio);
        var cw = 220, ch = Math.max(110, Math.round(cw / ratio));
        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        canvas.className = 'scrap-dither';
        canvas.setAttribute('aria-hidden', 'true');
        f.dither = canvas;
        var slot = document.createElement('div');
        slot.className = 'drawn-slot';
        slot.style.setProperty('--slot-ratio', f.ratio);
        slot.setAttribute('data-cap', 'to be hung: ' + f.guide);
        if (f.src) {
            slot.classList.add('has-art');
            slot.style.setProperty('--slot-src', absUrl(f.src));
            slot.style.setProperty('--slot-src-dark', absUrl(f.src.replace(/\.png$/, '-dark.png')));
        }
        art.style.aspectRatio = f.ratio;
        art.appendChild(canvas);
        art.appendChild(slot);
        if (f.form === 'scrap') {
            art.style.clipPath = tornEdge(idx);
        }
        if (f.form === 'window') {
            var win = document.createElement('div');
            win.className = 'win';
            var bar = document.createElement('div');
            bar.className = 'win-bar';
            var dots = document.createElement('span');
            dots.className = 'win-dots';
            dots.setAttribute('aria-hidden', 'true');
            var wt = document.createElement('span');
            wt.className = 'win-title';
            wt.textContent = 'lnzh.org';
            bar.appendChild(dots);
            bar.appendChild(wt);
            var addr = document.createElement('div');
            addr.className = 'win-addr';
            addr.textContent = 'https://lnzh.org/';
            win.appendChild(bar);
            win.appendChild(addr);
            win.appendChild(art);
            face.appendChild(win);
            return face;
        }
        face.appendChild(art);
        return face;
    }

    function buildField() {
        var i, f, el;
        for (i = 0; i < MEMORIES.length; i++) {
            f = MEMORIES[i];
            el = document.createElement('article');
            el.className = 'mem mem-' + f.form + ' b4' +
                (f.crooked ? ' is-crooked' : '') +
                (f.small ? ' mem-small' : '') +
                (f.nova || f.form === 'neon' ? ' is-neon' : '');
            el.setAttribute('data-era', String(f.era));
            if (f.form !== 'title') {
                el.setAttribute('tabindex', '0');
                el.setAttribute('role', 'group');
                el.setAttribute('aria-label', (f.year ? f.year + ' — ' : '') + f.title);
            } else {
                el.setAttribute('aria-hidden', 'true');
            }
            if (f.tilt) { el.style.setProperty('--tilt', f.tilt + 'deg'); }

            // the face is presentation; the article's aria-label + plaque are
            // the readable surface (also exempts whisper-faint text from
            // contrast audits — it isn't in the accessibility tree)
            var face = buildFace(f, i);
            face.setAttribute('aria-hidden', 'true');
            el.appendChild(face);
            if (f.form !== 'title') { el.appendChild(plaque(f)); }

            el.addEventListener('focusin', onFocusIn);
            el.addEventListener('focusout', onFocusOut);
            el.addEventListener('pointerenter', onEnter);
            el.addEventListener('pointerleave', onLeave);
            el.addEventListener('keydown', onMemKey);
            el.addEventListener('pointerdown', onTapStart);
            el.addEventListener('pointerup', onTapEnd);

            field.appendChild(el);
            f.el = el;
            f.idx = i;
            f.phase = (i * 2.399) % 6.2832;          // golden-angle scatter
            f.bobT = 3200 + (i % 5) * 620;
            f.swayT = 4100 + (i % 4) * 540;
            f.heldW = 0;
            f.bucket = 4;
            f.lastO = -1;
            f.near = false;
            if (f.dither) { drawDither(f.dither, i); }
        }
    }

    /* ======================= the supernova memory ======================= */

    function openPuzzle() {
        if (window.NebulaPath && window.NebulaPath.open) {
            window.NebulaPath.open();
            return;
        }
        if (!document.getElementById('nebula-path-js')) {
            var sc = document.createElement('script');
            sc.id = 'nebula-path-js';
            sc.src = new URL('../assets/js/nebula-path.js', document.baseURI).href;
            sc.onload = function () {
                if (window.NebulaPath && window.NebulaPath.open) { window.NebulaPath.open(); }
            };
            document.body.appendChild(sc);
        }
    }

    /* ======================= the frame ======================= */

    var BUCKETS = ['b0', 'b1', 'b2', 'b3', 'b4'];

    function bucketFor(a) {
        var abs = Math.abs(a);
        var b = abs < 240 ? 0 : abs < 700 ? 1 : abs < 1300 ? 2 : abs < 1900 ? 3 : 4;
        if (a < -80 && b < 2) { b = 2; }            // passed things re-soften
        if (narrow && b > 2) { b = 2; }             // phones cap the blur cost
        return b;
    }

    function place(f, t) {
        var m = LAYER_M[f.layer];
        var a = (f.depth0 - travelEff) * m;
        if (f.form === 'ghost') {                   // the futures recede
            a += Math.max(0, travel - FORK_AT) * 0.55;
        }

        // opacity
        var o;
        if (a > emergeFar) { o = 0; }
        else if (a > emergeNear) { o = (emergeFar - a) / (emergeFar - emergeNear); }
        else if (a > -140) { o = 1; }
        else if (a > -340) { o = 1 - (-a - 140) / 200; }
        else { o = 0; }
        if (f.form === 'title') { o *= 0.5; }       // the zeroth memory stays a ghost
        o = Math.round(o * 50) / 50;

        // scale: grow-as-near, or loom-then-shrink (the ambiguity). Capped at
        // 1.0 near the eye — layers rasterize at layout size, so upscaling
        // would blur the crisp dither exactly when it should sharpen.
        var nf = Math.max(0, Math.min(1, a / emergeFar));
        var s = f.huge
            ? 1.55 - (1 - nf) * 1.1
            : 0.42 + (1 - nf) * 0.58;
        if (narrow) { s *= 0.82; }

        // idle breath (stilled while held)
        var iw = 1 - f.heldW;
        var wMul = f.form === 'whisper' ? 2 : f.form === 'window' ? 0.4 : 1;
        var bob = Math.sin(t / f.bobT + f.phase) * (2.2 + f.layer * 0.8) * iw * wMul;
        var sway = Math.cos(t / f.swayT + f.phase) * (1.4 + f.layer * 0.6) * iw * wMul;
        var breathe = 1 + Math.sin(t / (5200 + f.layer * 600) + f.phase) * 0.012 * iw;
        s = s * breathe * (1 + 0.12 * f.heldW);

        var x = f.ax * (vw * 0.5 - (narrow ? 90 : 170)) + a * f.ax * 0.045 + sway;
        var y = f.ay * (vh * 0.5 - 150) + bob;

        if (o !== f.lastO) {
            f.lastO = o;
            f.el.style.opacity = String(o);
            f.el.style.pointerEvents = o > 0.2 ? '' : 'none';
            var near = o > 0;
            if (near !== f.near) {
                f.near = near;
                f.el.style.willChange = near ? 'transform, opacity' : '';
            }
        }
        if (o === 0) { return; }

        var b = f.heldW > 0.5 ? 0 : bucketFor(a);
        if (b !== f.bucket) {
            f.el.classList.remove(BUCKETS[f.bucket]);
            f.el.classList.add(BUCKETS[b]);
            f.bucket = b;
        }
        f.el.style.transform =
            'translate(-50%, -50%) translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) +
            'px) scale(' + s.toFixed(3) + ') rotate(var(--tilt, 0deg))';
    }

    function updateEra() {
        var i, id = 3;
        for (i = 0; i < ERAS.length; i++) {
            if (travel < ERAS[i].to) { id = ERAS[i].id; break; }
        }
        if (id === eraNow) { return; }
        eraNow = id;
        drift.setAttribute('data-era', String(id));
        if (reduced) {
            eraEl.textContent = ERAS[id].label;
            return;
        }
        eraEl.classList.add('is-swapping');
        window.setTimeout(function () {
            eraEl.textContent = ERAS[id].label;
            eraEl.classList.remove('is-swapping');
        }, 260);
    }

    function updateRail() {
        railFill.style.transform = 'scaleY(' + (travel / TRAVEL_MAX).toFixed(4) + ')';
    }

    /* ---- grain: motes + static + toner streaks on one canvas; yields to
            nebula-glint in cosmic mode ---- */
    var grain = { ctx: null, motes: [], on: true, w: 0, h: 0, dpr: 1, frame: 0, ink: '51,51,51', neon: '240,70,140' };

    function grainColors() {
        var cs = getComputedStyle(document.documentElement);
        grain.ink = cs.getPropertyValue('--text-rgb').trim() || '51,51,51';
        var n = getComputedStyle(drift).getPropertyValue('--time-neon-rgb').trim();
        if (n) { grain.neon = n; }
    }

    function grainResize() {
        grain.dpr = Math.min(window.devicePixelRatio || 1, 2);
        grain.w = grainCanvas.width = Math.floor(window.innerWidth * grain.dpr);
        grain.h = grainCanvas.height = Math.floor(window.innerHeight * grain.dpr);
    }

    function grainInit() {
        grain.ctx = grainCanvas.getContext('2d');
        if (!grain.ctx) { return; }
        grainResize();
        grainColors();
        var n = narrow ? 24 : 42, i;
        for (i = 0; i < n; i++) {
            grain.motes.push({
                x: Math.random(), y: Math.random(),
                s: 1 + Math.random() * 2,
                v: 0.012 + Math.random() * 0.03,
                a: 0.05 + Math.random() * 0.13,
                ph: Math.random() * 6.2832,
                neon: i % 10 === 0
            });
        }
        window.addEventListener('resize', grainResize);
    }

    function drawGrain(t, dt) {
        if (!grain.ctx || !grain.on) { return; }
        grain.frame++;
        if (!reduced && grain.frame % 3 !== 0) { return; }   // film, not video
        var ctx = grain.ctx, i, m, tw;
        ctx.clearRect(0, 0, grain.w, grain.h);
        // drifting motes
        for (i = 0; i < grain.motes.length; i++) {
            m = grain.motes[i];
            m.y -= m.v * ((dt * 3) / 1000);
            if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
            tw = 0.6 + 0.4 * Math.sin(t / 900 + m.ph);
            ctx.globalAlpha = m.a * tw;
            ctx.fillStyle = 'rgb(' + (m.neon ? grain.neon : grain.ink) + ')';
            ctx.fillRect((m.x * grain.w) | 0, (m.y * grain.h) | 0,
                m.s * grain.dpr, m.s * grain.dpr);
        }
        // photocopy static
        ctx.fillStyle = 'rgb(' + grain.ink + ')';
        var n = narrow ? 50 : 90;
        for (i = 0; i < n; i++) {
            ctx.globalAlpha = 0.03 + Math.random() * 0.05;
            ctx.fillRect((Math.random() * grain.w) | 0, (Math.random() * grain.h) | 0,
                grain.dpr, grain.dpr);
        }
        // the occasional toner streak
        if (Math.random() < 0.05) {
            ctx.globalAlpha = 0.04;
            ctx.fillRect(0, (Math.random() * grain.h) | 0, grain.w, grain.dpr);
        }
        ctx.globalAlpha = 1;
    }

    function watchCosmic() {
        var sync = function () {
            var cosmic = document.documentElement.getAttribute('data-palette') === 'cosmic';
            grain.on = !cosmic;
            drift.classList.toggle('is-cosmic', cosmic);
            if (cosmic && grain.ctx) { grain.ctx.clearRect(0, 0, grain.w, grain.h); }
        };
        sync();
        new MutationObserver(sync).observe(document.documentElement,
            { attributes: true, attributeFilter: ['data-palette'] });
    }

    function watchTheme() {
        new MutationObserver(function () {
            grainColors();
            refreshDithers();
        }).observe(document.documentElement,
            { attributes: true, attributeFilter: ['data-theme'] });
    }

    /* ======================= the loop ======================= */

    function frame(now) {
        if (!t0) { t0 = now; prevT = now; lastInputT = now; }
        var dt = now - prevT;
        if (dt <= 0 || dt > 50) { dt = 16.7; }
        prevT = now;
        var k = dt / 16.7;

        if (glide) {
            targetTravel = clampTravel(targetTravel + glide * k);
            glide *= Math.pow(0.93, k);
            if (Math.abs(glide) < 0.05) { glide = 0; }
        }
        var kZ = targetTravel > FORK_AT ? 0.034 : 0.075;
        travel += (targetTravel - travel) * kZ * k;
        if (Math.abs(targetTravel - travel) < 0.05) { travel = targetTravel; }

        // the idle tide: a bounded breath (±6), never a current — the field
        // sways at rest but no one is carried anywhere
        var idle = now - lastInputT > 2500 && !held;
        tideW += ((idle ? 1 : 0) - tideW) * 0.012 * k;
        travelEff = travel + Math.sin(now / 14000) * 6 * tideW;

        var i, f;
        for (i = 0; i < floaters.length; i++) {
            f = floaters[i];
            var hTarget = (held === f) ? 1 : 0;
            f.heldW += (hTarget - f.heldW) * (hTarget ? 0.13 : 0.055) * k;
            if (f.heldW < 0.002) { f.heldW = 0; }
            place(f, now);
        }

        updateEra();
        updateRail();
        drawGrain(now, dt);
        dismissHintIfDrifting();
        idleWhisper(now);

        if (now - audioPokeT > 250 && window.lnzhHum && window.lnzhHum.running()) {
            audioPokeT = now;
            window.lnzhHum.setDepth(travel / TRAVEL_MAX);
        }
        raf = window.requestAnimationFrame(frame);
    }

    function applyOnce() {           // reduced motion: settle instantly, no loop
        travel = targetTravel = clampTravel(targetTravel);
        travelEff = travel;
        for (var i = 0; i < floaters.length; i++) {
            floaters[i].heldW = held === floaters[i] ? 1 : 0;
            place(floaters[i], 0);
        }
        updateEra();
        updateRail();
        dismissHintIfDrifting();
    }

    function nudge(dz) {
        targetTravel = clampTravel(targetTravel + dz);
        if (reduced) { applyOnce(); }
    }

    /* ======================= holding ======================= */

    function setHeld(f) {
        if (held === f) { return; }
        if (held) { held.el.classList.remove('is-held'); }
        held = f;
        if (f) {
            f.el.classList.add('is-held');
            if (window.lnzhHum) { window.lnzhHum.blip(f.idx); }
        }
        if (reduced) { applyOnce(); }
    }

    function floaterOf(el) {
        for (var i = 0; i < floaters.length; i++) {
            if (floaters[i].el === el) { return floaters[i]; }
        }
        return null;
    }

    function onEnter(e) {
        if (e.pointerType && e.pointerType !== 'mouse') { return; }
        setHeld(floaterOf(e.currentTarget));
    }
    function onLeave(e) {
        if (e.pointerType && e.pointerType !== 'mouse') { return; }
        var f = floaterOf(e.currentTarget);
        if (held === f && document.activeElement !== e.currentTarget) { setHeld(null); }
    }
    function onFocusIn(e) {
        var f = floaterOf(e.currentTarget);
        if (!f) { return; }
        setHeld(f);
        glide = 0;
        targetTravel = clampTravel(f.depth0 - HOLD_AT / LAYER_M[f.layer]);
        if (reduced) { applyOnce(); }
    }
    function onFocusOut(e) {
        var f = floaterOf(e.currentTarget);
        if (held === f && !e.currentTarget.contains(e.relatedTarget)) { setHeld(null); }
    }
    function onMemKey(e) {
        if (e.key !== 'Enter' || e.target !== e.currentTarget) { return; }
        var go = e.currentTarget.querySelector('.plaque-read');
        if (go) { go.click(); }
    }

    /* touch: a real tap holds (far: drifts to it; held: follows its link) */
    var tapDown = null;
    function onTapStart(e) {
        if (e.pointerType === 'mouse') { return; }
        tapDown = { x: e.clientX, y: e.clientY, t: e.timeStamp, el: e.currentTarget };
    }
    function onTapEnd(e) {
        if (!tapDown || tapDown.el !== e.currentTarget) { tapDown = null; return; }
        var dx = e.clientX - tapDown.x, dy = e.clientY - tapDown.y, dt = e.timeStamp - tapDown.t;
        tapDown = null;
        if (dx * dx + dy * dy > 144 || dt > 400) { return; }
        var f = floaterOf(e.currentTarget);
        if (!f) { return; }
        if (held === f) {
            var go = f.el.querySelector('.plaque-read');
            if (go) { go.click(); }
            return;
        }
        setHeld(f);
        glide = 0;
        targetTravel = clampTravel(f.depth0 - HOLD_AT / LAYER_M[f.layer]);
        if (reduced) { applyOnce(); }
    }

    /* ======================= input ======================= */

    function modalOpen() {
        return !!(window.NebulaPath && window.NebulaPath.isOpen && window.NebulaPath.isOpen()) ||
            !!document.querySelector('.theme-settings-panel:not([hidden])');
    }

    function poke() { lastInputT = prevT || 1; }

    function onWheel(e) {
        if (modalOpen()) { return; }
        e.preventDefault();
        poke();
        glide = 0;
        nudge(e.deltaY * (e.deltaMode === 1 ? 18 : 1.25));
    }

    function onKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) { return; }
        if (modalOpen()) { return; }                 // the modal owns every key
        var el = document.activeElement;
        if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) { return; }
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': case 'PageUp':
                e.preventDefault(); poke(); nudge(440); break;
            case 'ArrowDown': case 's': case 'S': case 'PageDown':
                e.preventDefault(); poke(); nudge(-440); break;
            case 'Home':
                e.preventDefault(); poke(); glide = 0; targetTravel = 0;
                if (reduced) { applyOnce(); }
                break;
            case 'End':
                e.preventDefault(); poke(); glide = 0; targetTravel = TRAVEL_MAX;
                if (reduced) { applyOnce(); }
                break;
            case 'm': case 'M':
                if (window.lnzhHum) { toggleHum(); }
                break;
            case 'Escape':
                var exit = document.querySelector('.museum-exit');
                if (exit) { exit.focus(); }
                break;
        }
    }

    var touch = { id: null, lastY: 0, lastT: 0, vel: 0 };
    function onPointerDown(e) {
        if (e.pointerType !== 'touch') { return; }
        touch.id = e.pointerId;
        touch.lastY = e.clientY;
        touch.lastT = e.timeStamp;
        touch.vel = 0;
        glide = 0;
    }
    function onPointerMove(e) {
        if (e.pointerId !== touch.id) { return; }
        if (modalOpen()) { return; }
        poke();
        var dy = touch.lastY - e.clientY;            // swipe up = drift deeper
        var dt = Math.max(1, e.timeStamp - touch.lastT);
        touch.vel = (dy * 2.4) / (dt / 16.7);
        touch.lastY = e.clientY;
        touch.lastT = e.timeStamp;
        nudge(dy * 2.4);
    }
    function onPointerUp(e) {
        if (e.pointerId !== touch.id) { return; }
        touch.id = null;
        if (!reduced && Math.abs(touch.vel) > 1) { glide = touch.vel; }
    }

    /* ======================= hum toggle ======================= */

    var humBtn;
    function syncHumBtn() {
        if (!humBtn || !window.lnzhHum) { return; }
        var on = !window.lnzhHum.muted();
        humBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        humBtn.textContent = on ? '● hum' : '○ hum';
        humBtn.setAttribute('aria-label', on ? 'Turn the hum off' : 'Turn the hum on');
    }
    function toggleHum() {
        if (!window.lnzhHum) { return; }
        var wasMuted = window.lnzhHum.muted();
        window.lnzhHum.setMute(!wasMuted);
        if (wasMuted) { window.lnzhHum.start(); }    // unmuting is a gesture: safe
        syncHumBtn();
    }
    function buildHumBtn() {
        humBtn = document.createElement('button');
        humBtn.type = 'button';
        humBtn.className = 'time-hum';
        humBtn.addEventListener('click', toggleHum);
        museum.appendChild(humBtn);
        syncHumBtn();
    }

    /* ======================= curtain / hints ======================= */

    function dismissHintIfDrifting() {
        if (hintDone || !hint) { return; }
        if (travel > 260) {
            hintDone = true;
            hint.classList.add('is-done');
        }
    }

    function idleWhisper(now) {
        if (!whisperEl || reduced) { return; }
        if (travel > FORK_AT + 300) {
            if (whisperEl.textContent !== FORK_LINE) {
                whisperEl.textContent = FORK_LINE;
                whisperEl.classList.add('is-on');
            }
            return;
        }
        if (now - lastInputT > 9000) {
            if (!whisperEl.classList.contains('is-on')) {
                whisperEl.textContent = IDLE_LINES[idleWhisperAt % IDLE_LINES.length];
                idleWhisperAt++;
                whisperEl.classList.add('is-on');
            }
        } else if (whisperEl.classList.contains('is-on')) {
            whisperEl.classList.remove('is-on');
        }
    }

    function firstGesture() {
        if (window.lnzhHum) { window.lnzhHum.start(); }
        liftNow();
    }

    var lifted = false;
    function liftNow() {
        if (lifted || !curtain) { return; }
        lifted = true;
        if (reduced) {
            curtain.hidden = true;
            return;
        }
        curtain.classList.add('is-lifting');         // blurs + brightens away
        window.setTimeout(function () { curtain.hidden = true; }, 950);
    }

    function wireCurtain() {
        if (!curtain) { return; }
        if (reduced) { curtain.hidden = true; return; }
        window.setTimeout(liftNow, 1400);
        curtain.addEventListener('click', firstGesture);
    }

    /* ======================= init ======================= */

    function init() {
        museum = document.getElementById('museum');
        if (!museum) { return; }
        drift = museum.querySelector('.drift');
        field = museum.querySelector('.field');
        eraEl = museum.querySelector('.museum-era');
        railFill = museum.querySelector('.museum-rail-fill');
        grainCanvas = museum.querySelector('.dust');
        curtain = museum.querySelector('.museum-curtain');
        hint = museum.querySelector('.museum-hint');
        whisperEl = museum.querySelector('.museum-whisper');

        document.body.classList.add('museum-on');
        museum.classList.add('js-on');

        sizeViewport();
        floaters = MEMORIES;
        buildField();
        drift.setAttribute('data-era', '0');
        eraEl.textContent = ERAS[0].label;
        buildHumBtn();

        // deep-link: /time/?at=6700 starts that deep
        var at = parseFloat(new URLSearchParams(window.location.search).get('at'));
        if (!isNaN(at)) { travel = targetTravel = clampTravel(at); }

        window.addEventListener('wheel', onWheel, { passive: false });
        // capture phase: the modal-open check must run BEFORE a modal's own
        // Escape handler closes it, or the field steals the restored focus
        window.addEventListener('keydown', onKey, { capture: true });
        var stage = drift;
        stage.addEventListener('pointerdown', onPointerDown);
        stage.addEventListener('pointermove', onPointerMove);
        stage.addEventListener('pointerup', onPointerUp);
        stage.addEventListener('pointercancel', onPointerUp);
        window.addEventListener('resize', function () {
            sizeViewport();
            if (reduced) { applyOnce(); }
        });

        // the first real gesture lifts the curtain and wakes the hum
        ['pointerdown', 'wheel', 'keydown'].forEach(function (ev) {
            window.addEventListener(ev, function once() {
                window.removeEventListener(ev, once);
                firstGesture();
            }, { passive: true });
        });

        grainInit();
        watchCosmic();
        watchTheme();
        wireCurtain();

        if (reduced) {
            drawGrain(0, 0);
            applyOnce();
        } else {
            raf = window.requestAnimationFrame(frame);
        }

        // tiny dev/test hook, same spirit as window.lnzhPalette
        window.lnzhTime = {
            goto: function (depth) {
                glide = 0;
                targetTravel = clampTravel(depth);
                if (reduced) { applyOnce(); }
            },
            depth: function () { return travel; }
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
