/*
 * theme-toggle.js — pixel-art light/dark toggle + iris close-in transition.
 *
 * Loaded like nav-dropdown.js (runs on DOMContentLoaded). External file to
 * satisfy the page CSP `script-src 'self'` (NO inline scripts anywhere).
 * Injected <style> is allowed because `style-src` includes 'unsafe-inline'.
 *
 * Responsibilities (see spec sections B/C/F):
 *   1. Inject a fixed top-right pixel/8-bit toggle <button> (accessible:
 *      real <button>, aria-label, aria-pressed, keyboard operable, focus ring).
 *   2. On activate: IRIS CLOSE-IN — a full-viewport <canvas> tiled with chunky
 *      blocks in the OUTGOING --paper color; flip data-theme underneath (page
 *      restyles instantly, hidden by the canvas); clear blocks from the edges
 *      inward along a noise-warped, tendrilled front (re-rolled each flip) so the
 *      old theme is eaten down to a ragged dot at center, with a thin flickering
 *      glow edge. Rendered on canvas (one fillRect/block) to hold 60fps even at
 *      small blocks. prefers-reduced-motion -> skip canvas, swap instantly.
 *   3. Persist choice to localStorage.theme; keep aria-pressed correct.
 *   4. Swap themed <img>: on init + on theme change, for every <img> whose
 *      resolved src ends with a manifest source path, swap to its -dark.png
 *      sibling in dark mode and back in light. Preload -dark variants once.
 */
