document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('writing-editor');
    const editor = document.getElementById('editor');
    const textarea = document.getElementById('sentence-input');
    const highlights = document.getElementById('editor-highlights');
    const blackoutToggle = document.getElementById('blackout-toggle');
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
        form, editor, textarea, highlights, blackoutToggle, copyButton, downloadButton,
        clearButton, settingsToggle, settingsPanel, draftsSection, draftList, toast,
        hudWords, hudSentences, hudRead, summary, summaryClose, sumWords, sumSentences,
        sumRead, sumPreview, sumSave, sumCopy, sumDownload, sumContinue,
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

    /* ---------- toast ---------- */
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('active');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove('active'), 1400);
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

    /* ---------- blackout backdrop ---------- */
    // Redact completed sentences (text transparent, bar behind); leave the line
    // you're currently writing visible. The textarea's own text is hidden in
    // blackout, so only this aligned layer shows.
    function renderBackdrop() {
        highlights.replaceChildren();
        if (!blackoutToggle.checked) {
            return;
        }
        const parsed = core.extractSentences(textarea.value);
        const completed = parsed.sentences.join('');
        if (completed) {
            const span = document.createElement('span');
            span.className = 'redact';
            span.textContent = completed;
            highlights.append(span);
        }
        if (parsed.remainder) {
            highlights.append(document.createTextNode(parsed.remainder));
        }
        syncScroll();
    }

    function syncScroll() {
        highlights.style.transform = 'translateY(' + (-textarea.scrollTop) + 'px)';
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
        updateControls();
        renderBackdrop();
    });

    textarea.addEventListener('scroll', syncScroll);

    textarea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            completeDraft();
        }
        // Plain Enter inserts a newline natively — nothing to do.
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

    updateControls();
    renderBackdrop();
    renderDrafts();
});
