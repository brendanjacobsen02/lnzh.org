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
    const confirmationToggle = document.getElementById('confirmation-toggle');
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const draftsSection = document.getElementById('completed-drafts');
    const draftList = document.getElementById('draft-list');
    const toast = document.getElementById('writing-toast');
    const hudWords = document.getElementById('hud-words');
    const hudSentences = document.getElementById('hud-sentences');
    const hudKept = document.getElementById('hud-kept');

    if (
        !form ||
        !input ||
        !stream ||
        !keepPopover ||
        !acceptSentenceButton ||
        !rejectSentenceButton ||
        !blackoutToggle ||
        !copyButton ||
        !downloadButton ||
        !confirmationToggle ||
        !settingsToggle ||
        !settingsPanel ||
        !draftsSection ||
        !draftList ||
        !toast ||
        !hudWords ||
        !hudSentences ||
        !hudKept
    ) {
        return;
    }

    const core = window.WritingCore;
    const reviewedSentences = [];
    const DRAFTS_KEY = 'lnzh.writing.drafts';
    const drafts = loadDrafts();
    let activeSentenceIndex = -1;
    let toastTimer;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('active');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.classList.remove('active');
        }, 1400);
    }

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

    function spawnSparkle(x, y) {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

    function keptSentences() {
        return reviewedSentences
            .filter((sentence) => sentence.keep)
            .map((sentence) => sentence.text);
    }

    function completedText() {
        return keptSentences().join(' ');
    }

    function draftText() {
        const currentText = core.normalizeText(input.textContent);
        return [completedText(), currentText].filter(Boolean).join(' ');
    }

    function updateControls() {
        const hasText = draftText().length > 0;
        copyButton.disabled = !hasText;
        downloadButton.disabled = !hasText;
        renderStats();
    }

    function renderStats() {
        const stats = core.computeStats(reviewedSentences, input.textContent);
        hudWords.textContent = core.pad2(stats.words);
        hudSentences.textContent = core.pad2(stats.sentences);
        hudKept.textContent = core.pad2(stats.kept);
    }

    function renderDrafts() {
        draftList.replaceChildren();
        draftsSection.hidden = drafts.length === 0;

        drafts.forEach((draft, index) => {
            const draftElement = document.createElement('article');
            draftElement.className = 'completed-draft';

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
            copyDraftButton.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(draft.text);
                    showToast('Copied.');
                } catch (err) {
                    showToast('Copy failed.');
                }
            });

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
            draftElement.append(label, text, actions);
            draftList.prepend(draftElement);
        });
    }

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

        const rect = sentenceRect(activeSentence);
        keepPopover.hidden = false;
        keepPopover.style.left = `${rect.right}px`;
        keepPopover.style.top = `${rect.top}px`;
    }

    function queuePopoverPosition() {
        window.requestAnimationFrame(positionKeepPopover);
    }

    function renderSentences() {
        stream.replaceChildren();

        reviewedSentences.forEach((sentence, index) => {
            const sentenceElement = document.createElement('span');
            sentenceElement.className = sentence.keep
                ? 'sentence-fragment is-kept'
                : 'sentence-fragment is-pending';
            sentenceElement.dataset.sentenceIndex = String(index);
            sentenceElement.textContent = sentence.text;
            sentenceElement.addEventListener('click', (event) => {
                event.stopPropagation();
                activeSentenceIndex = index;
                positionKeepPopover();
            });
            stream.append(sentenceElement);
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
            return true;
        }

        updateControls();
        queuePopoverPosition();
        return false;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        collectCompletedSentences();

        const text = draftText();

        if (!text) {
            showToast('Toggle on a sentence or keep writing.');
            input.focus();
            return;
        }

        drafts.push({ id: makeDraftId(), text: text, createdAt: Date.now() });
        saveDrafts();
        reviewedSentences.length = 0;
        activeSentenceIndex = -1;
        input.textContent = '';
        renderSentences();
        renderDrafts();
        showToast('Draft stored below.');
        input.focus();
    });

    input.addEventListener('input', () => {
        collectCompletedSentences();
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            form.requestSubmit();
        }
    });

    input.addEventListener('paste', (event) => {
        event.preventDefault();
        const pastedText = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, pastedText);
        collectCompletedSentences();
    });

    stream.addEventListener('click', () => {
        input.focus();
    });

    confirmationToggle.addEventListener('change', () => {
        if (!confirmationToggle.checked) {
            reviewedSentences.forEach((sentence) => {
                sentence.keep = true;
            });
            keepPopover.hidden = true;
        }

        renderSentences();
    });

    acceptSentenceButton.addEventListener('click', () => {
        if (activeSentenceIndex === -1) {
            return;
        }

        reviewedSentences[activeSentenceIndex].keep = true;
        const rect = keepPopover.getBoundingClientRect();
        spawnSparkle(rect.left + rect.width / 2, rect.top);
        activeSentenceIndex = -1;
        keepPopover.hidden = true;
        renderSentences();
    });

    rejectSentenceButton.addEventListener('click', () => {
        if (activeSentenceIndex === -1) {
            return;
        }

        reviewedSentences.splice(activeSentenceIndex, 1);
        activeSentenceIndex = -1;
        keepPopover.hidden = true;
        renderSentences();
    });

    settingsToggle.addEventListener('click', () => {
        const willOpen = settingsPanel.hidden;
        settingsPanel.hidden = !willOpen;
        settingsToggle.setAttribute('aria-expanded', String(willOpen));
    });

    window.addEventListener('resize', queuePopoverPosition);
    window.addEventListener('scroll', queuePopoverPosition, true);

    blackoutToggle.addEventListener('change', () => {
        renderSentences();
    });

    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(draftText());
            showToast('Copied.');
        } catch (error) {
            showToast('Copy failed.');
        }
    });

    downloadButton.addEventListener('click', () => {
        const text = draftText();
        if (!text) {
            return;
        }
        downloadText('writing-draft.txt', text);
        showToast('Downloaded.');
    });

    renderSentences();
    renderDrafts();
});
