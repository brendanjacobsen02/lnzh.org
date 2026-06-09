document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('writing-editor');
    const editor = document.getElementById('editor');
    const textarea = document.getElementById('sentence-input');
    const highlights = document.getElementById('editor-highlights');
    const blackoutToggle = document.getElementById('blackout-toggle');
    const confirmationToggle = document.getElementById('confirmation-toggle');
    const keepPopover = document.getElementById('sentence-keep-popover');
    const acceptButton = document.getElementById('sentence-accept');
    const rejectButton = document.getElementById('sentence-reject');
    const kbdConfirmHint = document.getElementById('writing-kbd-confirm');
    const copyButton = document.getElementById('copy-writing');
    const downloadButton = document.getElementById('download-writing');
    const clearButton = document.getElementById('clear-writing');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const draftsSection = document.getElementById('completed-drafts');
    const draftList = document.getElementById('draft-list');
    const toast = document.getElementById('writing-toast');
    const hudWords = document.getElementById('hud-words');
    const hudSentences = document.getElementById('hud-sentences');
    const hudRead = document.getElementById('hud-read');
    const summary = document.getElementById('writing-summary');
    const summaryClose = document.getElementById('summary-close');
    const sumWords = document.getElementById('sum-words');
    const sumSentences = document.getElementById('sum-sentences');
    const sumRead = document.getElementById('sum-read');
    const sumPreview = document.getElementById('sum-preview');
    const sumSave = document.getElementById('sum-save');
    const sumCopy = document.getElementById('sum-copy');
    const sumDownload = document.getElementById('sum-download');
    const sumContinue = document.getElementById('sum-continue');

    const required = [
        form, editor, textarea, highlights, blackoutToggle, confirmationToggle, keepPopover,
        acceptButton, rejectButton, kbdConfirmHint, copyButton, downloadButton, clearButton,
        settingsToggle, settingsPanel, draftsSection, draftList, toast, hudWords, hudSentences,
        hudRead, summary, summaryClose, sumWords, sumSentences, sumRead, sumPreview, sumSave,
        sumCopy, sumDownload, sumContinue,
    ];
    if (required.some((el) => !el)) {
        return;
    }

    const core = window.WritingCore;
    const DRAFTS_KEY = 'lnzh.writing.drafts';
    const drafts = loadDrafts();
    let pendingDraft = '';
    let toastTimer;
    let clearArmTimer;
    let reviewedUpTo = 0;       // chars before this index are decided (kept)
    let awaiting = null;        // { start, end } of a sentence locked for review

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
            /* storage unavailable: stay in-memory only */
        }
    }

    function makeDraftId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'd' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    }

    /* ---------- export / clipboard ---------- */
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

    /* ---------- toast ---------- */
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('active');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('active'), 1400);
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

    /* ---------- stats ---------- */
    function computeStats() {
        const value = textarea.value;
        const words = core.countWords(value);
        const parsed = core.extractSentences(value);
        const sentences = parsed.sentences.length + (core.normalizeText(parsed.remainder) ? 1 : 0);
        return { words: words, sentences: sentences, read: core.readingMinutes(words) };
    }

    function renderStats() {
        const stats = computeStats();
        hudWords.textContent = core.pad2(stats.words);
        hudSentences.textContent = core.pad2(stats.sentences);
        hudRead.textContent = '~' + stats.read;
    }

    function disarmClear() {
        window.clearTimeout(clearArmTimer);
        clearButton.classList.remove('is-armed');
        clearButton.textContent = 'clear';
    }

    function updateControls() {
        const hasText = textarea.value.trim().length > 0;
        copyButton.disabled = !hasText;
        downloadButton.disabled = !hasText;
        clearButton.disabled = !hasText;
        if (!hasText) {
            disarmClear();
        }
        renderStats();
    }

    function updateKbdHints() {
        kbdConfirmHint.style.display = confirmationToggle.checked ? '' : 'none';
    }

    /* ---------- blackout backdrop ---------- */
    // Redact decided text, keep the rest visible. In confirm mode "decided" = the
    // kept region (up to reviewedUpTo); otherwise it's every completed sentence.
    function renderBackdrop() {
        highlights.replaceChildren();
        if (!blackoutToggle.checked) {
            return;
        }
        const value = textarea.value;
        let cut;
        if (confirmationToggle.checked) {
            cut = Math.min(reviewedUpTo, value.length);
        } else {
            const parsed = core.extractSentences(value);
            cut = value.length - parsed.remainder.length;
        }
        const redacted = value.slice(0, cut);
        const visible = value.slice(cut);
        if (redacted) {
            const span = document.createElement('span');
            span.className = 'redact';
            span.textContent = redacted;
            highlights.append(span);
        }
        if (visible) {
            highlights.append(document.createTextNode(visible));
        }
        syncScroll();
    }

    function syncScroll() {
        highlights.style.transform = 'translateY(' + (-textarea.scrollTop) + 'px)';
    }

    /* ---------- caret geometry (for the keep/cut popover) ---------- */
    function caretCoords(position) {
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
        const borderL = parseFloat(computed.borderLeftWidth) || 0;
        const borderT = parseFloat(computed.borderTopWidth) || 0;
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
        div.textContent = textarea.value.slice(0, position);
        const span = document.createElement('span');
        span.textContent = textarea.value.slice(position) || '.';
        div.appendChild(span);
        document.body.appendChild(div);
        const top = span.offsetTop + borderT;
        const left = span.offsetLeft + borderL;
        const height = parseFloat(computed.lineHeight) || 24;
        document.body.removeChild(div);
        return { top: top, left: left, height: height };
    }

    /* ---------- keep / cut lock ---------- */
    function positionKeepPopover() {
        if (!awaiting) {
            keepPopover.hidden = true;
            return;
        }
        keepPopover.hidden = false;
        const coords = caretCoords(awaiting.end);
        const rect = textarea.getBoundingClientRect();
        const half = keepPopover.offsetWidth / 2;
        let x = rect.left + coords.left - textarea.scrollLeft;
        x = Math.max(half + 8, Math.min(x, window.innerWidth - half - 8));
        let y = rect.top + coords.top - textarea.scrollTop;
        y = Math.max(rect.top + 4, Math.min(y, rect.bottom - 4));
        keepPopover.style.left = x + 'px';
        keepPopover.style.top = y + 'px';
    }

    function checkForPending() {
        if (awaiting || !confirmationToggle.checked) {
            return;
        }
        const tail = textarea.value.slice(reviewedUpTo);
        const parsed = core.extractSentences(tail);
        if (parsed.sentences.length > 0) {
            awaiting = { start: reviewedUpTo, end: reviewedUpTo + parsed.sentences[0].length };
            window.requestAnimationFrame(positionKeepPopover);
        }
    }

    function keepSentence() {
        if (!awaiting) {
            return;
        }
        const rect = keepPopover.getBoundingClientRect();
        spawnSparkle(rect.left + rect.width / 2, rect.top);
        flashCommand('kept ✓', rect.left + rect.width / 2, rect.top, 'keep');
        reviewedUpTo = awaiting.end;
        awaiting = null;
        keepPopover.hidden = true;
        textarea.focus();
        renderBackdrop();
        updateControls();
    }

    function cutSentence() {
        if (!awaiting) {
            return;
        }
        const rect = keepPopover.getBoundingClientRect();
        flashCommand('cut ✗', rect.left + rect.width / 2, rect.top, 'cut');
        const value = textarea.value;
        textarea.value = value.slice(0, awaiting.start) + value.slice(awaiting.end);
        textarea.selectionStart = awaiting.start;
        textarea.selectionEnd = awaiting.start;
        awaiting = null;
        keepPopover.hidden = true;
        textarea.focus();
        renderBackdrop();
        updateControls();
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

    /* ---------- finish / summary ---------- */
    function completeDraft() {
        const text = textarea.value.trim();
        if (!text) {
            showToast('Write something first.');
            textarea.focus();
            return;
        }
        const stats = computeStats();
        pendingDraft = text;
        sumWords.textContent = core.pad2(stats.words);
        sumSentences.textContent = core.pad2(stats.sentences);
        sumRead.textContent = '~' + stats.read;
        sumPreview.textContent = text;
        summary.hidden = false;
        sumSave.focus();
    }

    function closeSummary() {
        summary.hidden = true;
    }

    function resetEditor() {
        textarea.value = '';
        reviewedUpTo = 0;
        awaiting = null;
        keepPopover.hidden = true;
        updateControls();
        renderBackdrop();
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
        textarea.focus();
    }

    function dismissSummary() {
        closeSummary();
        textarea.focus();
    }

    /* ---------- events ---------- */
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        completeDraft();
    });

    textarea.addEventListener('input', () => {
        if (reviewedUpTo > textarea.value.length) {
            reviewedUpTo = textarea.value.length;
        }
        checkForPending();
        updateControls();
        renderBackdrop();
    });

    textarea.addEventListener('scroll', () => {
        syncScroll();
        if (awaiting) {
            positionKeepPopover();
        }
    });

    textarea.addEventListener('keydown', (event) => {
        // While a sentence is locked for review, input is gated until you decide.
        if (awaiting) {
            if (event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }
            if (event.key === 'y' || event.key === 'Y') {
                event.preventDefault();
                keepSentence();
                return;
            }
            if (event.key === 'n' || event.key === 'N') {
                event.preventDefault();
                cutSentence();
                return;
            }
            if (event.key.length === 1 || event.key === 'Enter'
                || event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Tab') {
                event.preventDefault();
            }
            return;
        }
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            completeDraft();
        }
        // Plain Enter inserts a newline natively.
    });

    textarea.addEventListener('paste', (event) => {
        if (awaiting) {
            event.preventDefault();
        }
    });

    acceptButton.addEventListener('click', keepSentence);
    rejectButton.addEventListener('click', cutSentence);
    [acceptButton, rejectButton].forEach((button) => {
        button.addEventListener('mousedown', (event) => event.preventDefault());
    });

    confirmationToggle.addEventListener('change', () => {
        if (!confirmationToggle.checked) {
            awaiting = null;
            keepPopover.hidden = true;
        } else {
            reviewedUpTo = 0;
            checkForPending();
        }
        updateKbdHints();
        renderBackdrop();
    });

    blackoutToggle.addEventListener('change', () => {
        editor.classList.toggle('is-blackout', blackoutToggle.checked);
        renderBackdrop();
    });

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

    copyButton.addEventListener('click', () => copyToClipboard(textarea.value.trim()));

    downloadButton.addEventListener('click', () => {
        const text = textarea.value.trim();
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
            textarea.focus();
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

    window.addEventListener('resize', () => {
        if (awaiting) {
            positionKeepPopover();
        }
    });
    window.addEventListener('scroll', () => {
        if (awaiting) {
            positionKeepPopover();
        }
    }, true);

    updateKbdHints();
    updateControls();
    renderBackdrop();
    renderDrafts();
});
