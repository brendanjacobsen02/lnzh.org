// block-caret.js — a reliable, accent-colored block cursor for the writing editor.
//
// Per docs/superpowers/specs/2026-06-09-block-caret-editor-design.md, the caret is
// measured from a MIRROR, never from the live editable: on each caret move we clone
// the stream, truncate the cloned input to the caret offset, drop in a marker span,
// lay the clone over the real stream (hidden), and read the marker's rect. Because
// we never mutate the live DOM or selection, typing stays rock-solid; because a real
// element always has a rect, the caret is correct on empty fields, empty lines, and
// right after newlines — the cases that broke every in-place approach.
//
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

        function measure(offset) {
            const streamRect = stream.getBoundingClientRect();
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
            mirror.style.left = streamRect.left + 'px';
            mirror.style.top = streamRect.top + 'px';
            mirror.style.width = streamRect.width + 'px';
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
            const mirrorRect = mirror.getBoundingClientRect();
            document.body.removeChild(mirror);

            return {
                left: (markerRect.left - mirrorRect.left) + streamRect.left - stream.scrollLeft,
                top: (markerRect.top - mirrorRect.top) + streamRect.top - stream.scrollTop,
                height: markerRect.height,
                streamRect: streamRect,
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
            const streamTop = stream.getBoundingClientRect().top;
            const key = [offset, input.textContent.length, stream.textContent.length,
                window.scrollX, window.scrollY, window.innerWidth, stream.scrollTop, Math.round(streamTop)].join('|');
            if (key === lastKey) {
                return;
            }
            lastKey = key;

            const pos = measure(offset);
            if (!pos || !isFinite(pos.left) || !isFinite(pos.top)) {
                hide();
                return;
            }
            // Don't draw a caret that has scrolled out of the editor's viewport.
            if (pos.top + pos.height < pos.streamRect.top - 1 || pos.top > pos.streamRect.bottom + 1) {
                hide();
                return;
            }
            const fontSize = parseFloat(window.getComputedStyle(input).fontSize) || 16;
            const height = Math.min(pos.height, fontSize * 1.3);
            caret.style.display = 'block';
            caret.style.left = pos.left + 'px';
            caret.style.top = (pos.top + (pos.height - height) / 2) + 'px';
            caret.style.width = (fontSize * 0.55) + 'px';
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
