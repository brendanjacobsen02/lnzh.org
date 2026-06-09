// block-caret.js — a terminal-style block cursor for a contenteditable element.
// Hides the native caret and overlays a blinking block at the caret cell that
// inverts what's behind it (so the character under it stays readable), in both
// light and dark themes. Reusable: window.BlockCaret.create(editableEl, opts).
//
// Caret position is measured reliably: the next character's rect when there is
// one, else the collapsed-range rect, else a throwaway marker inserted at the
// caret (restored afterwards by character offset, which survives node splits).
(function () {
    'use strict';

    function create(editable, options) {
        options = options || {};
        const caret = document.createElement('span');
        caret.className = options.className || 'block-caret';
        caret.setAttribute('aria-hidden', 'true');
        document.body.appendChild(caret);
        editable.classList.add('has-block-caret');

        let measuring = false;
        let lastKey = null;
        let rafId = 0;

        function inEditable(node) {
            return node && (node === editable || editable.contains(node));
        }

        function caretOffset() {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || !inEditable(sel.anchorNode)) {
                return null;
            }
            const range = sel.getRangeAt(0);
            const pre = range.cloneRange();
            pre.selectNodeContents(editable);
            pre.setEnd(range.endContainer, range.endOffset);
            return pre.toString().length;
        }

        function setCaretOffset(offset) {
            const sel = window.getSelection();
            const range = document.createRange();
            const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT, null);
            let remaining = offset;
            let node = walker.nextNode();
            if (!node) {
                range.selectNodeContents(editable);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return;
            }
            while (node) {
                const len = node.nodeValue.length;
                if (remaining <= len) {
                    range.setStart(node, remaining);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    return;
                }
                remaining -= len;
                const next = walker.nextNode();
                if (!next) {
                    range.setStart(node, len);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    return;
                }
                node = next;
            }
        }

        function measureRect() {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0 || !inEditable(sel.anchorNode)) {
                return null;
            }
            const range = sel.getRangeAt(0);

            // 1) the character right after the caret — block sits on its cell
            const node = range.endContainer;
            if (node.nodeType === 3 && range.endOffset < node.nodeValue.length
                && node.nodeValue[range.endOffset] !== '\n') {
                const charRange = document.createRange();
                charRange.setStart(node, range.endOffset);
                charRange.setEnd(node, range.endOffset + 1);
                const rects = charRange.getClientRects();
                const r = rects.length ? rects[0] : charRange.getBoundingClientRect();
                if (r && r.height > 0) {
                    return { left: r.left, top: r.top, width: r.width, height: r.height };
                }
            }

            // 2) collapsed caret rect
            const collapsed = range.cloneRange();
            collapsed.collapse(true);
            let r = collapsed.getBoundingClientRect();
            if (r && r.height > 0 && (r.top !== 0 || r.left !== 0)) {
                return { left: r.left, top: r.top, width: 0, height: r.height };
            }

            // 3) marker fallback (empty field / empty line / just after a newline)
            const offset = caretOffset();
            measuring = true;
            const marker = document.createElement('span');
            marker.textContent = '\u200b';
            range.cloneRange().insertNode(marker);
            r = marker.getBoundingClientRect();
            marker.remove();
            editable.normalize();
            if (offset != null) {
                setCaretOffset(offset);
            }
            measuring = false;
            return { left: r.left, top: r.top, width: 0, height: r.height };
        }

        function hide() {
            caret.style.display = 'none';
        }

        function update() {
            if (measuring) {
                return;
            }
            const sel = window.getSelection();
            if (document.activeElement !== editable || !sel || !sel.isCollapsed || !inEditable(sel.anchorNode)) {
                hide();
                lastKey = null;
                return;
            }
            // Skip when nothing that affects the caret position changed — this also
            // breaks the selectionchange loop caused by the marker measurement.
            const key = caretOffset() + '|' + editable.textContent.length + '|'
                + window.scrollX + '|' + window.scrollY + '|'
                + window.innerWidth + '|' + window.innerHeight + '|' + (editable.scrollTop || 0);
            if (key === lastKey) {
                return;
            }
            const rect = measureRect();
            if (!rect) {
                hide();
                lastKey = null;
                return;
            }
            lastKey = key;
            const fontSize = parseFloat(window.getComputedStyle(editable).fontSize) || 16;
            const width = rect.width > 0 ? rect.width : fontSize * 0.55;
            caret.style.display = 'block';
            caret.style.left = rect.left + 'px';
            caret.style.top = rect.top + 'px';
            caret.style.width = width + 'px';
            caret.style.height = rect.height + 'px';
        }

        function queue() {
            if (measuring) {
                return;
            }
            window.cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(update);
        }

        document.addEventListener('selectionchange', queue);
        editable.addEventListener('input', queue);
        editable.addEventListener('focus', queue);
        editable.addEventListener('blur', () => { hide(); lastKey = null; });
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
