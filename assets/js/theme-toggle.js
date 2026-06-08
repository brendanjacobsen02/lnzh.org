/*
 * theme-toggle.js — pixel-art light/dark toggle + pixel-dissolve transition.
 *
 * Loaded like nav-dropdown.js (runs on DOMContentLoaded). External file to
 * satisfy the page CSP `script-src 'self'` (NO inline scripts anywhere).
 * Injected <style> is allowed because `style-src` includes 'unsafe-inline'.
 *
 * Responsibilities (see spec sections B/C/F):
 *   1. Inject a fixed top-right pixel/8-bit toggle <button> (accessible:
 *      real <button>, aria-label, aria-pressed, keyboard operable, focus ring).
 *   2. On activate: PIXEL-DISSOLVE — full-viewport overlay grid of ~24px cells
 *      filled with the OUTGOING --paper color; flip data-theme underneath (page
 *      restyles instantly, hidden by overlay); clear cells in randomized checker
 *      order with staggered delays totaling ~500ms; remove overlay when done.
 *      prefers-reduced-motion -> skip overlay, swap instantly.
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
    }

    /* ---- inject button + dissolve styles (single <style> element) ---- */
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
            '@media (max-width:600px){',
            '  .theme-toggle-btn{width:44px;height:44px;font-size:18px;top:10px;right:10px;}',
            '}',

            /* Full-viewport pixel-dissolve overlay grid. */
            '.theme-dissolve-overlay{',
            '  position:fixed;inset:0;z-index:2147483647;',
            '  display:grid;pointer-events:none;',
            '  image-rendering:pixelated;',
            '}',
            '.theme-dissolve-cell{',
            '  width:100%;height:100%;opacity:1;',
            '  transition:opacity 1s cubic-bezier(0.1,1,0.3,1);',
            '}',
            '.theme-dissolve-cell.is-clear{opacity:0;}',
            /* reduced motion: never animate (overlay is skipped anyway) AND
               kill the page-level color/background cross-fade so the swap is
               truly instant (root cause lives in style.css body transitions). */
            '@media (prefers-reduced-motion: reduce){',
            '  .theme-toggle-btn{transition:none;}',
            '  .theme-dissolve-cell{transition:none;}',
            '  html,body{transition:none !important;}',
            '  *{transition-duration:0.01ms !important;transition-delay:0ms !important;}',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    /* ---- the pixel-dissolve transition ---- */
    function pixelDissolve(outgoingPaper, onMidpoint) {
        var CELL = 56;                       // chunky blocks (24px read as too-fine static)
        var cols = Math.ceil(window.innerWidth / CELL);
        var rows = Math.ceil(window.innerHeight / CELL);
        var total = cols * rows;

        var overlay = document.createElement('div');
        overlay.className = 'theme-dissolve-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
        overlay.style.gridTemplateRows = 'repeat(' + rows + ', 1fr)';
        // NB: the overlay container MUST stay transparent. The cells carry the
        // outgoing color and fully tile the viewport (1fr tracks, no gap), so
        // they alone hide the page. Giving the container its own background
        // would sit BEHIND the cells, so cleared cells would expose that
        // background (same outgoing color) instead of the re-themed page — the
        // dissolve would be invisible and end in a hard cut. Do not re-add.

        var cells = new Array(total);
        for (var i = 0; i < total; i++) {
            var cell = document.createElement('div');
            cell.className = 'theme-dissolve-cell';
            cell.style.backgroundColor = outgoingPaper;
            overlay.appendChild(cell);
            cells[i] = cell;
        }
        document.body.appendChild(overlay);

        // Flip the theme underneath while the overlay fully hides the page.
        if (typeof onMidpoint === 'function') { onMidpoint(); }

        // Randomized checker order: build an index list, shuffle, then assign
        // staggered delays so blocks clear in a scattered 8-bit pattern.
        var order = [];
        for (var k = 0; k < total; k++) { order.push(k); }
        for (var s = order.length - 1; s > 0; s--) {
            var r = Math.floor(Math.random() * (s + 1));
            var tmp = order[s]; order[s] = order[r]; order[r] = tmp;
        }

        var STAGGER_TOTAL = 900; // ms of staggered starts; per-cell ease-out lingers
        // Force layout so the initial opaque state is committed before we clear.
        // eslint-disable-next-line no-unused-expressions
        overlay.offsetHeight;

        requestAnimationFrame(function () {
            for (var n = 0; n < order.length; n++) {
                var idx = order[n];
                var delay = total > 1
                    ? (n / (total - 1)) * STAGGER_TOTAL
                    : 0;
                cells[idx].style.transitionDelay = delay + 'ms';
                cells[idx].classList.add('is-clear');
            }
        });

        var cleanupAfter = STAGGER_TOTAL + 1100; // last start + 1s fade tail + buffer
        window.setTimeout(function () {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, cleanupAfter);
    }

    /* ---- apply a theme (with or without animation) ---- */
    var animating = false;
    function applyTheme(next, animate) {
        if (animating) { return; }

        if (!animate || prefersReducedMotion()) {
            document.documentElement.setAttribute('data-theme', next);
            persist(next);
            swapImages(next);
            updateButton(next);
            return;
        }

        // Capture the OUTGOING paper color before flipping.
        var outgoingPaper = getComputedStyle(document.documentElement)
            .getPropertyValue('--paper').trim() || '#f2f2e4';

        animating = true;
        pixelDissolve(outgoingPaper, function midpoint() {
            document.documentElement.setAttribute('data-theme', next);
            persist(next);
            swapImages(next);
            updateButton(next);
        });
        window.setTimeout(function () { animating = false; }, 2100);
    }

    /* ---- the toggle button ---- */
    var button;
    function iconFor(theme) {
        // Show the action's target: moon when currently light (go dark),
        // sun when currently dark (go light).
        return theme === 'dark' ? '☀' : '☽'; // ☀ / ☽
    }
    function updateButton(theme) {
        if (!button) { return; }
        var isDark = theme === 'dark';
        button.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        button.setAttribute(
            'aria-label',
            isDark ? 'Switch to light theme' : 'Switch to dark theme'
        );
        button.title = isDark ? 'Switch to light theme' : 'Switch to dark theme';
        var icon = button.querySelector('.tt-icon');
        if (icon) { icon.textContent = iconFor(theme); }
    }

    function buildButton() {
        button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-toggle-btn';
        var icon = document.createElement('span');
        icon.className = 'tt-icon';
        icon.setAttribute('aria-hidden', 'true');
        button.appendChild(icon);

        button.addEventListener('click', function () {
            var next = currentTheme() === 'dark' ? 'light' : 'dark';
            applyTheme(next, true);
        });

        document.body.appendChild(button);
        updateButton(currentTheme());
    }

    /* ---- init ---- */
    function init() {
        injectStyles();
        buildButton();
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
