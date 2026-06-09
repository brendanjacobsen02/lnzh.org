document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('writing-editor');
    const input = document.getElementById('sentence-input');
    const stream = document.getElementById('sentence-stream');
    const keepPopover = document.getElementById('sentence-keep-popover');
    const acceptSentenceButton = document.getElementById('sentence-accept');
    const rejectSentenceButton = document.getElementById('sentence-reject');
    const blackoutToggle = document.getElementById('blackout-toggle');
    const copyButton = document.getElementById('copy-writing');
    const downloadButton = document.getElementById('download-writing');
    const clearButton = document.getElementById('clear-writing');
    const confirmationToggle = document.getElementById('confirmation-toggle');
    const shortcutsToggle = document.getElementById('shortcuts-toggle');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const completeButton = document.getElementById('complete-draft');
    const completeKbd = document.getElementById('complete-kbd');
    const kbdHint = document.getElementById('writing-kbd-hint');
    const kbdConfirmHint = document.getElementById('writing-kbd-confirm');
    const draftsSection = document.getElementById('completed-drafts');
    const draftList = document.getElementById('draft-list');
    const toast = document.getElementById('writing-toast');
    const hudWords = document.getElementById('hud-words');
    const hudSentences = document.getElementById('hud-sentences');
    const hudKept = document.getElementById('hud-kept');
    const summary = document.getElementById('writing-summary');
    const summaryClose = document.getElementById('summary-close');
    const sumWords = document.getElementById('sum-words');
    const sumSentences = document.getElementById('sum-sentences');
    const sumKept = document.getElementById('sum-kept');
    const sumRead = document.getElementById('sum-read');
    const sumPreview = document.getElementById('sum-preview');
    const sumSave = document.getElementById('sum-save');
    const sumCopy = document.getElementById('sum-copy');
    const sumDownload = document.getElementById('sum-download');
    const sumContinue = document.getElementById('sum-continue');
    const caret = document.getElementById('writing-caret');

    const required = [
        form, input, stream, keepPopover, acceptSentenceButton, rejectSentenceButton,
        blackoutToggle, copyButton, downloadButton, clearButton, confirmationToggle, shortcutsToggle,
        settingsToggle, settingsPanel, completeButton, completeKbd, kbdHint, kbdConfirmHint,
        draftsSection, draftList, toast, hudWords, hudSentences, hudKept, summary,
        summaryClose, sumWords, sumSentences, sumKept, sumRead, sumPreview, sumSave,
        sumCopy, sumDownload, sumContinue, caret,
    ];
    if (required.some((el) => !el)) {
        return;
    }

    const core = window.WritingCore;
    const DRAFTS_KEY = 'lnzh.writing.drafts';
    const reviewedSentences = [];
    const drafts = loadDrafts();
    let activeSentenceIndex = -1;
    let pendingDraft = '';
    let toastTimer;
    let clearArmTimer;

    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    /* ---------- storage ---------- */
    function loadDrafts() {
        let raw = '';
        try {
            raw = window.localStorage.getItem(DRAFTS_KEY) || '';
        } catch (err) {
            return [];
        }
        return core.deserializeDrafts(raw);
    }

    function saveDrafts() {
        try {
            window.localStorage.setItem(DRAFTS_KEY, core.serializeDrafts(drafts));
        } catch (err) {
            /* storage unavailable (private mode/quota): stay in-memory only */
        }
    }

    function makeDraftId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'd' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    }

    /* ---------- text ---------- */
    function keptSentences() {
        return reviewedSentences.filter((s) => s.keep).map((s) => s.text);
    }

    function completedText() {
        return keptSentences().join(' ');
    }

    function draftText() {
        const currentText = core.normalizeText(input.textContent);
        return [completedText(), currentText].filter(Boolean).join(' ');
    }

    // Restore the caret to the end of the editor after a re-render (which
    // detaches/re-appends the input and otherwise drops the selection to the
    // start). Keeps the block cursor sitting where you're actually writing.
    function placeCaretAtEnd() {
        input.focus();
        const selection = window.getSelection();
        if (!selection) {
            return;
        }
        const range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    // Insert a real newline character at the caret (reliable across browsers,
    // unlike execCommand). The editor flows inline + white-space:pre-wrap, so
    // the break lands at the left margin like normal text.
    function insertNewline() {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || !input.contains(selection.anchorNode)) {
            input.append(document.createTextNode('\n'));
            placeCaretAtEnd();
            return;
        }
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const newline = document.createTextNode('\n');
        range.insertNode(newline);
        range.setStartAfter(newline);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    /* ---------- block caret ----------
       Native caret is hidden (CSS); we draw a block at the measured caret rect
       so the cursor is a consistent block everywhere, including the empty box. */
    // Measure the caret position by briefly appending a zero-width marker at the
    // end of the input. A real element always has a rect — even on an empty line,
    // an empty field, or just after a newline — where a collapsed Range does not.
    function endMarkerRect() {
        const marker = document.createElement('span');
        marker.textContent = '\u200b';
        input.appendChild(marker);
        const rect = marker.getBoundingClientRect();
        marker.remove();
        return rect;
    }

    function caretRect() {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0 && input.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0).cloneRange();
            range.collapse(true);
            const bounding = range.getBoundingClientRect();
            if (bounding && bounding.height > 0 && (bounding.top > 0 || bounding.left > 0)) {
                return bounding;
            }
            const rects = range.getClientRects();
            if (rects.length > 0 && rects[0].height > 0) {
                return rects[0];
            }
        }
        // empty input / end of content / just after a newline: measure a marker
        return endMarkerRect();
    }

    function updateCaret() {
        const selection = window.getSelection();
        const collapsed = !selection || selection.isCollapsed;
        if (document.activeElement !== input || !collapsed) {
            caret.style.display = 'none';
            return;
        }
        const rect = caretRect();
        const fontSize = parseFloat(window.getComputedStyle(input).fontSize) || 16;
        const height = Math.min(rect.height, fontSize * 1.15);
        caret.style.display = 'block';
        caret.style.left = rect.left + 'px';
        caret.style.top = (rect.top + (rect.height - height) / 2) + 'px';
        caret.style.width = (fontSize * 0.5) + 'px';
        caret.style.height = height + 'px';
    }

    function queueCaret() {
        window.requestAnimationFrame(updateCaret);
    }

    /* ---------- export ---------- */
    function downloadText(filename, text) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copied.');
        } catch (err) {
            showToast('Copy failed.');
        }
    }

    /* ---------- whimsy ---------- */
    function spawnSparkle(x, y) {
        if (prefersReducedMotion()) {
            return;
        }
        const sparkle = document.createElement('span');
        sparkle.className = 'writing-sparkle';
        sparkle.textContent = '✦';
        sparkle.style.left = x + 'px';
        sparkle.style.top = y + 'px';
        document.body.append(sparkle);
        sparkle.addEventListener('animationend', () => sparkle.remove());
    }

    function flashCommand(message, x, y, kind) {
        const flash = document.createElement('span');
        flash.className = kind === 'cut' ? 'writing-flash is-cut' : 'writing-flash';
        flash.textContent = message;
        flash.style.left = x + 'px';
        flash.style.top = y + 'px';
        document.body.append(flash);
        const remove = () => flash.remove();
        flash.addEventListener('animationend', remove);
        window.setTimeout(remove, 1000);
    }

    /* ---------- toast ---------- */
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('active');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('active'), 1400);
    }

    /* ---------- stats + controls ---------- */
    function renderStats() {
        const stats = core.computeStats(reviewedSentences, input.textContent);
        hudWords.textContent = core.pad2(stats.words);
        hudSentences.textContent = core.pad2(stats.sentences);
        hudKept.textContent = core.pad2(stats.kept);
    }

    function updateControls() {
        const hasText = draftText().length > 0;
        const hasContent = reviewedSentences.length > 0 || core.normalizeText(input.textContent).length > 0;
        copyButton.disabled = !hasText;
        downloadButton.disabled = !hasText;
        clearButton.disabled = !hasContent;
        if (!hasContent) {
            disarmClear();
        }
        renderStats();
    }

    function disarmClear() {
        window.clearTimeout(clearArmTimer);
        clearButton.classList.remove('is-armed');
        clearButton.textContent = 'clear';
    }

    function updateKbdHints() {
        const on = shortcutsToggle.checked;
        kbdHint.hidden = !on;
        completeKbd.style.display = on ? '' : 'none';
        kbdConfirmHint.style.display = (on && confirmationToggle.checked) ? '' : 'none';
    }

    /* ---------- drafts ---------- */
    function renderDrafts() {
        draftList.replaceChildren();
        draftsSection.hidden = drafts.length === 0;

        drafts.forEach((draft, index) => {
            const article = document.createElement('article');
            article.className = 'completed-draft';

            const label = document.createElement('p');
            label.className = 'completed-draft-label';
            label.textContent = 'draft ' + core.pad2(index + 1);

            const text = document.createElement('p');
            text.className = 'completed-draft-text';
            text.textContent = draft.text;

            const actions = document.createElement('div');
            actions.className = 'draft-actions';

            const copyDraftButton = document.createElement('button');
            copyDraftButton.type = 'button';
            copyDraftButton.textContent = 'copy';
            copyDraftButton.addEventListener('click', () => copyToClipboard(draft.text));

            const downloadDraftButton = document.createElement('button');
            downloadDraftButton.type = 'button';
            downloadDraftButton.textContent = 'download';
            downloadDraftButton.addEventListener('click', () => {
                downloadText('draft-' + core.pad2(index + 1) + '.txt', draft.text);
                showToast('Downloaded.');
            });

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = 'delete';
            deleteButton.addEventListener('click', () => {
                const at = drafts.findIndex((d) => d.id === draft.id);
                if (at !== -1) {
                    drafts.splice(at, 1);
                    saveDrafts();
                    renderDrafts();
                    showToast('Draft deleted.');
                }
            });

            actions.append(copyDraftButton, downloadDraftButton, deleteButton);
            article.append(label, text, actions);
            draftList.prepend(article);
        });
    }

    /* ---------- sentence stream ---------- */
    function sentenceRect(sentenceElement) {
        const rects = Array.from(sentenceElement.getClientRects());
        return rects.length > 0 ? rects[rects.length - 1] : sentenceElement.getBoundingClientRect();
    }

    function positionKeepPopover() {
        const activeSentence = stream.querySelector(`[data-sentence-index="${activeSentenceIndex}"]`);
        if (activeSentenceIndex === -1 || !confirmationToggle.checked || !activeSentence) {
            keepPopover.hidden = true;
            return;
        }
        keepPopover.hidden = false;
        const rect = sentenceRect(activeSentence);
        const half = keepPopover.offsetWidth / 2;
        const left = Math.max(half + 8, Math.min(rect.right, window.innerWidth - half - 8));
        keepPopover.style.left = left + 'px';
        keepPopover.style.top = rect.top + 'px';
    }

    function queuePopoverPosition() {
        window.requestAnimationFrame(positionKeepPopover);
    }

    function renderSentences() {
        stream.replaceChildren();

        reviewedSentences.forEach((sentence, index) => {
            const fragment = document.createElement('span');
            fragment.className = sentence.keep ? 'sentence-fragment is-kept' : 'sentence-fragment is-pending';
            fragment.dataset.sentenceIndex = String(index);
            fragment.textContent = sentence.text;
            fragment.addEventListener('click', (event) => {
                event.stopPropagation();
                activeSentenceIndex = index;
                positionKeepPopover();
            });
            stream.append(fragment);
            stream.append(' ');
        });

        stream.append(input);
        stream.classList.toggle('is-blackout', blackoutToggle.checked);
        stream.classList.toggle('has-sentences', reviewedSentences.length > 0);
        updateControls();
        queuePopoverPosition();
    }

    function collectCompletedSentences() {
        const { sentences, remainder } = core.extractSentences(input.textContent);
        if (sentences.length > 0) {
            sentences.forEach((text) => {
                reviewedSentences.push({ text, keep: !confirmationToggle.checked });
                activeSentenceIndex = reviewedSentences.length - 1;
            });
            input.textContent = remainder;
            renderSentences();
            placeCaretAtEnd();
            return true;
        }
        updateControls();
        queuePopoverPosition();
        return false;
    }

    /* ---------- keep / cut ---------- */
    function acceptActive() {
        if (activeSentenceIndex === -1) {
            return;
        }
        reviewedSentences[activeSentenceIndex].keep = true;
        const rect = keepPopover.getBoundingClientRect();
        spawnSparkle(rect.left + rect.width / 2, rect.top);
        flashCommand('kept ✓', rect.left + rect.width / 2, rect.top, 'keep');
        activeSentenceIndex = -1;
        keepPopover.hidden = true;
        renderSentences();
        placeCaretAtEnd();
    }

    function rejectActive() {
        if (activeSentenceIndex === -1) {
            return;
        }
        const rect = keepPopover.getBoundingClientRect();
        flashCommand('cut ✗', rect.left + rect.width / 2, rect.top, 'cut');
        reviewedSentences.splice(activeSentenceIndex, 1);
        activeSentenceIndex = -1;
        keepPopover.hidden = true;
        renderSentences();
        placeCaretAtEnd();
    }

    /* ---------- finish / summary ---------- */
    function completeDraft() {
        collectCompletedSentences();
        const text = draftText();
        if (!text) {
            showToast('Write something first.');
            input.focus();
            return;
        }
        const stats = core.computeStats(reviewedSentences, input.textContent);
        pendingDraft = text;
        sumWords.textContent = core.pad2(stats.words);
        sumSentences.textContent = core.pad2(stats.sentences);
        sumKept.textContent = core.pad2(stats.kept);
        sumRead.textContent = '~' + core.readingMinutes(stats.words);
        sumPreview.textContent = text;
        summary.hidden = false;
        sumSave.focus();
    }

    function closeSummary() {
        summary.hidden = true;
    }

    function resetEditor() {
        reviewedSentences.length = 0;
        activeSentenceIndex = -1;
        input.textContent = '';
        keepPopover.hidden = true;
        renderSentences();
    }

    function savePending() {
        if (!pendingDraft) {
            return;
        }
        drafts.push({ id: makeDraftId(), text: pendingDraft, createdAt: Date.now() });
        saveDrafts();
        renderDrafts();
        pendingDraft = '';
        resetEditor();
        closeSummary();
        showToast('Draft saved ✦');
        placeCaretAtEnd();
    }

    function dismissSummary() {
        closeSummary();
        placeCaretAtEnd();
    }

    /* ---------- events ---------- */
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        completeDraft();
    });

    input.addEventListener('input', () => {
        collectCompletedSentences();
        queueCaret();
    });

    input.addEventListener('keydown', (event) => {
        // In confirm mode, a finished sentence must be kept or cut before you can
        // keep writing — the prompt gates input.
        const awaitingDecision = confirmationToggle.checked && activeSentenceIndex !== -1;

        if (awaitingDecision) {
            // Let real system shortcuts (copy, select-all, …) through.
            if (event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            if (shortcutsToggle.checked && (event.key === 'y' || event.key === 'Y')) {
                event.preventDefault();
                acceptActive();
                return;
            }
            if (shortcutsToggle.checked && (event.key === 'n' || event.key === 'N')) {
                event.preventDefault();
                rejectActive();
                return;
            }
            // Block anything that edits text; navigation keys still pass through.
            if (event.key.length === 1 || event.key === 'Enter'
                || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Tab') {
                event.preventDefault();
            }
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            if (event.metaKey || event.ctrlKey) {
                completeDraft();
            } else {
                insertNewline();
                collectCompletedSentences();
                queueCaret();
            }
        }
    });

    input.addEventListener('paste', (event) => {
        event.preventDefault();
        if (confirmationToggle.checked && activeSentenceIndex !== -1) {
            return;
        }
        const pastedText = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, pastedText);
        collectCompletedSentences();
        queueCaret();
    });

    stream.addEventListener('click', () => {
        input.focus();
    });

    confirmationToggle.addEventListener('change', () => {
        if (!confirmationToggle.checked) {
            reviewedSentences.forEach((sentence) => { sentence.keep = true; });
            activeSentenceIndex = -1;
            keepPopover.hidden = true;
        }
        updateKbdHints();
        renderSentences();
    });

    shortcutsToggle.addEventListener('change', updateKbdHints);

    blackoutToggle.addEventListener('change', renderSentences);

    acceptSentenceButton.addEventListener('click', acceptActive);
    rejectSentenceButton.addEventListener('click', rejectActive);

    settingsToggle.addEventListener('click', (event) => {
        event.stopPropagation();
        const willOpen = settingsPanel.hidden;
        settingsPanel.hidden = !willOpen;
        settingsToggle.setAttribute('aria-expanded', String(willOpen));
    });

    document.addEventListener('click', (event) => {
        if (!settingsPanel.hidden
            && !settingsPanel.contains(event.target)
            && !settingsToggle.contains(event.target)) {
            settingsPanel.hidden = true;
            settingsToggle.setAttribute('aria-expanded', 'false');
        }
    });

    copyButton.addEventListener('click', () => copyToClipboard(draftText()));

    downloadButton.addEventListener('click', () => {
        const text = draftText();
        if (!text) {
            return;
        }
        downloadText('writing-draft.txt', text);
        showToast('Downloaded.');
    });

    clearButton.addEventListener('click', () => {
        if (clearButton.classList.contains('is-armed')) {
            disarmClear();
            resetEditor();
            showToast('Cleared.');
            placeCaretAtEnd();
            return;
        }
        clearButton.classList.add('is-armed');
        clearButton.textContent = 'clear?';
        clearArmTimer = window.setTimeout(disarmClear, 3000);
    });

    sumSave.addEventListener('click', savePending);
    sumCopy.addEventListener('click', () => copyToClipboard(pendingDraft));
    sumDownload.addEventListener('click', () => {
        downloadText('writing-draft.txt', pendingDraft);
        showToast('Downloaded.');
    });
    sumContinue.addEventListener('click', dismissSummary);
    summaryClose.addEventListener('click', dismissSummary);
    summary.addEventListener('click', (event) => {
        if (event.target === summary) {
            dismissSummary();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !summary.hidden) {
            dismissSummary();
        }
    });

    window.addEventListener('resize', queuePopoverPosition);
    window.addEventListener('scroll', queuePopoverPosition, true);

    document.addEventListener('selectionchange', queueCaret);
    input.addEventListener('focus', queueCaret);
    input.addEventListener('blur', () => { caret.style.display = 'none'; });
    window.addEventListener('resize', queueCaret);
    window.addEventListener('scroll', queueCaret, true);

    updateKbdHints();
    renderSentences();
    renderDrafts();
});
