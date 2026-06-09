// Critter engine — little hand-drawn creatures placed around the page.
//
// Anchor types:
//   background — idles in a layer BEHIND the content (e.g. a cat in a corner)
//   edge       — perches on a target element's corner (e.g. a frog on a frame)
//   cursor     — follows the pointer
//
// Art is swappable per critter: one frame -> a CSS motion preset (bob/sway);
// many frames -> frame-by-frame animation. Define critters per page by setting
// window.CRITTERS (an array) BEFORE this script loads. Frame paths resolve
// relative to THIS script (assets/js/), so use '../critters/foo.svg' regardless
// of page depth.
//
// Restraint: respects prefers-reduced-motion and a calm toggle (?calm in the URL
// or press 'c'); caps the number of critters; transforms + rAF only.

(function () {
    const scriptUrl = document.currentScript ? document.currentScript.src : location.href;
    const resolve = (p) => new URL(p, scriptUrl).href;
    const MAX_CRITTERS = 6;

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
        const requested = Array.isArray(window.CRITTERS) ? window.CRITTERS : [];
        if (!requested.length) return;
        const config = requested.slice(0, MAX_CRITTERS);
        if (requested.length > config.length) {
            console.info(`[critters] capped at ${MAX_CRITTERS} (requested ${requested.length})`);
        }

        const back = makeLayer('critter-layer--back');
        const front = makeLayer('critter-layer--front');
        document.body.append(back, front);

        config.forEach((c) => spawn(c, c.anchor === 'background' ? back : front));

        const calmInit = /[?&]calm\b/.test(location.search) ||
            localStorage.getItem('crittersCalm') === 'true';
        setCalm(calmInit);
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return;
            const el = document.activeElement;
            if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) return;
            const next = !document.body.classList.contains('critters-calm');
            localStorage.setItem('crittersCalm', String(next));
            setCalm(next);
        });

        function makeLayer(cls) {
            const d = document.createElement('div');
            d.className = `critter-layer ${cls}`;
            d.setAttribute('aria-hidden', 'true');
            return d;
        }

        function setCalm(on) {
            document.body.classList.toggle('critters-calm', on);
        }

        function spawn(c, layer) {
            const el = document.createElement('div');
            el.className = `critter critter--${c.anchor}`;
            if (c.motion && c.anchor !== 'cursor') el.classList.add(`critter-motion--${c.motion}`);
            el.dataset.critter = c.id || '';
            const size = c.size || 64;
            el.style.width = size + 'px';
            el.style.height = (c.height || size) + 'px';

            const frames = (c.frames || []).map(resolve);
            const img = document.createElement('img');
            img.alt = '';
            img.decoding = 'async';
            if (frames.length) img.src = frames[0];
            el.append(img);
            layer.append(el);

            if (frames.length > 1) {
                let i = 0;
                const fps = c.fps || 4;
                setInterval(() => {
                    if (document.body.classList.contains('critters-calm')) return;
                    i = (i + 1) % frames.length;
                    img.src = frames[i];
                }, 1000 / fps);
            }

            if (c.anchor === 'background') {
                el.style.position = 'absolute';
                ['top', 'right', 'bottom', 'left'].forEach((k) => {
                    if (c.at && c.at[k] != null) el.style[k] = c.at[k];
                });
            } else if (c.anchor === 'edge') {
                el.style.position = 'fixed';
                const place = () => positionEdge(el, c);
                place();
                addEventListener('scroll', place, { passive: true });
                addEventListener('resize', place);
            } else if (c.anchor === 'cursor') {
                followCursor(el, c);
            }
        }

        function positionEdge(el, c) {
            const target = document.querySelector(c.target);
            if (!target) { el.style.display = 'none'; return; }
            el.style.display = '';
            const r = target.getBoundingClientRect();
            const w = el.offsetWidth, h = el.offsetHeight;
            const corner = c.corner || 'top-right';
            const x = corner.includes('right') ? r.right - w * 0.5 : r.left - w * 0.5;
            const y = corner.includes('bottom') ? r.bottom - h * 0.55 : r.top - h * 0.55;
            el.style.left = Math.round(x) + 'px';
            el.style.top = Math.round(y) + 'px';
        }

        function followCursor(el, c) {
            const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
            const fine = matchMedia('(pointer: fine)').matches;
            if (reduce || !fine) { el.style.display = 'none'; return; }
            el.style.position = 'fixed';
            el.style.left = '0';
            el.style.top = '0';
            let px = innerWidth / 2, py = innerHeight / 2, x = px, y = py, vis = false;
            addEventListener('pointermove', (e) => {
                if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
                px = e.clientX; py = e.clientY;
                if (!vis) { vis = true; el.classList.add('is-visible'); }
            }, { passive: true });
            (function tick() {
                x += (px - x) * 0.18;
                y += (py - y) * 0.18;
                el.style.transform = `translate3d(${x + 14}px, ${y + 18}px, 0)`;
                requestAnimationFrame(tick);
            })();
        }
    });
})();
