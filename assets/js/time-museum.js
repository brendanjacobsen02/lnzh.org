/*
 * time-museum.js — the long gallery at /time/.
 *
 * A CSS-3D corridor you walk down: life on the walls, each era its own air,
 * the hall forking into dashed, unbuilt branches at the end. One rAF moves ONE
 * element (.world); everything else is hung once at build time.
 *
 * External file (no inline scripts) to satisfy the page CSP `script-src 'self'`.
 *
 * To hang real art: set `src` on an exhibit to e.g. 'assets/images/time/tomato.png'
 * (with a -dark.png sibling) — nothing else changes. `guide` is what to draw
 * (press "g" / add ?guide to see every empty slot labeled, via drawn-kit.js).
 * Z grows negative as you walk in. `≈` on a year marks a guess.
 */
(function () {
    'use strict';

    /* ================= the museum's collection (edit me) ================= */

    var ERAS = [
        { id: 0, label: 'school after school',            accent: 'var(--cat-olive)',  from: 0,     to: -2400 },
        { id: 1, label: 'stevenson — the writing wakes',  accent: 'var(--cat-amber)',  from: -2400, to: -6000 },
        { id: 2, label: 'lnzh.org & its little machines', accent: 'var(--cat-green)',  from: -6000, to: -9000 },
        { id: 3, label: 'the threshold',                  accent: 'var(--cat-violet)', from: -9000, to: -11400 }
    ];

    var EXHIBITS = [
        // era 0 — hung far apart, small (the new kid keeps his distance)
        { era: 0, z: -900,  wall: 'left',  year: '≈2012', title: 'hong kong',
          blurb: 'my cup of tea, and the smithfield road mcdonald’s.',
          href: null, src: null, ratio: '4 / 5', guide: 'hong kong — my cup of tea' },
        { era: 0, z: -1700, wall: 'right', year: '≈2017', title: 'palo alto',
          blurb: 'the bayland preserve, and the waverley street 7-eleven.',
          href: null, src: null, ratio: '3 / 2', guide: 'palo alto — the baylands' },
        { era: 0, z: -2150, wall: 'left',  year: '≈2020', title: 'the new kid, again',
          blurb: 'a rather inconspicuous role, each time.',
          href: '../blog/gossip/', src: null, ratio: '1 / 1', guide: 'a small portrait, half turned away' },

        // era 1 — the corridor fills up (this is the heart)
        { era: 1, z: -2750, wall: 'right', year: '2024', title: 'arriving at stevenson',
          blurb: 'a boarding school by the sea.',
          href: null, src: null, ratio: '4 / 5', guide: 'stevenson, the sea fog' },
        { era: 1, z: -3150, wall: 'left',  year: '2025', title: 'the philosophers',
          blurb: 'camus, schopenhauer, wittgenstein — a shelf.',
          href: '../list/', src: null, ratio: '16 / 9', guide: 'a shelf of paperback spines' },
        { era: 1, z: -3500, wall: 'right', year: '2025', title: 'tending the ferments',
          blurb: 'fermented beans, in any form.',
          href: null, src: null, ratio: '1 / 1', guide: 'a ferment jar, mid-bubble' },
        { era: 1, z: -3850, wall: 'left',  year: '2025', title: 'leonzhou7',
          blurb: 'white to play, somehow worse.',
          href: 'https://www.chess.com/member/leonzhou7', src: null, ratio: '1 / 1', guide: 'a chess position' },
        { era: 1, z: -4200, wall: 'right', year: '2026', title: 'on existence',
          blurb: 'the first essay. the rest followed.',
          href: '../blog/existence/', src: null, ratio: '3 / 4', guide: 'an essay page, close up' },
        { era: 1, z: -4550, wall: 'left',  year: '2026', title: 'times i cried with you',
          blurb: 'the tender register.',
          href: '../blog/times-i-cried/', src: null, ratio: '3 / 4', guide: 'two cups of tea' },
        { era: 1, z: -4900, wall: 'right', year: '2026', title: 'my tomato sandwich',
          blurb: 'a sandwich, unreasonably considered.',
          href: '../blog/tomato/', src: null, ratio: '4 / 3', guide: 'a tomato sandwich', crooked: true },
        { era: 1, z: -5250, wall: 'left',  year: '2026', title: 'first photographs',
          blurb: 'a newer way of fixing things in place.',
          href: null, src: null, ratio: '3 / 2', guide: 'a still photograph' },
        { era: 1, z: -5650, wall: 'right', year: '2026', title: 'graduation',
          blurb: 'defeated by college applications; graduated anyway.',
          href: null, src: null, ratio: '4 / 3', guide: 'a cap, thrown' },

        // era 2 — the most "made" room
        { era: 2, z: -6250, wall: 'left',  year: '2026', title: 'lnzh.org',
          blurb: 'hand-drawn, square-cornered. a home, not a portfolio.',
          href: '../', src: null, ratio: '16 / 10', guide: 'this site, from outside' },
        { era: 2, z: -6650, wall: 'right', year: '2026', title: 'the coffee project',
          blurb: 'espresso, americano, latte — real orders, no storefront.',
          href: '../archive/coffee/', src: null, ratio: '4 / 3', guide: 'a latte, mid-pour' },
        { era: 2, z: -7050, wall: 'left',  year: '2026', title: 'the writing tool',
          blurb: 'one sentence at a time. no going back.',
          href: '../writing/', src: null, ratio: '4 / 3', guide: 'the editor, mid-redaction' },
        { era: 2, z: -7450, wall: 'right', year: '2026', title: 'the instagram worker',
          blurb: 'a little machine that fetches my photographs.',
          href: null, src: null, ratio: '16 / 9', guide: 'a tangle of wires, neatly labeled' },
        { era: 2, z: -7850, wall: 'left',  year: '2026', title: 'the one-stroke puzzle',
          blurb: 'one stroke unlocks the cosmos.',
          href: null, src: null, ratio: '1 / 1', guide: 'a constellation, traced', nova: true },

        // era 3 — sparse; the walls run out
        { era: 3, z: -9500, wall: 'right', year: '2026', title: 'the empty frame',
          blurb: 'reserved.',
          href: null, src: null, ratio: '4 / 5', guide: 'whatever happens next' }
    ];

    // the fork — dashed, future-tense, never arrived at
    var FUTURE = [
        { lane: -1, z: -10350, title: 'chef · philosopher · writer', blurb: 'still becoming.' },
        { lane: 0,  z: -10650, title: 'ai / ml research',                     blurb: 'a thread, being pulled.' },
        { lane: 1,  z: -10500, title: 'getxd.app',                            blurb: 'under construction.' },
        { lane: 0,  z: -11050, title: '(no good at any of the above)',        blurb: 'building anyway.', small: true }
    ];

    /* ======================= scene constants ======================= */

    var WALK_MAX = 9900;           // you decelerate into the fork, never reach it
    var FORK_AT = 9000;            // decel band starts where era 3 does
    var DOCK_BACKOFF = 640;        // stop this far short of a focused piece
    var FLOOR_LEN = 12600;         // a little past the endcap
    var BACKFILL = 900;            // architecture continues behind the entrance

    var reduced = !!(window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    var museum, world, stage, eraEl, railFill, dustCanvas, curtain, hint;
    var exhibitEls = [];           // { el, z, fade } for the per-frame haze
    var walk = 0, targetWalk = 0, lean = 0, targetLean = 0, glide = 0;
    var raf = null, t0 = 0, prevT = 0, eraNow = -1, hintDone = false;

    function clampWalk(v) { return Math.max(0, Math.min(WALK_MAX, v)); }

    function absUrl(p) {           // the --*-src rule: ABSOLUTE or it 404s
        return 'url("' + new URL(p, document.baseURI).href + '")';
    }

    /* ======================= build the hall ======================= */

    function buildWalls() {
        var i, era, from, len, mid, seg, side, sides = ['left', 'right'];
        for (i = 0; i < ERAS.length; i++) {
            era = ERAS[i];
            from = i === 0 ? era.from + BACKFILL : era.from;
            len = from - era.to;
            mid = (from + era.to) / 2;
            for (side = 0; side < 2; side++) {
                seg = document.createElement('div');
                seg.className = 'plane wall wall-' + sides[side];
                seg.style.width = len + 'px';
                seg.style.setProperty('--seg-c', era.accent);
                seg.style.transform =
                    'translate(-50%,-50%) translateX(calc(' + (side === 0 ? '-1' : '1') +
                    ' * var(--hw))) translateZ(' + mid + 'px) rotateY(' +
                    (side === 0 ? '90deg' : '-90deg') + ')';
                world.appendChild(seg);
            }
        }
    }

    function buildFloor() {
        var floor = document.createElement('div');
        floor.className = 'plane floor';
        floor.style.height = FLOOR_LEN + 'px';
        floor.style.transform =
            'translate(-50%,-50%) translateY(var(--floor-drop)) translateZ(' +
            (BACKFILL - FLOOR_LEN / 2) + 'px) rotateX(90deg)';

        // the timeline itself: a hand-wobbled ink line down the floor, splitting
        // into dashed branches at the fork (the past is solid; the future isn't).
        // Floor plane: SVG y=1200 is the near (entrance) edge, y=0 the far end.
        var zTop = BACKFILL - FLOOR_LEN;                  // z at SVG y=0
        function yOf(z) { return ((z - zTop) / FLOOR_LEN) * 1200; }
        var yNear = yOf(0), yFork = yOf(ERAS[3].from), yTip = yOf(-11400);
        var span = yNear - yFork;
        function w(f, dx) { return (50 + dx) + ' ' + (yNear - span * f); }
        var svg =
            '<svg class="floor-line" viewBox="0 0 100 1200" preserveAspectRatio="none" aria-hidden="true">' +
            '<path class="line-past" d="M' + w(0, 0) +
            ' C ' + w(0.1, -2.6) + ', ' + w(0.18, 2.8) + ', ' + w(0.28, -0.4) +
            ' S ' + w(0.46, -3) + ', ' + w(0.55, 0.4) +
            ' S ' + w(0.74, 2.6) + ', ' + w(0.84, -0.8) +
            ' S ' + w(0.95, -2.4) + ', ' + w(1, 0) + '" ' +
            'fill="none" stroke-width="0.5" vector-effect="non-scaling-stroke"/>' +
            '<path class="line-future" d="M50 ' + yFork + ' C 40 ' + (yFork - 60) + ', 26 ' + (yFork - 110) + ', 17 ' + yTip + '" ' +
            'fill="none" stroke-width="0.45" stroke-dasharray="2 1.6" vector-effect="non-scaling-stroke"/>' +
            '<path class="line-future" d="M50 ' + yFork + ' C 50 ' + (yFork - 70) + ', 50 ' + (yFork - 140) + ', 50 ' + yTip + '" ' +
            'fill="none" stroke-width="0.45" stroke-dasharray="2 1.6" vector-effect="non-scaling-stroke"/>' +
            '<path class="line-future" d="M50 ' + yFork + ' C 60 ' + (yFork - 60) + ', 74 ' + (yFork - 110) + ', 83 ' + yTip + '" ' +
            'fill="none" stroke-width="0.45" stroke-dasharray="2 1.6" vector-effect="non-scaling-stroke"/>' +
            '</svg>';
        floor.innerHTML = svg;
        world.appendChild(floor);
    }

    function buildEndcap() {
        var cap = document.createElement('div');
        cap.className = 'plane endcap';
        cap.setAttribute('aria-hidden', 'true');
        cap.style.transform = 'translate(-50%,-50%) translateZ(-12200px)';
        var stars = document.createElement('div');
        stars.className = 'endcap-stars';
        cap.appendChild(stars);
        world.appendChild(cap);
    }

    function plaque(year, title, blurb, href, nova) {
        var p = document.createElement('div');
        p.className = 'plaque';
        var y = document.createElement('span');
        y.className = 'plaque-year';
        y.textContent = year;
        var t = document.createElement('span');
        t.className = 'plaque-title';
        t.textContent = title;
        var b = document.createElement('span');
        b.className = 'plaque-blurb';
        b.textContent = blurb;
        p.appendChild(y);
        p.appendChild(t);
        p.appendChild(b);
        if (href) {
            var a = document.createElement('a');
            a.className = 'plaque-read';
            a.href = href;
            if (/^https?:/.test(href)) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            }
            a.textContent = 'visit →';
            p.appendChild(a);
        } else if (nova) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'plaque-read plaque-nova';
            btn.textContent = 'play →';
            btn.addEventListener('click', openPuzzle);
            p.appendChild(btn);
        }
        return p;
    }

    function buildExhibits() {
        var i, ex, art, frame, slot;
        for (i = 0; i < EXHIBITS.length; i++) {
            ex = EXHIBITS[i];
            art = document.createElement('article');
            art.className = 'exhibit';
            art.setAttribute('data-wall', ex.wall);
            art.setAttribute('data-era', String(ex.era));
            art.setAttribute('tabindex', '0');
            art.setAttribute('role', 'group');
            art.setAttribute('aria-label', ex.year + ' — ' + ex.title);
            art.style.setProperty('--i', String(i));
            art.style.setProperty('--ex-z', ex.z + 'px');
            if (ex.crooked) { art.classList.add('is-crooked'); }

            frame = document.createElement('div');
            frame.className = 'exhibit-frame drawn-frame';
            frame.style.setProperty('--frame-pad', '0px');
            frame.setAttribute('data-guide', ex.guide);
            slot = document.createElement('div');
            slot.className = 'drawn-slot';
            slot.style.setProperty('--slot-ratio', ex.ratio);
            if (ex.src) {
                slot.classList.add('has-art');
                slot.style.setProperty('--slot-src', absUrl(ex.src));
                slot.style.setProperty('--slot-src-dark',
                    absUrl(ex.src.replace(/\.png$/, '-dark.png')));
            } else {
                frame.classList.add('is-placeholder');
                slot.setAttribute('data-cap', 'to be hung: ' + ex.guide);
            }
            frame.appendChild(slot);

            art.appendChild(frame);
            art.appendChild(plaque(ex.year, ex.title, ex.blurb, ex.href, ex.nova));
            art.addEventListener('focus', onExhibitFocus);
            art.addEventListener('keydown', onExhibitKey);
            art.addEventListener('pointerdown', onExhibitTapStart);
            art.addEventListener('pointerup', onExhibitTapEnd);
            world.appendChild(art);
            exhibitEls.push({ el: art, z: ex.z, fade: -1 });
        }
    }

    function buildFork() {
        var i, f, g, frame, lane;
        for (i = 0; i < FUTURE.length; i++) {
            f = FUTURE[i];
            g = document.createElement('article');
            g.className = 'ghost';
            lane = f.lane < 0 ? 'left' : (f.lane > 0 ? 'right' : 'mid');
            g.setAttribute('data-lane', lane);
            g.setAttribute('tabindex', '0');
            g.setAttribute('role', 'group');
            g.setAttribute('aria-label', 'someday — ' + f.title);
            g.style.setProperty('--ex-z', f.z + 'px');
            if (f.small) { g.classList.add('ghost--small'); }
            frame = document.createElement('div');
            frame.className = 'ghost-frame';
            g.appendChild(frame);
            g.appendChild(plaque('someday', f.title, f.blurb, null, false));
            g.addEventListener('focus', onExhibitFocus);
            world.appendChild(g);
            exhibitEls.push({ el: g, z: f.z, fade: -1, ghost: true });
        }
    }

    /* ======================= the supernova exhibit ======================= */

    function openPuzzle() {
        // same lazy hook theme-toggle.js uses; the puzzle does its own unlocking —
        // the museum only points at the game, it never skips it
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

    /* ======================= camera + ambience ======================= */

    function applyWorld(t) {
        var sway = reduced ? 0 : Math.sin((t - t0) / 7000) * 0.4;
        world.style.transform = 'translate3d(' + (-lean).toFixed(2) + 'px, 0, ' +
            walk.toFixed(2) + 'px) rotateY(' + (sway + lean * 0.012).toFixed(3) + 'deg)';
    }

    // emergence band — much narrower on phones, where every piece shares the
    // center lane and would otherwise pile up; the walked-past fade also starts
    // sooner there so the piece behind clears the one in front
    var hazeFar = -6400, hazeNear = -5200, narrowFade = false;
    function sizeHaze() {
        var narrow = window.innerWidth < 600;
        narrowFade = narrow;
        hazeFar = narrow ? -1080 : -6400;
        hazeNear = narrow ? -760 : -5200;
    }

    function updateFades() {
        var i, d, o, rec, far, near, passAt, passSpan;
        for (i = 0; i < exhibitEls.length; i++) {
            rec = exhibitEls[i];
            d = rec.z + walk;                       // 0 = at the camera plane
            // ghosts fan sideways (no pile-up) and are never walked past, so
            // they keep the long view even on phones
            far = rec.ghost && narrowFade ? -1600 : hazeFar;
            near = rec.ghost && narrowFade ? -1100 : hazeNear;
            passAt = narrowFade && !rec.ghost ? -600 : -60;
            passSpan = narrowFade && !rec.ghost ? 380 : 360;
            if (d < far) { o = 0; }                 // still lost in the haze
            else if (d < near) { o = (d - far) / (near - far); }
            else if (d < passAt) { o = 1; }
            else if (d < passAt + passSpan) { o = 1 - (d - passAt) / passSpan; }  // walked past
            else { o = 0; }
            o = Math.round(o * 50) / 50;
            if (o !== rec.fade) {
                rec.fade = o;
                rec.el.style.opacity = String(o);
                rec.el.style.pointerEvents = o > 0.25 ? '' : 'none';
            }
        }
    }

    function updateEra() {
        var i, depth = -walk, label = ERAS[0].label, id = 0;
        for (i = 0; i < ERAS.length; i++) {
            if (depth <= ERAS[i].from && depth > ERAS[i].to) {
                label = ERAS[i].label;
                id = ERAS[i].id;
                break;
            }
        }
        if (depth <= ERAS[ERAS.length - 1].to) {
            id = ERAS[ERAS.length - 1].id;
            label = ERAS[ERAS.length - 1].label;
        }
        if (id === eraNow) { return; }
        eraNow = id;
        world.setAttribute('data-era', String(id));
        if (reduced) {
            eraEl.textContent = label;
            return;
        }
        eraEl.classList.add('is-swapping');
        window.setTimeout(function () {
            eraEl.textContent = label;
            eraEl.classList.remove('is-swapping');
        }, 260);
    }

    var deepNow = false;
    function updateRail() {
        railFill.style.transform = 'scaleY(' + (walk / WALK_MAX).toFixed(4) + ')';
        var deep = walk > FORK_AT + 200;        // the fog lifts as you reach the stars
        if (deep !== deepNow) {
            deepNow = deep;
            museum.classList.toggle('is-deep', deep);
        }
    }

    /* ---- dust: a few chunky motes drifting up, paused in cosmic mode
            (nebula-glint.js owns the ambience there) ---- */
    var dust = { ctx: null, motes: [], on: true, w: 0, h: 0, dpr: 1 };

    function dustResize() {
        dust.dpr = Math.min(window.devicePixelRatio || 1, 2);
        dust.w = dustCanvas.width = Math.floor(window.innerWidth * dust.dpr);
        dust.h = dustCanvas.height = Math.floor(window.innerHeight * dust.dpr);
    }

    function dustInit() {
        dust.ctx = dustCanvas.getContext('2d');
        if (!dust.ctx) { return; }
        dustResize();
        var n = 42, i;
        for (i = 0; i < n; i++) {
            dust.motes.push({
                x: Math.random(), y: Math.random(),
                s: (1 + Math.random() * 2),
                v: 0.012 + Math.random() * 0.03,      // % of height per second, upward
                a: 0.04 + Math.random() * 0.12,
                ph: Math.random() * 6.2832
            });
        }
        window.addEventListener('resize', dustResize);
    }

    function drawDust(t, dt) {
        if (!dust.ctx) { return; }
        if (!dust.on) { return; }
        var ctx = dust.ctx, i, m, x, y, tw;
        ctx.clearRect(0, 0, dust.w, dust.h);
        var ink = getComputedStyle(document.documentElement).getPropertyValue('--text-rgb').trim() || '51,51,51';
        for (i = 0; i < dust.motes.length; i++) {
            m = dust.motes[i];
            m.y -= m.v * (dt / 1000);
            if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
            tw = 0.6 + 0.4 * Math.sin(t / 900 + m.ph);
            x = (m.x * dust.w) | 0;
            y = (m.y * dust.h) | 0;
            ctx.globalAlpha = m.a * tw;
            ctx.fillStyle = 'rgb(' + ink + ')';
            ctx.fillRect(x, y, m.s * dust.dpr, m.s * dust.dpr);
        }
        ctx.globalAlpha = 1;
    }

    function dustStatic() {           // reduced motion: one quiet sprinkle
        if (!dust.ctx) { return; }
        drawDust(0, 0);
    }

    function watchCosmic() {
        var sync = function () {
            var cosmic = document.documentElement.getAttribute('data-palette') === 'cosmic';
            dust.on = !cosmic;
            if (cosmic && dust.ctx) { dust.ctx.clearRect(0, 0, dust.w, dust.h); }
        };
        sync();
        new MutationObserver(sync).observe(document.documentElement,
            { attributes: true, attributeFilter: ['data-palette'] });
    }

    /* ======================= the loop ======================= */

    function loop(now) {
        if (!t0) { t0 = now; prevT = now; }
        var dt = now - prevT;
        if (dt <= 0 || dt > 50) { dt = 16.7; }
        prevT = now;
        var k = dt / 16.7;

        if (glide) {
            targetWalk = clampWalk(targetWalk + glide * k);
            glide *= Math.pow(0.93, k);
            if (Math.abs(glide) < 0.05) { glide = 0; }
        }
        var kZ = targetWalk > FORK_AT ? 0.034 : 0.075;   // decelerate into the fork
        walk += (targetWalk - walk) * kZ * k;
        lean += (targetLean - lean) * 0.11 * k;
        if (Math.abs(targetWalk - walk) < 0.05) { walk = targetWalk; }

        applyWorld(now);
        updateFades();
        updateEra();
        updateRail();
        drawDust(now, dt);
        dismissHintIfWalking();
        raf = window.requestAnimationFrame(loop);
    }

    function applyOnce() {            // reduced motion: no loop, settle instantly
        walk = targetWalk = clampWalk(targetWalk);
        lean = targetLean;
        applyWorld(0);
        updateFades();
        updateEra();
        updateRail();
        dismissHintIfWalking();
    }

    function nudge(dz) {
        targetWalk = clampWalk(targetWalk + dz);
        if (reduced) { applyOnce(); }
    }

    /* ======================= input ======================= */

    // while the one-stroke puzzle or the settings panel is open, the modal owns
    // every input — the hall must not scroll behind it (and Escape belongs to it)
    function modalOpen() {
        return !!(window.NebulaPath && window.NebulaPath.isOpen && window.NebulaPath.isOpen()) ||
            !!document.querySelector('.theme-settings-panel:not([hidden])');
    }

    function onWheel(e) {
        if (modalOpen()) { return; }            // let the modal own the wheel
        e.preventDefault();
        glide = 0;
        nudge(e.deltaY * (e.deltaMode === 1 ? 18 : 1.25));
    }

    function onKey(e) {
        if (e.metaKey || e.ctrlKey || e.altKey) { return; }
        if (modalOpen()) { return; }            // arrows steer the puzzle, Esc closes it
        var el = document.activeElement;
        if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) { return; }
        switch (e.key) {
            case 'ArrowUp': case 'w': case 'W': case 'PageUp':
                e.preventDefault(); nudge(440); break;
            case 'ArrowDown': case 's': case 'S': case 'PageDown':
                e.preventDefault(); nudge(-440); break;
            case 'Home':
                e.preventDefault(); glide = 0; targetWalk = 0;
                if (reduced) { applyOnce(); }
                break;
            case 'End':
                e.preventDefault(); glide = 0; targetWalk = WALK_MAX;
                if (reduced) { applyOnce(); }
                break;
            case 'ArrowLeft':
                targetLean = -70; break;
            case 'ArrowRight':
                targetLean = 70; break;
            case 'Escape':
                var exit = document.querySelector('.museum-exit');
                if (exit) { exit.focus(); }
                break;
        }
    }

    function onKeyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            targetLean = 0;
            if (reduced) { applyOnce(); }
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
        if (modalOpen()) { return; }               // the settings panel doesn't cover the stage
        var dy = touch.lastY - e.clientY;          // swipe up = walk in
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

    function onExhibitFocus(e) {
        var z = parseFloat(e.currentTarget.style.getPropertyValue('--ex-z'));
        if (isNaN(z)) { return; }
        glide = 0;
        targetWalk = clampWalk(-z - DOCK_BACKOFF);
        if (reduced) { applyOnce(); }
    }

    function onExhibitKey(e) {
        if (e.key !== 'Enter' || e.target !== e.currentTarget) { return; }
        var go = e.currentTarget.querySelector('.plaque-read');
        if (go) { go.click(); }
    }

    // touch can't reach the tiny plaque link under the 3D hit surface — a real
    // tap (not a walk-drag) on a far piece docks to it, on a near piece visits it
    var tapDown = null;
    function onExhibitTapStart(e) {
        if (e.pointerType === 'mouse') { return; }
        tapDown = { x: e.clientX, y: e.clientY, t: e.timeStamp, el: e.currentTarget };
    }
    function onExhibitTapEnd(e) {
        if (!tapDown || tapDown.el !== e.currentTarget) { tapDown = null; return; }
        var dx = e.clientX - tapDown.x, dy = e.clientY - tapDown.y, dt = e.timeStamp - tapDown.t;
        tapDown = null;
        if (dx * dx + dy * dy > 144 || dt > 400) { return; }   // a drag, not a tap
        var art = e.currentTarget;
        var z = parseFloat(art.style.getPropertyValue('--ex-z'));
        if (!isNaN(z) && z + walk < -900) {                    // far away: walk to it
            glide = 0;
            targetWalk = clampWalk(-z - DOCK_BACKOFF);
            if (reduced) { applyOnce(); }
            return;
        }
        var go = art.querySelector('.plaque-read');
        if (go) { go.click(); }
    }

    /* ======================= hint + curtain ======================= */

    function dismissHintIfWalking() {
        if (hintDone || !hint) { return; }
        if (walk > 260) {
            hintDone = true;
            hint.classList.add('is-done');
        }
    }

    function liftCurtain() {
        if (!curtain) { return; }
        if (reduced) {
            curtain.hidden = true;
            return;
        }
        var lift = function () {
            if (curtain.classList.contains('is-lifting')) { return; }
            curtain.classList.add('is-lifting');
            window.setTimeout(function () { curtain.hidden = true; }, 760);
        };
        window.setTimeout(lift, 1400);
        curtain.addEventListener('click', lift);
        window.addEventListener('keydown', function once() {
            window.removeEventListener('keydown', once);
            lift();
        });
        window.addEventListener('wheel', function onceW() {
            window.removeEventListener('wheel', onceW);
            lift();
        }, { passive: true });
    }

    /* ======================= init ======================= */

    function init() {
        museum = document.getElementById('museum');
        if (!museum) { return; }
        stage = museum.querySelector('.stage');
        world = museum.querySelector('.world');
        eraEl = museum.querySelector('.museum-era');
        railFill = museum.querySelector('.museum-rail-fill');
        dustCanvas = museum.querySelector('.dust');
        curtain = museum.querySelector('.museum-curtain');
        hint = museum.querySelector('.museum-hint');

        document.body.classList.add('museum-on');
        museum.classList.add('js-on');

        buildWalls();
        buildFloor();
        buildEndcap();
        buildExhibits();
        buildFork();
        world.setAttribute('data-era', '0');
        eraEl.textContent = ERAS[0].label;

        // deep-link: /time/?at=6700 starts that far down the hall
        var at = parseFloat(new URLSearchParams(window.location.search).get('at'));
        if (!isNaN(at)) { walk = targetWalk = clampWalk(at); }

        window.addEventListener('wheel', onWheel, { passive: false });
        // capture phase: the modal-open check must run BEFORE a modal's own
        // Escape handler closes it, or the museum steals the restored focus
        window.addEventListener('keydown', onKey, { capture: true });
        window.addEventListener('keyup', onKeyUp);
        stage.addEventListener('pointerdown', onPointerDown);
        stage.addEventListener('pointermove', onPointerMove);
        stage.addEventListener('pointerup', onPointerUp);
        stage.addEventListener('pointercancel', onPointerUp);

        sizeHaze();
        window.addEventListener('resize', function () {
            sizeHaze();
            if (reduced) { applyOnce(); }
        });
        dustInit();
        watchCosmic();
        liftCurtain();

        if (reduced) {
            dustStatic();
            applyOnce();
        } else {
            raf = window.requestAnimationFrame(loop);
        }

        // tiny dev/test hook, same spirit as window.lnzhPalette
        window.lnzhTime = {
            goto: function (depth) {
                glide = 0;
                targetWalk = clampWalk(depth);
                if (reduced) { applyOnce(); }
            },
            depth: function () { return walk; }
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
