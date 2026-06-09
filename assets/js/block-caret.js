// block-caret.js — a reliable, accent-colored block cursor for the writing editor.
//
// Positioning strategy (the important part):
//   1. Measure the REAL collapsed caret rect directly from the live selection.
//      This is pixel-perfect for every normal position (mid-text, end of a line,
//      right after a character) — the browser's own caret geometry, so it can't
//      drift. No clone, no width guessing.
//   2. Only when the real range has no rect (empty editor, or an empty line right
//      after a newline) fall back to a hidden clone of the stream, sized to the
//      stream's CONTENT width so wrapping matches, with a marker at the caret.
//
// We never mutate the live DOM or selection, so typing stays stable. Native caret
// is hidden while active (.has-block-caret) and is the fallback if this never runs.
// Reusable shape: BlockCaret.create({ stream, input, className }).
(function () {
    'use strict';

    function create(opts) {
        const stream = opts.stream;
        const input = opts.input;
        const caret = document.createElement('span');
        caret.className = opts.className || 'block-caret';
        caret.setAttribute('aria-hidden', 'true');
        document.body.appendChild(caret);
        input.classList.add('has-block-caret');

        let rafId = 0;
        let lastKey = null;

        function inInput(node) {
            return node && (node === input || input.contains(node));
        }

        function caretOffset() {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || !inInput(sel.anchorNode)) {
                return null;
            }
            const range = sel.getRangeAt(0);
            const pre = range.cloneRange();
            pre.selectNodeContents(input);
            pre.setEnd(range.endContainer, range.endOffset);
            return pre.toString().length;
        }

        // (1) The live caret's own rectangle — exact when it exists.
        function realRect() {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) {
                return null;
            }
            const range = sel.getRangeAt(0).cloneRange();
            range.collapse(true);
            let r = range.getBoundingClientRect();
            if (r && r.height > 0 && (r.top !== 0 || r.left !== 0)) {
                return { left: r.left, top: r.top, height: r.height };
            }
            const rects = range.getClientRects();
            if (rects.length && rects[0].height > 0) {
                r = rects[0];
                return { left: r.left, top: r.top, height: r.height };
            }
            return null;
        }

        // (2) Fallback: a hidden clone sized to the stream's content box, with a
        // marker at the caret. Used only for empty / post-newline positions.
        function mirrorRect(offset) {
            const streamRect = stream.getBoundingClientRect();
            const cs = window.getComputedStyle(stream);
            const borderLeft = parseFloat(cs.borderLeftWidth) || 0;
            const borderTop = parseFloat(cs.borderTopWidth) || 0;

            const mirror = stream.cloneNode(true);
            mirror.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));

            const marker = document.createElement('span');
            marker.textContent = '\u200b';
            const mirrorInput = mirror.querySelector('.sentence-input-inline');
            if (mirrorInput) {
                mirrorInput.textContent = input.textContent.slice(0, offset);
                mirrorInput.appendChild(marker);
            } else {
                mirror.appendChild(marker);
            }

            mirror.style.position = 'fixed';
            mirror.style.left = (streamRect.left + borderLeft) + 'px';
            mirror.style.top = (streamRect.top + borderTop) + 'px';
            mirror.style.width = stream.clientWidth + 'px';   // content width (no scrollbar)
            mirror.style.border = '0';
            mirror.style.height = 'auto';
            mirror.style.minHeight = '0';
            mirror.style.maxHeight = 'none';
            mirror.style.overflow = 'visible';
            mirror.style.visibility = 'hidden';
            mirror.style.pointerEvents = 'none';
            mirror.style.transform = 'none';
            mirror.style.margin = '0';
            mirror.style.zIndex = '-1';
            document.body.appendChild(mirror);

            const markerRect = marker.getBoundingClientRect();
            document.body.removeChild(mirror);

            return {
                left: markerRect.left - stream.scrollLeft,
                top: markerRect.top - stream.scrollTop,
                height: markerRect.height,
            };
        }

        function hide() {
            caret.style.display = 'none';
        }

        function update() {
            const sel = window.getSelection();
            if (document.activeElement !== input || !sel || !sel.isCollapsed || !inInput(sel.anchorNode)) {
                hide();
                lastKey = null;
                return;
            }
            const offset = caretOffset();
            if (offset == null) {
                hide();
                lastKey = null;
                return;
            }
            const streamRect = stream.getBoundingClientRect();
            const key = [offset, input.textContent.length, stream.textContent.length,
                window.scrollX, window.scrollY, window.innerWidth,
                stream.scrollTop, Math.round(streamRect.top)].join('|');
            if (key === lastKey) {
                return;
            }
            lastKey = key;

            // A caret right after a newline is ambiguous to the live Range API —
            // getBoundingClientRect reports the END of the previous line, not the
            // start of the new one (the "jump back to after the ." bug). For that
            // case use the mirror, which puts the marker on the new line; use the
            // pixel-perfect real rect everywhere else.
            const beforeChar = offset > 0 ? input.textContent.charAt(offset - 1) : '';
            const pos = beforeChar === '\n' ? mirrorRect(offset) : (realRect() || mirrorRect(offset));
            if (!pos || !isFinite(pos.left) || !isFinite(pos.top) || pos.height <= 0) {
                hide();
                return;
            }
            // Don't draw a caret that has scrolled out of the editor's viewport.
            if (pos.top + pos.height < streamRect.top - 1 || pos.top > streamRect.bottom + 1) {
                hide();
                return;
            }
            const fontSize = parseFloat(window.getComputedStyle(input).fontSize) || 16;
            const height = Math.min(pos.height, fontSize * 1.3);
            caret.style.display = 'block';
            caret.style.left = pos.left + 'px';
            caret.style.top = (pos.top + (pos.height - height) / 2) + 'px';
            caret.style.width = (fontSize * 0.5) + 'px';
            caret.style.height = height + 'px';
        }

        function queue() {
            window.cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(update);
        }

        document.addEventListener('selectionchange', queue);
        input.addEventListener('input', queue);
        input.addEventListener('focus', queue);
        input.addEventListener('blur', () => { hide(); lastKey = null; });
        window.addEventListener('scroll', queue, true);
        window.addEventListener('resize', queue);

        return {
            update: update,
            refresh: function () { lastKey = null; queue(); },
            element: caret,
        };
    }

    window.BlockCaret = { create: create };
})();
