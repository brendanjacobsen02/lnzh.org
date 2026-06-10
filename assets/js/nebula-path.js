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
    var FLARE = ['#ffe8b0', '#ffd27a', '#7a1d6b', '#5a1a7a', '#123a63', '#0e4d5c'];

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
            '.np-backdrop{position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;',
            '  justify-content:center;padding:20px;background:rgba(8,6,16,.62);',
            '  backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:np-fade .22s ease both;}',
            '@keyframes np-fade{from{opacity:0}to{opacity:1}}',
            '.np-panel{width:min(92vw,392px);background:var(--paper-raised,#fffdf4);',
            '  border:1px solid rgba(var(--text-rgb,20,20,20),.18);',
            '  box-shadow:0 14px 50px rgba(var(--shadow-rgb,0,0,0),.30);',
            '  animation:np-rise .26s cubic-bezier(.2,.9,.3,1.1) both;}',
            '@keyframes np-rise{from{transform:translateY(8px) scale(.985);opacity:0}to{transform:none;opacity:1}}',
            '.np-head{display:flex;align-items:center;justify-content:flex-end;',
            '  padding:.62rem .8rem;border-bottom:1px solid rgba(var(--text-rgb,20,20,20),.12);}',
            '.np-eyebrow{font-family:var(--mono,monospace);font-size:.58rem;text-transform:uppercase;',
            '  letter-spacing:.14em;color:var(--muted,#777);}',
            '.np-x{font-family:var(--mono,monospace);font-size:.85rem;line-height:1;width:1.7rem;height:1.7rem;',
            '  display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;',
            '  border:1px solid rgba(var(--text-rgb,20,20,20),.2);background:var(--paper-raised,#fffdf4);color:var(--text,#333);}',
            '.np-x:hover{border-color:rgba(var(--text-rgb,20,20,20),.5);color:var(--ink,#000);}',
            // the deep-space board window (dark in BOTH themes — it is space)
            '.np-sky{position:relative;padding:18px;background:radial-gradient(120% 100% at 50% 14%,#1a1430 0%,#0c0a1c 50%,#070611 100%);outline:none;}',
            '.np-sky svg{display:block;margin:0 auto;max-width:100%;max-height:54vh;height:auto;touch-action:none;}',
            '.np-cell{fill:rgba(120,128,200,.10);stroke:rgba(150,158,230,.16);stroke-width:1;}',
            '.np-cell.np-on{fill:rgba(255,210,122,.20);stroke:rgba(255,210,122,.35);}',
            '.np-start{fill:none;stroke:#ffd27a;stroke-width:2;}',
            '.np-trail{fill:none;stroke:#ffd27a;stroke-width:' + (CELL * 0.30) + ';stroke-linecap:round;',
            '  stroke-linejoin:round;filter:drop-shadow(0 0 5px rgba(255,210,122,.55));}',
            '.np-tip{fill:#fff7e0;filter:drop-shadow(0 0 5px rgba(255,236,180,.9));}',
            '.np-foot{display:flex;align-items:center;justify-content:space-between;gap:.5rem;',
            '  padding:.55rem .8rem;border-top:1px solid rgba(var(--text-rgb,20,20,20),.12);}',
            '.np-prog{font-family:var(--mono,monospace);font-size:.58rem;letter-spacing:.05em;color:var(--faint,#999);}',
            '.np-prog.np-win{color:#caa24a;}',
            '.np-btns{display:flex;gap:.4rem;}',
            '.np-btn{font-family:var(--mono,monospace);font-size:.62rem;text-transform:lowercase;letter-spacing:.05em;',
            '  height:1.8rem;padding:0 .7rem;cursor:pointer;border:1px solid rgba(var(--text-rgb,20,20,20),.2);',
            '  background:var(--paper-raised,#fffdf4);color:var(--text,#333);}',
            '.np-btn:hover{border-color:rgba(var(--text-rgb,20,20,20),.5);color:var(--ink,#000);}',
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
        // progress
        if (!solved) {
            progEl.classList.remove('np-win');
            progEl.textContent = 'filled ' + path.length + ' / ' + board.count;
        }
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
        if (progEl) { progEl.classList.remove('np-win'); }
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
        persistUnlock();                                  // mark unlocked before teardown
        var box = skyEl.getBoundingClientRect();
        var ox = box.left + box.width / 2, oy = box.top + box.height / 2;
        close();                                          // close the puzzle, reveal the page
        igniteBurst(ox, oy, function () {                 // supernova plays over the page
            applyNebula();                                // cosmic palette on
            document.dispatchEvent(new CustomEvent('nebula-unlocked'));  // morphs the game icon
        });
    }

    function igniteBurst(ox, oy, done) {
        var canvas = document.createElement('canvas'); canvas.className = 'np-burst';
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var W = window.innerWidth, H = window.innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        document.body.appendChild(canvas);
        var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
        var maxR = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy)) + 40;
        var motes = [];
        for (var i = 0; i < 90; i++) { motes.push({ a: (i / 90) * Math.PI * 2 + (i % 7) * 0.13, sp: 0.55 + ((i * 37) % 100) / 100 * 0.7, col: FLARE[i % FLARE.length], sz: 2 + (i % 4) }); }
        var DUR = 900, t0 = null;
        function frame(now) {
            if (t0 === null) { t0 = now; }
            var t = (now - t0) / DUR; if (t > 1) { t = 1; }
            ctx.clearRect(0, 0, W, H);
            var ease = 1 - Math.pow(1 - t, 3), r = ease * maxR;
            var g = ctx.createRadialGradient(ox, oy, 0, ox, oy, Math.max(r, 1));
            g.addColorStop(0, 'rgba(255,248,224,' + (0.9 * (1 - t)) + ')');
            g.addColorStop(0.55, 'rgba(255,210,122,' + (0.5 * (1 - t)) + ')');
            g.addColorStop(0.8, 'rgba(122,29,107,' + (0.32 * (1 - t)) + ')');
            g.addColorStop(1, 'rgba(7,6,17,0)');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,235,180,' + (0.8 * (1 - t)) + ')'; ctx.lineWidth = 3 * (1 - t) + 0.5;
            ctx.beginPath(); ctx.arc(ox, oy, r * 0.92, 0, Math.PI * 2); ctx.stroke();
            for (var m = 0; m < motes.length; m++) { var mo = motes[m]; var d = ease * maxR * mo.sp; ctx.globalAlpha = (1 - t) * 0.9; ctx.fillStyle = mo.col; ctx.fillRect(ox + Math.cos(mo.a) * d, oy + Math.sin(mo.a) * d, mo.sz, mo.sz); }
            ctx.globalAlpha = 1;
            if (t < 1) { requestAnimationFrame(frame); } else { if (canvas.parentNode) { canvas.parentNode.removeChild(canvas); } if (done) { done(); } }
        }
        requestAnimationFrame(frame);
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
        progEl = document.createElement('span'); progEl.className = 'np-prog'; progEl.setAttribute('aria-live', 'polite');
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
        clear: function () { try { localStorage.removeItem(STORE_KEY); } catch (e) {} clearNebula(); }
    };
})();
