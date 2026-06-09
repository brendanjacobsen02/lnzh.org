// block-caret.js — accent-colored block cursor for a <textarea>.
//
// A textarea is the reliable foundation: the caret is textarea.selectionStart, a
// plain integer into a plain string — no contenteditable ambiguity (newlines,
// empty lines, and end-of-text are all unambiguous). We compute the caret's pixel
// position with the well-known "mirror div" technique: build a hidden div with the
// textarea's exact text metrics, put the text up to the caret in it, then a span,
// and read the span's offset. That offset is exactly where the caret renders.
//
// Reusable: BlockCaret.create({ textarea, className }).
(function () {
    'use strict';

    function caretCoords(textarea, position) {
        const computed = window.getComputedStyle(textarea);
        const div = document.createElement('div');
        const s = div.style;
        s.position = 'absolute';
        s.top = '0';
        s.left = '-9999px';
        s.visibility = 'hidden';
        s.whiteSpace = 'pre-wrap';
        s.overflowWrap = 'break-word';
        s.wordBreak = computed.wordBreak;
        s.boxSizing = 'content-box';

        const padL = parseFloat(computed.paddingLeft) || 0;
        const padR = parseFloat(computed.paddingRight) || 0;
        const padT = parseFloat(computed.paddingTop) || 0;
        const borderL = parseFloat(computed.borderLeftWidth) || 0;
        const borderT = parseFloat(computed.borderTopWidth) || 0;

        // Match the textarea's CONTENT width exactly (clientWidth excludes the
        // scrollbar and border) so line wrapping is identical.
        s.width = (textarea.clientWidth - padL - padR) + 'px';
        s.paddingTop = computed.paddingTop;
        s.paddingLeft = computed.paddingLeft;
        s.paddingRight = computed.paddingRight;
        s.fontFamily = computed.fontFamily;
        s.fontSize = computed.fontSize;
        s.fontWeight = computed.fontWeight;
        s.fontStyle = computed.fontStyle;
        s.lineHeight = computed.lineHeight;
        s.letterSpacing = computed.letterSpacing;
        s.textTransform = computed.textTransform;
        s.tabSize = computed.tabSize;

        div.textContent = textarea.value.slice(0, position);
        const span = document.createElement('span');
        span.textContent = textarea.value.slice(position) || '.';
        div.appendChild(span);
        document.body.appendChild(div);

        const top = span.offsetTop + borderT;
        const left = span.offsetLeft + borderL;
        const lineHeight = parseFloat(computed.lineHeight) || (parseFloat(computed.fontSize) * 1.3);
        document.body.removeChild(div);

        return { top: top, left: left, height: lineHeight };
    }

    function create(opts) {
        const textarea = opts.textarea;
        const caret = document.createElement('span');
        caret.className = opts.className || 'block-caret';
        caret.setAttribute('aria-hidden', 'true');
        document.body.appendChild(caret);
        textarea.classList.add('has-block-caret');

        let rafId = 0;

        function hide() {
            caret.style.display = 'none';
        }

        function update() {
            if (document.activeElement !== textarea || textarea.selectionStart !== textarea.selectionEnd) {
                hide();
                return;
            }
            const coords = caretCoords(textarea, textarea.selectionStart);
            const rect = textarea.getBoundingClientRect();
            const top = rect.top + coords.top - textarea.scrollTop;
            const left = rect.left + coords.left - textarea.scrollLeft;
            // Don't draw a caret scrolled out of the textarea's viewport.
            if (top + coords.height < rect.top - 1 || top > rect.bottom + 1) {
                hide();
                return;
            }
            const fontSize = parseFloat(window.getComputedStyle(textarea).fontSize) || 16;
            const height = Math.min(coords.height, fontSize * 1.3);
            caret.style.display = 'block';
            caret.style.left = left + 'px';
            caret.style.top = (top + (coords.height - height) / 2) + 'px';
            caret.style.width = (fontSize * 0.5) + 'px';
            caret.style.height = height + 'px';
        }

        function queue() {
            window.cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(update);
        }

        ['input', 'keyup', 'keydown', 'click', 'focus', 'scroll', 'select'].forEach((evt) => {
            textarea.addEventListener(evt, queue);
        });
        textarea.addEventListener('blur', hide);
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === textarea) {
                queue();
            }
        });
        window.addEventListener('resize', queue);
        window.addEventListener('scroll', queue, true);

        return { update: update, refresh: queue, element: caret };
    }

    window.BlockCaret = { create: create };
})();