(function () {
    'use strict';

    /* ---- resolve our own base URL (mirror nav-dropdown.js's pattern) ---- */
    // We live at assets/js/theme-toggle.js, so "../" climbs to the assets root.
    var scriptUrl = document.currentScript
        ? document.currentScript.src
        : window.location.href;
    var assetsRoot = new URL('../', scriptUrl).href; // .../assets/

    /* ---- recolor manifest: source paths (relative to repo) that have a
            -dark sibling. Mirrors tools/recolor_manifest.json. Listing the
            sources inline keeps this a CSP-safe static asset (no fetch). ---- */
    var MANIFEST_SOURCES = [
        'assets/clipart/americanoclip.png',
        'assets/clipart/espressoclip.png',
        'assets/clipart/existenceclip.png',
        'assets/clipart/gossipclip.png',
        'assets/clipart/identityclip.png',
        'assets/clipart/latteclip.png',
        'assets/clipart/otherworldlyclip.png',
        'assets/clipart/times-i-criedclip.png',
        'assets/clipart/tomatoclip.png',
        'assets/images/content/AI.png',
        'assets/images/content/about.png',
        'assets/images/content/americano.png',
        'assets/images/content/blog0.png',
        'assets/images/content/coffee.png',
        'assets/images/content/espresso.png',
        'assets/images/content/latte.png',
        'assets/images/content/list.png',
        'assets/images/content/lnzh.org.png',
        'assets/images/content/next.png',
        'assets/images/content/now.png',
        'assets/images/content/on-existence.png',
        'assets/images/content/on-gossip.png',
        'assets/images/content/on-identity.png',
        'assets/images/content/the-world-inside-my-head.png',
        'assets/images/content/thoughts.png',
        'assets/images/content/times-i-cried-with-you.png',
        'assets/images/content/tomato.png',
        'assets/images/content/upload.png',
        'assets/images/content/venmo.png',
        'assets/images/content/why_.png',
        'assets/images/content/zelle.png',
        'assets/images/icons/XD.png',
        'assets/images/icons/chess.png',
        'assets/images/icons/gmail.png',
        'assets/images/icons/instagram.png',
        'assets/images/icons/linkedin.png',
        'assets/images/icons/yelp.png',
        'assets/images/ui/3starbig.png',
        'assets/images/ui/4star.png',
        'assets/images/ui/arrow0.png',
        'assets/images/ui/arrow1.png',
        'assets/images/ui/arrow2.png',
        'assets/images/ui/hr.png'
    ];

    // Each manifest source begins with "assets/"; strip that prefix and
    // resolve against assetsRoot so the suffix-match works regardless of the
    // page's depth (root / about/ / blog/tomato/ all collapse to absolute URLs).
    var DARK_SUFFIX_TAIL = '-dark.png';
    // Build the set of recognized source suffixes (the portion after "assets/").
    var sourceTails = MANIFEST_SOURCES.map(function (p) {
        return p.replace(/^assets\//, '');         // e.g. "images/ui/hr.png"
    });

    function darkVariant(tail) {
        return tail.replace(/\.png$/i, DARK_SUFFIX_TAIL); // "images/ui/hr-dark.png"
    }

    /* ---- preload all -dark variants once (avoid flicker on first swap) ---- */
    var preloaded = false;
    function preloadDarkVariants() {
        if (preloaded) { return; }
        preloaded = true;
        sourceTails.forEach(function (tail) {
            var img = new Image();
            img.src = new URL(darkVariant(tail), assetsRoot).href;
        });
    }

    /* ---- theme state helpers ---- */
    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark'
            ? 'dark'
            : 'light';
    }

    function persist(theme) {
        try { localStorage.setItem('theme', theme); } catch (e) { /* ignore */ }
    }

    function prefersReducedMotion() {
        return !!(window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* ---- image swap: walk every <img>, match against manifest tails ---- */
    function swapImages(theme) {
        var imgs = document.querySelectorAll('img');
        for (var i = 0; i < imgs.length; i++) {
            var img = imgs[i];
            // Resolve the currently-rendered src to an absolute URL so we can
            // suffix-match it against assetsRoot-relative manifest tails.
            var resolved;
            try {
                resolved = new URL(img.getAttribute('src') || '', img.baseURI).href;
            } catch (e) {
                continue;
            }
            for (var j = 0; j < sourceTails.length; j++) {
                var tail = sourceTails[j];
                var lightUrl = new URL(tail, assetsRoot).href;
                var darkUrl = new URL(darkVariant(tail), assetsRoot).href;
                if (resolved === lightUrl && theme === 'dark') {
                    img.src = darkUrl;
                    break;
                }
                if (resolved === darkUrl && theme === 'light') {
                    img.src = lightUrl;
                    break;
                }
            }
        }
        // The 4-star dropdown toggle is a <span> painted via the --star-src
        // custom property (nav-dropdown.js replaces the <img> with it), so it is
        // not caught by the <img> walk above. Swap its --star-src the same way:
        // match the absolute URL inside url("...") against the manifest.
        var stars = document.querySelectorAll('.fourstar.nav-dropdown-toggle');
        for (var s = 0; s < stars.length; s++) {
            var el = stars[s];
            var raw = el.style.getPropertyValue('--star-src');   // url("...abs...")
            var m = raw && raw.match(/url\(\s*["']?([^"')]+)["']?\s*\)/);
            if (!m) { continue; }
            var cur;
            try { cur = new URL(m[1], document.baseURI).href; } catch (e) { continue; }
            for (var k = 0; k < sourceTails.length; k++) {
                var lUrl = new URL(sourceTails[k], assetsRoot).href;
                var dUrl = new URL(darkVariant(sourceTails[k]), assetsRoot).href;
                if (cur === lUrl && theme === 'dark') { el.style.setProperty('--star-src', 'url("' + dUrl + '")'); break; }
                if (cur === dUrl && theme === 'light') { el.style.setProperty('--star-src', 'url("' + lUrl + '")'); break; }
            }
        }
    }

    /* ---- inject button + panel styles (single <style> element) ---- */
    function injectStyles() {
        if (document.getElementById('theme-toggle-styles')) { return; }
        var style = document.createElement('style');
        style.id = 'theme-toggle-styles';
        style.textContent = [
            /* Chunky 8-bit toggle button, fixed top-right. */
            '.theme-toggle-btn{',
            '  position:fixed;top:16px;right:16px;z-index:2147483646;',
            '  width:52px;height:52px;padding:0;cursor:pointer;',
            '  font-family:monospace;font-size:22px;line-height:1;',
            '  color:var(--ink,#000);',
            '  background:var(--paper-raised,#fffdf4);',
            '  border:3px solid var(--line-strong,#000);',
            '  border-radius:0;',          /* hard pixel corners */
            '  image-rendering:pixelated;',
            /* stacked hard shadow = blocky 8-bit drop */
            '  box-shadow:4px 4px 0 0 var(--line-strong,#000);',
            '  display:flex;align-items:center;justify-content:center;',
            '  transition:transform .08s steps(2),box-shadow .08s steps(2);',
            '  -webkit-tap-highlight-color:transparent;',
            '}',
            '.theme-toggle-btn:hover{transform:translate(1px,1px);',
            '  box-shadow:3px 3px 0 0 var(--line-strong,#000);}',
            '.theme-toggle-btn:active{transform:translate(4px,4px);',
            '  box-shadow:0 0 0 0 var(--line-strong,#000);}',
            /* visible focus ring (keyboard) */
            '.theme-toggle-btn:focus-visible{',
            '  outline:3px solid var(--link,#119c36);outline-offset:3px;}',
            '.theme-toggle-btn .tt-icon{pointer-events:none;display:block;}',
            /* One-shot pulse to send the eye to the gear when the panel is
               opened from elsewhere on the page (e.g. the homepage link). */
            '@keyframes tt-pulse{',
            '  0%{transform:translate(0,0);}',
            '  30%{transform:translate(-2px,-2px) scale(1.06);}',
            '  60%{transform:translate(1px,1px) scale(0.98);}',
            '  100%{transform:translate(0,0);}',
            '}',
            '.theme-toggle-btn.tt-pulse{animation:tt-pulse .5s steps(4) 2;}',
            '@media (max-width:600px){',
            '  .theme-toggle-btn{width:44px;height:44px;font-size:18px;top:10px;right:10px;}',
            '}',

            /* Settings panel (opened by the gear) + accent swatches. */
            '.theme-settings-panel{',
            '  position:fixed;top:80px;right:16px;z-index:2147483646;',
            '  width:204px;padding:14px;font-family:monospace;',
            '  color:var(--ink,#000);background:var(--paper-raised,#fffdf4);',
            '  border:3px solid var(--line-strong,#000);',
            '  box-shadow:4px 4px 0 0 var(--line-strong,#000);',
            '}',
            '.theme-settings-panel[hidden]{display:none;}',
            '.theme-settings-panel .tt-section + .tt-section{margin-top:16px;}',
            '.theme-settings-panel .tt-label{',
            '  margin:0 0 8px;font-size:11px;letter-spacing:.08em;',
            '  text-transform:uppercase;color:var(--muted,#666);',
            '}',
            '.theme-theme-btn{',
            '  display:inline-flex;align-items:center;gap:8px;',
            '  font-family:monospace;font-size:13px;cursor:pointer;padding:6px 10px;',
            '  color:var(--ink,#000);background:var(--paper,#f2f2e4);',
            '  border:2px solid var(--line-strong,#000);',
            '  box-shadow:2px 2px 0 0 var(--line-strong,#000);',
            '}',
            '.theme-theme-btn:hover{transform:translate(1px,1px);',
            '  box-shadow:1px 1px 0 0 var(--line-strong,#000);}',
            '.theme-theme-btn:focus-visible{outline:3px solid var(--link,#119c36);outline-offset:2px;}',
            '.theme-accent-row{display:flex;gap:8px;flex-wrap:wrap;}',
            '.theme-swatch{',
            '  width:26px;height:26px;padding:0;cursor:pointer;border-radius:0;',
            '  border:2px solid var(--line-strong,#000);image-rendering:pixelated;',
            '  box-shadow:2px 2px 0 0 var(--line-strong,#000);',
            '}',
            '.theme-swatch:hover{transform:translate(1px,1px);',
            '  box-shadow:1px 1px 0 0 var(--line-strong,#000);}',
            '.theme-swatch[aria-pressed="true"]{outline:3px solid var(--ink,#000);outline-offset:2px;}',
            '.theme-swatch:focus-visible{outline:3px solid var(--link,#119c36);outline-offset:2px;}',

            /* The iris transition is a <canvas> created + styled inline in
               irisCloseIn (no CSS needed here). Reduced motion: skip the canvas
               entirely (handled in applyTheme) AND kill the page-level
               color/background cross-fade so the swap is truly instant (root
               cause lives in style.css body transitions). */
            '@media (prefers-reduced-motion: reduce){',
            '  .theme-toggle-btn{transition:none;}',
            '  .theme-toggle-btn.tt-pulse{animation:none;}',
            '  html,body{transition:none !important;}',
            '  *{transition-duration:0.01ms !important;transition-delay:0ms !important;}',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    /* ---- the iris close-in transition (canvas-rendered) ----
       Chunky blocks on a single <canvas>, cleared from the edges inward along a
       noise-warped, tendrilled front so the OLD theme is eaten down to a ragged
       dot at center, with a thin flickering glow edge. One fillRect per block per
       frame holds 60fps even at small blocks (a DOM grid of thousands of
       box-shadow cells does not — that was the old jank). onMidpoint flips the
       theme while the canvas fully covers the page; onDone fires when finished. */
    var IRIS_WILD_COLORS = ['#3fd06a', '#5a92a3', '#d29a52', '#c26c68', '#9a7eac',
                            '#bbae4a', '#9bff2e', '#ff2424'];
    function pickIrisGlow(outgoingInk) {
        // ~80% a sharp INK flash; ~20% a random vivid color (spread evenly).
        return Math.random() < 0.8
            ? outgoingInk
            : IRIS_WILD_COLORS[Math.floor(Math.random() * IRIS_WILD_COLORS.length)];
    }
    function irisCloseIn(outgoingPaper, outgoingInk, onMidpoint, onDone) {
        var CELL = 18, RING_DELAY = 12, BLOOM = 36, DUR = 320;   // locked-in feel
        var W = window.innerWidth, Hh = window.innerHeight;
        var cols = Math.ceil(W / CELL), rows = Math.ceil(Hh / CELL);
        var total = cols * rows;
        var cellW = W / cols, cellH = Hh / rows;
        var cx = (cols - 1) / 2, cy = (rows - 1) / 2;
        var grainMs = RING_DELAY * 2.4;            // crumble jitter (wildness = 100%)
        var glow = pickIrisGlow(outgoingInk);

        // ---- per-flip noise field: angular tendrils + blobby corrosion, so the
        //      front is ragged and different every time (the "parasite"). ----
        var H = [], nH = 4 + Math.floor(Math.random() * 3), ampSum = 0;
        for (var hi = 0; hi < nH; hi++) {
            var amp = 0.4 + Math.random();
            ampSum += amp;
            H.push({ f: 2 + Math.floor(Math.random() * 7), a: amp, ph: Math.random() * 6.2832 });
        }
        function tendril(theta) {                  // angular fingers -> ~[-1,1]
            var s = 0;
            for (var t = 0; t < H.length; t++) { s += H[t].a * Math.sin(H[t].f * theta + H[t].ph); }
            return s / ampSum;
        }
        var sA = Math.random() * 6.2832, sB = Math.random() * 6.2832,
            sC = Math.random() * 6.2832, bf = 0.16 + Math.random() * 0.18;
        function blob(c, r) {                      // low-freq blotches -> ~[-1,1]
            return (Math.sin(c * bf + sA) * Math.cos(r * bf + sB)
                    + 0.6 * Math.sin((c + r) * bf * 0.7 + sC)) / 1.6;
        }

        // Pass 1: noise-warped radius per cell + the outer ring.
        var eff = new Float64Array(total), maxEff = 0, idx = 0;
        for (var r1 = 0; r1 < rows; r1++) {
            for (var c1 = 0; c1 < cols; c1++) {
                var dx = c1 - cx, dy = r1 - cy;
                var d = Math.hypot(dx, dy) + tendril(Math.atan2(dy, dx)) * 5 + blob(c1, r1) * 4;
                if (d < 0) { d = 0; }
                eff[idx++] = d;
                if (d > maxEff) { maxEff = d; }
            }
        }
        var maxRing = Math.round(maxEff);

        // Pass 2: per-cell delay — outer ring fires first + grain jitter so the
        // trailing old theme crumbles inward rather than wiping cleanly.
        var delay = new Float64Array(total);
        for (var i = 0; i < total; i++) {
            var dl = (maxRing - Math.round(eff[i])) * RING_DELAY + Math.random() * grainMs;
            delay[i] = dl < 0 ? 0 : dl;
        }

        var canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = Hh;
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:fixed;inset:0;z-index:2147483647;'
            + 'pointer-events:none;width:100vw;height:100vh;image-rendering:pixelated;';
        var ctx = canvas.getContext('2d');
        var cw = Math.ceil(cellW) + 1, ch = Math.ceil(cellH) + 1;

        function draw(t) {
            ctx.clearRect(0, 0, W, Hh);
            for (var j = 0; j < total; j++) {
                var local = t - delay[j];
                if (local >= DUR) { continue; }                 // cleared -> page shows
                var x = ((j % cols) * cellW) | 0, y = (((j / cols) | 0) * cellH) | 0;
                if (local < 0) {                                // not started -> covered
                    ctx.globalAlpha = 1; ctx.fillStyle = outgoingPaper; ctx.fillRect(x, y, cw, ch);
                    continue;
                }
                var ph = local / DUR;
                var cover = ph < 0.52 ? 1 : 1 - (ph - 0.52) / 0.48;  // fade old away
                var spike = (ph >= 0.10 && ph < 0.22) || (ph >= 0.34 && ph < 0.46); // 2 flickers
                if (spike) {
                    ctx.globalAlpha = 0.28 * cover; ctx.fillStyle = glow;   // chunky halo (no blur)
                    ctx.fillRect(x - BLOOM, y - BLOOM, cw + 2 * BLOOM, ch + 2 * BLOOM);
                    ctx.globalAlpha = cover; ctx.fillStyle = glow; ctx.fillRect(x, y, cw, ch);
                } else {
                    ctx.globalAlpha = cover; ctx.fillStyle = outgoingPaper; ctx.fillRect(x, y, cw, ch);
                }
            }
            ctx.globalAlpha = 1;
        }

        draw(0);                          // cover the page before the flip
        document.body.appendChild(canvas);
        if (typeof onMidpoint === 'function') { onMidpoint(); }   // restyle, hidden

        var endT = maxRing * RING_DELAY + grainMs + DUR + 80;
        var finished = false;
        function finish() {                 // idempotent cleanup
            if (finished) { return; }
            finished = true;
            if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); }
            if (typeof onDone === 'function') { onDone(); }
        }
        var t0 = null;
        function loop(now) {
            if (t0 === null) { t0 = now; }
            var t = now - t0;
            draw(t);
            if (t < endT) { requestAnimationFrame(loop); } else { finish(); }
        }
        requestAnimationFrame(loop);
        // Failsafe: if rAF stalls (e.g. tab backgrounded mid-flip), never leave
        // the canvas up or `animating` stuck — force cleanup on a wall clock.
        window.setTimeout(finish, endT + 1500);
    }

    /* ---- apply a theme (with or without animation) ---- */
    var animating = false;
    function applyTheme(next, animate) {
        if (animating) { return; }

        if (!animate || prefersReducedMotion()) {
            document.documentElement.setAttribute('data-theme', next);
            persist(next);
            swapImages(next);
            updateThemeControl(next);
            return;
        }

        // Capture the OUTGOING colors before flipping (the leading edge belongs
        // to the old screen): paper tiles the canvas, ink is the common glow.
        var cs = getComputedStyle(document.documentElement);
        var outgoingPaper = cs.getPropertyValue('--paper').trim() || '#f2f2e4';
        var outgoingInk = cs.getPropertyValue('--ink').trim() || '#000';

        function applySwap() {
            document.documentElement.setAttribute('data-theme', next);
            persist(next);
            swapImages(next);
            updateThemeControl(next);
        }

        animating = true;
        // Guard against any synchronous throw inside irisCloseIn (e.g. canvas/
        // 2D-context unavailable) BEFORE its rAF + failsafe are scheduled — that
        // would otherwise leave `animating` stuck true and wedge the toggle. On
        // failure, fall back to an instant swap and release the guard.
        try {
            irisCloseIn(outgoingPaper, outgoingInk, applySwap, function done() {
                animating = false;   // clears exactly when the animation ends
            });
        } catch (e) {
            applySwap();
            animating = false;
        }
    }

    /* ---- accent state ---- */
    var ACCENTS = ['green', 'teal', 'amber', 'coral', 'violet', 'olive'];
    // Swatch dot = each accent's brighter (dark-theme) link value, which reads
    // on both the light and dark panel backgrounds.
    var ACCENT_DOT = {
        green: '#3fd06a', teal: '#5a92a3', amber: '#d29a52',
        coral: '#c26c68', violet: '#9a7eac', olive: '#bbae4a'
    };

    function currentAccent() {
        var a = document.documentElement.getAttribute('data-accent');
        return ACCENTS.indexOf(a) >= 0 ? a : 'green';
    }
    function applyAccent(accent) {
        if (accent === 'green') {
            document.documentElement.removeAttribute('data-accent'); // green = :root default
        } else {
            document.documentElement.setAttribute('data-accent', accent);
        }
        try { localStorage.setItem('accent', accent); } catch (e) { /* ignore */ }
        updateSwatches(accent);
    }

    /* ---- UI elements ---- */
    var gear, panel, themeBtn, swatches = [];

    function themeIcon(theme) { return theme === 'dark' ? '☀' : '☽'; }
    function updateThemeControl(theme) {
        if (!themeBtn) { return; }
        var isDark = theme === 'dark';
        var lbl = isDark ? 'Switch to light theme' : 'Switch to dark theme';
        themeBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        themeBtn.setAttribute('aria-label', lbl);
        themeBtn.title = lbl;
        var ic = themeBtn.querySelector('.tt-icon');
        if (ic) { ic.textContent = themeIcon(theme); }
        var tx = themeBtn.querySelector('.tt-text');
        if (tx) { tx.textContent = isDark ? 'Dark' : 'Light'; }
    }
    function updateSwatches(accent) {
        for (var i = 0; i < swatches.length; i++) {
            swatches[i].setAttribute('aria-pressed',
                swatches[i].getAttribute('data-accent') === accent ? 'true' : 'false');
        }
    }

    /* ---- panel open/close + accessibility ---- */
    var panelOpen = false;
    function onDocKey(e) { if (e.key === 'Escape') { closePanel(); } }
    function onDocClick(e) {
        if (panel && !panel.contains(e.target) && gear && !gear.contains(e.target)) {
            closePanel();
        }
    }
    function openPanel() {
        if (panelOpen) { return; }
        panelOpen = true;
        panel.hidden = false;
        gear.setAttribute('aria-expanded', 'true');
        if (themeBtn) { themeBtn.focus(); }
        document.addEventListener('keydown', onDocKey);
        // Defer so the click that opened the panel doesn't immediately close it.
        window.setTimeout(function () {
            document.addEventListener('click', onDocClick);
        }, 0);
    }
    function closePanel() {
        if (!panelOpen) { return; }
        panelOpen = false;
        panel.hidden = true;
        gear.setAttribute('aria-expanded', 'false');
        document.removeEventListener('keydown', onDocKey);
        document.removeEventListener('click', onDocClick);
        if (gear) { gear.focus(); }
    }

    /* ---- build the gear button + settings panel ---- */
    function buildUI() {
        gear = document.createElement('button');
        gear.type = 'button';
        gear.className = 'theme-toggle-btn';
        gear.setAttribute('aria-label', 'Appearance settings');
        gear.setAttribute('aria-haspopup', 'true');
        gear.setAttribute('aria-expanded', 'false');
        var gi = document.createElement('span');
        gi.className = 'tt-icon';
        gi.setAttribute('aria-hidden', 'true');
        gi.textContent = '⚙';
        gear.appendChild(gi);
        gear.addEventListener('click', function () {
            if (panelOpen) { closePanel(); } else { openPanel(); }
        });

        panel = document.createElement('div');
        panel.className = 'theme-settings-panel';
        panel.setAttribute('role', 'group');
        panel.setAttribute('aria-label', 'Appearance settings');
        panel.hidden = true;

        // Theme section
        var themeSec = document.createElement('div');
        themeSec.className = 'tt-section';
        var themeLbl = document.createElement('p');
        themeLbl.className = 'tt-label';
        themeLbl.textContent = 'Theme';
        themeBtn = document.createElement('button');
        themeBtn.type = 'button';
        themeBtn.className = 'theme-theme-btn';
        var tIcon = document.createElement('span');
        tIcon.className = 'tt-icon';
        tIcon.setAttribute('aria-hidden', 'true');
        var tText = document.createElement('span');
        tText.className = 'tt-text';
        themeBtn.appendChild(tIcon);
        themeBtn.appendChild(tText);
        themeBtn.addEventListener('click', function () {
            var next = currentTheme() === 'dark' ? 'light' : 'dark';
            applyTheme(next, true);
        });
        themeSec.appendChild(themeLbl);
        themeSec.appendChild(themeBtn);

        // Accent section
        var accentSec = document.createElement('div');
        accentSec.className = 'tt-section';
        var accentLbl = document.createElement('p');
        accentLbl.className = 'tt-label';
        accentLbl.textContent = 'Accent';
        var row = document.createElement('div');
        row.className = 'theme-accent-row';
        swatches = [];
        ACCENTS.forEach(function (name) {
            var label = name.charAt(0).toUpperCase() + name.slice(1);
            var sw = document.createElement('button');
            sw.type = 'button';
            sw.className = 'theme-swatch';
            sw.setAttribute('data-accent', name);
            sw.style.backgroundColor = ACCENT_DOT[name];
            sw.setAttribute('aria-label', label + ' accent');
            sw.setAttribute('aria-pressed', 'false');
            sw.title = label;
            sw.addEventListener('click', function () { applyAccent(name); });
            row.appendChild(sw);
            swatches.push(sw);
        });
        accentSec.appendChild(accentLbl);
        accentSec.appendChild(row);

        panel.appendChild(themeSec);
        panel.appendChild(accentSec);
        document.body.appendChild(gear);
        document.body.appendChild(panel);

        updateThemeControl(currentTheme());
        updateSwatches(currentAccent());
    }

    /* ---- in-content trigger (homepage "customize your experience" link) ---- */
    function wireSettingsLink() {
        var link = document.getElementById('open-settings');
        if (!link) { return; }
        link.addEventListener('click', function (e) {
            e.preventDefault();
            if (panelOpen) { closePanel(); return; }
            openPanel();
            // The panel appears at the gear (top-right), away from the link —
            // pulse the gear once so the eye follows. Reduced-motion: no-op.
            if (!gear) { return; }
            gear.classList.remove('tt-pulse');
            // Force reflow so re-adding the class restarts the animation.
            void gear.offsetWidth;
            gear.classList.add('tt-pulse');
            gear.addEventListener('animationend', function handler() {
                gear.classList.remove('tt-pulse');
                gear.removeEventListener('animationend', handler);
            });
        });
    }

    /* ---- init ---- */
    function init() {
        injectStyles();
        buildUI();
        wireSettingsLink();
        preloadDarkVariants();
        // Ensure images match the theme already set by theme-init.js.
        swapImages(currentTheme());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
