/*
 * nebula-path.js — the hidden "one-stroke" puzzle that unlocks nebula mode.
 *
 * Fill every square of a shape in a single unbroken path: start on the marked
 * cell, move to orthogonally-adjacent squares, never lift the pen, never recross.
 * Cover all squares → the figure ignites into a supernova and nebula mode unlocks.
 *
 * Self-contained + CSP-safe (external file, injected <style> only). The ONLY
 * contract it touches is document.documentElement[data-palette="cosmic"], which
 * nebula-glint.js / palettes.css key off — so it drops onto the supernova feature
 * whenever the look settles. Replayable: a pool of hand-verified boards (every one
 * proven to have a Hamiltonian path by tools/one-stroke offline search) + a "new"
 * button that cycles to another board at any time, won or not.
 *
 * API: NebulaPath.open() / .isUnlocked() / .applyNebula() / .clear()
 */
(function () {
    'use strict';

    var STORE_KEY = 'nebula-unlocked';
    var ROT_KEY = 'nebula-path-i';      // rotate the starting board across opens
    var SVGNS = 'http://www.w3.org/2000/svg';
    var CELL = 40;
    // cosmic supernova palette (mirrors the nova-iris in dev/theme-demo.html)
    var NOVA = {
        gas: ['#1c0838', '#290b48', '#43135e', '#5a1556', '#0a2238', '#0d2c4a', '#093846', '#145460'],
        space: '#06040f',
        flecks: ['#fff4d6', '#ffd9a0', '#ffe9b3', '#cfe8ff']
    };
    function shadeColor(hex, delta) {
        var h = hex.replace('#', '');
        if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
        var r = parseInt(h.substr(0, 2), 16) + delta, g = parseInt(h.substr(2, 2), 16) + delta, b = parseInt(h.substr(4, 2), 16) + delta;
        r = r < 0 ? 0 : r > 255 ? 255 : r; g = g < 0 ? 0 : g > 255 ? 255 : g; b = b < 0 ? 0 : b > 255 ? 255 : b;
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    /* Lazy-load the ambient nebula glint (the real supernova flares) the first
       time cosmic mode turns on — mirrors theme-toggle.js's own lazy-load. The
       glint self-gates on data-palette via its MutationObserver. */
    var scriptUrl = document.currentScript ? document.currentScript.src : window.location.href;
    var assetsRoot = new URL('./', scriptUrl).href;     // .../assets/js/
    var glintLoaded = false;
    function ensureGlint() {
        if (glintLoaded || window.__nebulaGlint || document.getElementById('nebula-glint-js')) { glintLoaded = true; return; }
        glintLoaded = true;
        var sc = document.createElement('script');
        sc.id = 'nebula-glint-js';
        sc.src = new URL('nebula-glint.js', assetsRoot).href;
        document.head.appendChild(sc);
    }

    /* ---- the pool: 30–39 cells, 1–4 solutions each. Every board verified
            solvable by an offline Hamiltonian solver (tools/one-stroke search);
            difficulty escalates and the last three are UNIQUE-solution (brutal).
            '.'=cell, '#'=wall (not part of the shape), 'S'=start. ---- */
    var BOARDS = [
        ['S.....', '......', '....#.', '..#..#', '......', '#.....'],                  // 32 cells, 2 sols
        ['S....#', '.#....', '...#..', '......', '#...#.', '#.....'],                  // 30, 2
        ['S....##', '.......', '#.....#', '#...#.#', '.......', '...#...'],            // 34, 4
        ['S......', '....##.', '##..##.', '#..#...', '...#..#', '.#.....', '...#...'], // 37, 3
        ['S..#....', '.......#', '....#..#', '#...#..#', '....#...', '...##...'],      // 38, 3
        ['S..##..', '.#.....', '.#..##.', '.#.....', '.......', '....#..'],            // 34, 2
        ['S###...', '.#....#', '.......', '##...#.', '.....#.', '.......', '##..#..'], // 37, 2
        ['S##....', '.......', '......#', '.##....', '.###.#.', '...#...'],            // 32, 1 (unique)
        ['S#..#...', '......#.', '....#...', '..#.#..#', '#....#..', '...#....'],      // 38, 1 (unique)
        ['S#...#.', '.#.#.#.', '.......', '....#..', '.......', '..#.#..', '..#...#']  // 39, 1 (unique, brutal)
    ];

    /* ---- parse a board into geometry ---- */
    function parseBoard(rows) {
        var h = rows.length, w = 0;
        for (var i = 0; i < h; i++) { if (rows[i].length > w) w = rows[i].length; }
        var cellAt = {};         // "r,c" -> id
        var cells = [];          // id -> {r,c}
        var start = 0;
        for (var r = 0; r < h; r++) {
            for (var c = 0; c < w; c++) {
                var ch = rows[r][c] || '#';
                if (ch === '#') { continue; }
                var id = cells.length; cellAt[r + ',' + c] = id; cells.push({ r: r, c: c });
                if (ch === 'S') { start = id; }
            }
        }
        function nb(id, dr, dc) { var s = cells[id]; var k = (s.r + dr) + ',' + (s.c + dc); return cellAt.hasOwnProperty(k) ? cellAt[k] : -1; }
        return { w: w, h: h, cells: cells, cellAt: cellAt, start: start, nb: nb, count: cells.length };
    }

    /* ---- persistence + the cosmic contract ---- */
    function isUnlocked() { try { return localStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; } }
    function persistUnlock() { try { localStorage.setItem(STORE_KEY, '1'); } catch (e) {} }
    function applyNebula() {
        // On real pages, go through theme-toggle's palette system (persists 'palette',
        // swaps PNGs, loads the glint, updates the gear). Standalone (demo) falls back.
        if (window.lnzhPalette && typeof window.lnzhPalette.set === 'function') {
            window.lnzhPalette.set('cosmic');
        } else {
            document.documentElement.setAttribute('data-palette', 'cosmic');
            ensureGlint();
        }
    }
    function clearNebula() { document.documentElement.removeAttribute('data-palette'); }

    function svg(tag, attrs) { var el = document.createElementNS(SVGNS, tag); if (attrs) { for (var k in attrs) { if (attrs.hasOwnProperty(k)) el.setAttribute(k, attrs[k]); } } return el; }

    function injectStyles() {
        if (document.getElementById('np-styles')) { return; }
        var s = document.createElement('style'); s.id = 'np-styles';
        s.textContent = [
            // anchored top-right by the game icon (like the settings panel), no dim
            '.np-backdrop{position:fixed;inset:0;z-index:2147483600;display:flex;',
            '  align-items:flex-start;justify-content:flex-end;padding:76px 16px 16px;}',
            '@media (max-width:600px){.np-backdrop{padding:62px 10px 10px;}}',
            // small + cute chunky-8bit panel, matching the settings panel
            '.np-panel{width:232px;max-width:calc(100vw - 32px);font-family:var(--mono,monospace);',
            '  background:var(--paper-raised,#fffdf4);color:var(--ink,#000);image-rendering:pixelated;',
            '  border:3px solid var(--line-strong,#000);box-shadow:4px 4px 0 0 var(--line-strong,#000);',
            '  transform-origin:top right;animation:np-pop .16s steps(3) both;}',
            '@keyframes np-pop{from{transform:scale(.5);opacity:.4}to{transform:scale(1);opacity:1}}',
            '.np-head{display:flex;align-items:center;justify-content:flex-end;padding:5px 6px 0;}',
            '.np-x{font-family:var(--mono,monospace);font-size:13px;line-height:1;width:20px;height:20px;padding:0;',
            '  display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink,#000);',
            '  background:var(--paper,#f2f2e4);border:2px solid var(--line-strong,#000);box-shadow:2px 2px 0 0 var(--line-strong,#000);}',
            '.np-x:hover{transform:translate(1px,1px);box-shadow:1px 1px 0 0 var(--line-strong,#000);}',
            // deep-space board window (dark in BOTH themes — it is space)
            '.np-sky{position:relative;margin:6px 8px;padding:7px;outline:none;border:2px solid var(--line-strong,#000);',
            '  background:radial-gradient(120% 100% at 50% 14%,#1a1430 0%,#0c0a1c 50%,#070611 100%);}',
            '.np-sky svg{display:block;margin:0 auto;max-width:100%;max-height:40vh;height:auto;touch-action:none;}',
            '.np-cell{fill:rgba(120,128,200,.10);stroke:rgba(150,158,230,.16);stroke-width:1;}',
            '.np-cell.np-on{fill:rgba(255,210,122,.20);stroke:rgba(255,210,122,.35);}',
            '.np-start{fill:none;stroke:#ffd27a;stroke-width:2;}',
            '.np-trail{fill:none;stroke:#ffd27a;stroke-width:' + (CELL * 0.30) + ';stroke-linecap:round;',
            '  stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(255,210,122,.55));}',
            '.np-tip{fill:#fff7e0;filter:drop-shadow(0 0 5px rgba(255,236,180,.9));}',
            '.np-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 8px 8px;}',
            // input hint (drag-with-mouse · arrow-keys) replaces a progress count
            '.np-hint{display:flex;align-items:center;gap:5px;font-family:var(--mono,monospace);font-size:9px;',
            '  letter-spacing:.04em;text-transform:lowercase;color:var(--muted,#777);}',
            '.np-hint svg{display:block;flex:0 0 auto;}',
            '.np-hint .np-or{opacity:.6;}',
            '.np-btns{display:flex;gap:5px;}',
            '.np-btn{font-family:var(--mono,monospace);font-size:10px;text-transform:lowercase;letter-spacing:.04em;',
            '  height:22px;padding:0 8px;cursor:pointer;color:var(--ink,#000);background:var(--paper,#f2f2e4);',
            '  border:2px solid var(--line-strong,#000);box-shadow:2px 2px 0 0 var(--line-strong,#000);}',
            '.np-btn:hover{transform:translate(1px,1px);box-shadow:1px 1px 0 0 var(--line-strong,#000);}',
            '.np-burst{position:fixed;inset:0;z-index:2147483646;pointer-events:none;}'
        ].join('');
        document.head.appendChild(s);
    }

    /* ---- live puzzle state ---- */
    var overlay = null, skyEl = null, svgEl = null, cellRects = {}, trail = null, tip = null;
    var board = null, path = [], onPath = {}, boardIndex = 0, solved = false;
    var progEl = null, keyHandler = null, lastFocus = null, dragging = false, lastCell = -1;

    function cx(id) { return board.cells[id].c * CELL + CELL / 2; }
    function cy(id) { return board.cells[id].r * CELL + CELL / 2; }
    function head() { return path[path.length - 1]; }

    function redraw() {
        // cell fills
        board.cells.forEach(function (_, id) {
            var rect = cellRects[id];
            if (onPath[id]) { rect.classList.add('np-on'); } else { rect.classList.remove('np-on'); }
        });
        // trail polyline
        var pts = path.map(function (id) { return cx(id) + ',' + cy(id); }).join(' ');
        trail.setAttribute('points', pts);
        // tip marker
        tip.setAttribute('cx', cx(head())); tip.setAttribute('cy', cy(head()));
    }

    function tryStep(id) {
        if (solved || id < 0 || id == null) { return; }
        if (path.length >= 2 && id === path[path.length - 2]) { // backtrack
            var last = path.pop(); delete onPath[last]; redraw(); return;
        }
        if (onPath[id]) { return; }
        // adjacent to head?
        var h = head(); var adj = false;
        for (var d = 0; d < 4; d++) { var n = neighborOf(h, d); if (n === id) { adj = true; break; } }
        if (!adj) { return; }
        path.push(id); onPath[id] = true; redraw();
        if (path.length === board.count) { solve(); }
    }
    var DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    function neighborOf(id, d) { return board.nb(id, DIRS[d][0], DIRS[d][1]); }

    function cellAtPoint(ev) {
        var rect = svgEl.getBoundingClientRect();
        var vx = (ev.clientX - rect.left) / rect.width * (board.w * CELL);
        var vy = (ev.clientY - rect.top) / rect.height * (board.h * CELL);
        var c = Math.floor(vx / CELL), r = Math.floor(vy / CELL);
        var k = r + ',' + c;
        return board.cellAt.hasOwnProperty(k) ? board.cellAt[k] : -1;
    }

    function reset() {
        path = [board.start]; onPath = {}; onPath[board.start] = true; solved = false;
        redraw();
    }
    function nextBoard() {
        boardIndex = (boardIndex + 1) % BOARDS.length;
        try { localStorage.setItem(ROT_KEY, String(boardIndex)); } catch (e) {}
        loadBoard(boardIndex);
    }

    function loadBoard(i) {
        board = parseBoard(BOARDS[i]);
        // (re)build the grid svg
        while (svgEl.firstChild) { svgEl.removeChild(svgEl.firstChild); }
        svgEl.setAttribute('viewBox', '0 0 ' + (board.w * CELL) + ' ' + (board.h * CELL));
        svgEl.setAttribute('width', board.w * CELL); svgEl.setAttribute('height', board.h * CELL);
        cellRects = {};
        var gridLayer = svg('g'); svgEl.appendChild(gridLayer);
        board.cells.forEach(function (cellObj, id) {
            var rect = svg('rect', { x: cellObj.c * CELL + 3, y: cellObj.r * CELL + 3, width: CELL - 6, height: CELL - 6, class: 'np-cell' });
            gridLayer.appendChild(rect); cellRects[id] = rect;
        });
        trail = svg('polyline', { class: 'np-trail', points: '' }); svgEl.appendChild(trail);
        // start ring + tip
        var s = board.cells[board.start];
        svgEl.appendChild(svg('rect', { x: s.c * CELL + 8, y: s.r * CELL + 8, width: CELL - 16, height: CELL - 16, class: 'np-start' }));
        tip = svg('circle', { r: CELL * 0.16, class: 'np-tip' }); svgEl.appendChild(tip);
        reset();
    }

    /* ---- ignition (shared with the cosmic look) ---- */
    function solve() {
        solved = true;
        persistUnlock();            // mark unlocked before teardown
        close();                    // close the puzzle panel, reveal the page
        playSupernova(applyNebula, function () {                          // flip to nebula under the cover
            document.dispatchEvent(new CustomEvent('nebula-unlocked'));   // morph the game icon on reveal
        });
    }

    /* ---- the REAL supernova — ported from the demo's nova-iris. A full-screen
            pixel grid of cosmic gas + star flecks ignites center→out, flips the page
            to nebula underneath (onFlip), then clears to reveal it (onDone). ---- */
    function playSupernova(onFlip, onDone) {
        var CELL = 18, wild = 1, bloom = 14, noise = 0.4;
        var ringDelay = 20, novaDur = 620, gasFill = 0.42, starPct = 0.045;
        var W = window.innerWidth, Hh = window.innerHeight;
        var cols = Math.ceil(W / CELL), rows = Math.ceil(Hh / CELL), total = cols * rows;
        var cellW = W / cols, cellH = Hh / rows, cx = (cols - 1) / 2, cy = (rows - 1) / 2;
        var grainMs = ringDelay * (0.6 + wild * 1.8);
        // noise-warped per-cell radius (angular tendrils + blobby corrosion)
        var HH = [], nH = 4 + Math.floor(Math.random() * 3), ampSum = 0;
        for (var k = 0; k < nH; k++) { var a = 0.4 + Math.random(); ampSum += a; HH.push({ f: 2 + Math.floor(Math.random() * 7), a: a, ph: Math.random() * 6.2832 }); }
        function tendril(th) { var s = 0; for (var t = 0; t < HH.length; t++) { s += HH[t].a * Math.sin(HH[t].f * th + HH[t].ph); } return s / ampSum; }
        var sA = Math.random() * 6.2832, sB = Math.random() * 6.2832, sC = Math.random() * 6.2832, bf = 0.16 + Math.random() * 0.18;
        function blob(c, r) { return (Math.sin(c * bf + sA) * Math.cos(r * bf + sB) + 0.6 * Math.sin((c + r) * bf * 0.7 + sC)) / 1.6; }
        var tAmp = wild * 5, bAmp = wild * 4, eff = new Float64Array(total), maxEff = 0, idx = 0;
        for (var r1 = 0; r1 < rows; r1++) { for (var c1 = 0; c1 < cols; c1++) { var dx = c1 - cx, dy = r1 - cy; var dd = Math.hypot(dx, dy) + tendril(Math.atan2(dy, dx)) * tAmp + blob(c1, r1) * bAmp; if (dd < 0) { dd = 0; } eff[idx++] = dd; if (dd > maxEff) { maxEff = dd; } } }
        var maxRing = Math.round(maxEff), delay = new Float64Array(total);
        for (var i = 0; i < total; i++) { var ring = Math.round(eff[i]); var dl = ring * ringDelay + Math.random() * grainMs; delay[i] = dl < 0 ? 0 : dl; }  // burst: ignite center→out
        var DUR = novaDur, endT = maxRing * ringDelay + grainMs + DUR + 80;
        var cellGlow = new Array(total), isFleck = new Uint8Array(total);
        for (var s2 = 0; s2 < total; s2++) { var bse = NOVA.gas[(Math.random() * NOVA.gas.length) | 0]; cellGlow[s2] = shadeColor(bse, ((Math.random() - 0.5) * 2 * noise * 120) | 0); isFleck[s2] = Math.random() < starPct ? 1 : 0; }
        var baseFill = NOVA.space;
        var canvas = document.createElement('canvas'); canvas.className = 'np-burst';
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * dpr; canvas.height = Hh * dpr;
        canvas.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;width:' + W + 'px;height:' + Hh + 'px;image-rendering:pixelated;';
        var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
        var cw = Math.ceil(cellW) + 1, ch = Math.ceil(cellH) + 1;
        function draw(t) {
            ctx.clearRect(0, 0, W, Hh);
            for (var i2 = 0; i2 < total; i2++) {
                var local = t - delay[i2];
                if (local >= DUR) { continue; }                              // cleared → page shows
                var x = ((i2 % cols) * cellW) | 0, y = (((i2 / cols) | 0) * cellH) | 0;
                if (local < 0) { ctx.globalAlpha = 1; ctx.fillStyle = baseFill; ctx.fillRect(x, y, cw, ch); continue; }
                var ph = local / DUR, cover = ph < 0.52 ? 1 : 1 - (ph - 0.52) / 0.48;
                var spike = (ph >= 0.10 && ph < 0.22) || (ph >= 0.34 && ph < 0.46);   // 2 flickers
                if (spike) {
                    var gc = cellGlow[i2];
                    ctx.globalCompositeOperation = 'screen';                  // gas, never white-out
                    ctx.globalAlpha = (0.10 + gasFill * 0.45) * cover; ctx.fillStyle = gc;
                    ctx.fillRect(x - bloom, y - bloom, cw + 2 * bloom, ch + 2 * bloom);
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = cover; ctx.fillStyle = gc; ctx.fillRect(x, y, cw, ch);
                } else { ctx.globalAlpha = cover; ctx.fillStyle = baseFill; ctx.fillRect(x, y, cw, ch); }
                if (isFleck[i2] && ph > 0.08 && ph < 0.72) {                  // bright star flecks
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = (0.5 + Math.random() * 0.5) * cover; ctx.fillStyle = NOVA.flecks[i2 & 3];
                    var q = (cw >> 1) || 2; ctx.fillRect(x + (q >> 1), y + (q >> 1), q, q);
                    ctx.globalCompositeOperation = 'source-over';
                }
            }
            ctx.globalAlpha = 1;
        }
        draw(0); document.body.appendChild(canvas);    // cover the page before the flip
        var finished = false;
        function finish() { if (finished) { return; } finished = true; if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); } if (onDone) { onDone(); } }
        requestAnimationFrame(function () {
            if (onFlip) { onFlip(); }                                        // restyle to nebula, hidden
            var t0 = null;
            function loop(now) { if (t0 === null) { t0 = now; } var t = now - t0; draw(t); if (t < endT) { requestAnimationFrame(loop); } else { finish(); } }
            requestAnimationFrame(loop);
        });
        window.setTimeout(function () { if (onFlip) { onFlip(); } finish(); }, endT + 1500);  // failsafe
    }

    /* ---- open / close ---- */
    function open() {
        if (overlay) { return; }
        injectStyles();
        lastFocus = document.activeElement;
        try { boardIndex = Math.max(0, parseInt(localStorage.getItem(ROT_KEY), 10) || 0) % BOARDS.length; } catch (e) { boardIndex = 0; }

        overlay = document.createElement('div'); overlay.className = 'np-backdrop';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'One-stroke puzzle — fill every square in one path to unlock nebula mode');

        var panel = document.createElement('div'); panel.className = 'np-panel';
        var headBar = document.createElement('div'); headBar.className = 'np-head';
        var x = document.createElement('button'); x.className = 'np-x'; x.type = 'button'; x.setAttribute('aria-label', 'Close puzzle'); x.textContent = '×'; x.addEventListener('click', close);
        headBar.appendChild(x);

        skyEl = document.createElement('div'); skyEl.className = 'np-sky'; skyEl.tabIndex = 0;
        skyEl.setAttribute('role', 'application');
        skyEl.setAttribute('aria-label', 'Puzzle grid. Drag from the start, or use arrow keys, to fill every square in one unbroken path.');
        svgEl = svg('svg', { preserveAspectRatio: 'xMidYMid meet' });
        skyEl.appendChild(svgEl);

        var foot = document.createElement('div'); foot.className = 'np-foot';
        // a quiet how-to-play hint, not a score: drag with the mouse, or use arrow keys
        progEl = document.createElement('span'); progEl.className = 'np-hint';
        progEl.setAttribute('aria-label', 'Drag across the grid, or use the arrow keys, to fill every square in one path.');
        progEl.title = 'Drag, or use the arrow keys';
        progEl.innerHTML =
            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
            '<rect x="7" y="2.5" width="10" height="19" rx="5"/><line x1="12" y1="6.5" x2="12" y2="10.5"/></svg>' +
            '<span class="np-or" aria-hidden="true">or</span>' +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true">' +
            '<path d="M12 3 L15.5 7.5 H8.5 Z"/><path d="M12 21 L8.5 16.5 H15.5 Z"/>' +
            '<path d="M3 12 L7.5 8.5 V15.5 Z"/><path d="M21 12 L16.5 15.5 V8.5 Z"/></svg>';
        var btns = document.createElement('div'); btns.className = 'np-btns';
        var resetBtn = document.createElement('button'); resetBtn.className = 'np-btn'; resetBtn.type = 'button'; resetBtn.textContent = 'reset'; resetBtn.addEventListener('click', reset);
        var newBtn = document.createElement('button'); newBtn.className = 'np-btn'; newBtn.type = 'button'; newBtn.textContent = 'new'; newBtn.addEventListener('click', nextBoard);
        btns.appendChild(resetBtn); btns.appendChild(newBtn);
        foot.appendChild(progEl); foot.appendChild(btns);

        panel.appendChild(headBar); panel.appendChild(skyEl); panel.appendChild(foot);
        overlay.appendChild(panel);
        overlay.addEventListener('pointerdown', function (ev) { if (ev.target === overlay) { close(); } });
        document.body.appendChild(overlay);

        // pointer drawing
        svgEl.addEventListener('pointerdown', function (ev) { ev.preventDefault(); dragging = true; lastCell = -1; handlePointer(ev); });
        svgEl.addEventListener('pointermove', function (ev) { if (dragging) { handlePointer(ev); } });
        window.addEventListener('pointerup', endDrag);
        // keyboard play (arrows move the head)
        skyEl.addEventListener('keydown', function (ev) {
            var d = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3 };
            if (ev.key in d) { ev.preventDefault(); tryStep(neighborOf(head(), d[ev.key])); }
        });
        keyHandler = function (ev) { if (ev.key === 'Escape') { close(); } };
        document.addEventListener('keydown', keyHandler);

        loadBoard(boardIndex);
        skyEl.focus();
    }

    function handlePointer(ev) { var c = cellAtPoint(ev); if (c !== lastCell) { lastCell = c; tryStep(c); } }
    function endDrag() { dragging = false; lastCell = -1; }

    function close() {
        if (!overlay) { return; }
        window.removeEventListener('pointerup', endDrag);
        document.removeEventListener('keydown', keyHandler);
        if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
        overlay = null; svgEl = null; skyEl = null;
        if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }

    window.NebulaPath = {
        open: open,
        isUnlocked: isUnlocked,
        applyNebula: applyNebula,
        // re-fire the real ignition on demand (e.g. toggling nebula back on from the gear)
        supernova: function (onFlip, onDone) { playSupernova(onFlip, onDone); },
        clear: function () { try { localStorage.removeItem(STORE_KEY); } catch (e) {} clearNebula(); }
    };
})();
