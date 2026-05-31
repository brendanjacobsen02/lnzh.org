document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('writing-editor');
    const input = document.getElementById('sentence-input');
    const stream = document.getElementById('sentence-stream');
    const confirmation = document.getElementById('sentence-confirmation');
    const confirmationText = document.getElementById('sentence-confirmation-text');
    const confirmSentenceButton = document.getElementById('confirm-sentence');
    const editSentenceButton = document.getElementById('edit-sentence');
    const blackoutButton = document.getElementById('toggle-blackout');
    const copyButton = document.getElementById('copy-writing');
    const draftsSection = document.getElementById('completed-drafts');
    const draftList = document.getElementById('draft-list');
    const toast = document.getElementById('writing-toast');

    if (
        !form ||
        !input ||
        !stream ||
        !confirmation ||
        !confirmationText ||
        !confirmSentenceButton ||
        !editSentenceButton ||
        !blackoutButton ||
        !copyButton ||
        !draftsSection ||
        !draftList ||
        !toast
    ) {
        return;
    }

    const sentences = [];
    const drafts = [];
    let pendingSentence = '';
    let isBlackout = false;
    let toastTimer;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('active');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.classList.remove('active');
        }, 1600);
    }

    function normalizeText(value) {
        return value.trim().replace(/\s+/g, ' ');
    }

    function completedText() {
        return sentences.join(' ');
    }

    function draftText() {
        const currentText = normalizeText(input.textContent);
        return [completedText(), pendingSentence, currentText].filter(Boolean).join(' ');
    }

    function sentenceEndIndex(value) {
        const match = value.match(/[.!?;:]+(?:["'”’)\]]+)?(?:\s|$)/);
        return match ? match.index + match[0].trimEnd().length : -1;
    }

    function updateControls() {
        const hasText = draftText().length > 0;
        const hasSentences = sentences.length > 0;
        blackoutButton.disabled = !hasSentences;
        copyButton.disabled = !hasText;
        blackoutButton.textContent = isBlackout ? 'reveal' : 'blackout';
    }

    function renderDrafts() {
        draftList.replaceChildren();
        draftsSection.hidden = drafts.length === 0;

        drafts.forEach((draft, index) => {
            const draftElement = document.createElement('article');
            draftElement.className = 'completed-draft';

            const label = document.createElement('p');
            label.className = 'completed-draft-label';
            label.textContent = `draft ${index + 1}`;

            const text = document.createElement('p');
            text.className = 'completed-draft-text';
            text.textContent = draft;

            draftElement.append(label, text);
            draftList.prepend(draftElement);
        });
    }

    function renderSentences() {
        stream.replaceChildren();
        sentences.forEach((sentence, index) => {
            const sentenceElement = document.createElement('span');
            sentenceElement.className = 'sentence-fragment';
            sentenceElement.textContent = sentence;
            stream.append(sentenceElement);

            if (index < sentences.length - 1) {
                stream.append(' ');
            }
        });

        if (sentences.length > 0) {
            stream.append(' ');
        }

        stream.append(input);
        stream.classList.toggle('is-blackout', isBlackout);
        stream.classList.toggle('has-sentences', sentences.length > 0);
        updateControls();
    }

    function showConfirmation(sentence) {
        pendingSentence = sentence;
        confirmationText.textContent = sentence;
        confirmation.hidden = false;
        input.setAttribute('contenteditable', 'false');
        updateControls();
    }

    function hideConfirmation() {
        pendingSentence = '';
        confirmation.hidden = true;
        confirmationText.textContent = '';
        input.setAttribute('contenteditable', 'true');
        updateControls();
    }

    function maybePrepareSentence() {
        if (pendingSentence) {
            return false;
        }

        const text = input.textContent;
        const endIndex = sentenceEndIndex(text);

        if (endIndex === -1) {
            updateControls();
            return false;
        }

        const sentence = normalizeText(text.slice(0, endIndex));
        const remainder = text.slice(endIndex).trimStart();

        if (!sentence) {
            updateControls();
            return false;
        }

        input.textContent = remainder;
        showConfirmation(sentence);
        return true;
    }

    confirmSentenceButton.addEventListener('click', () => {
        if (!pendingSentence) {
            return;
        }

        sentences.push(pendingSentence);
        hideConfirmation();
        renderSentences();
        showToast('Sentence kept.');
        input.focus();

        window.setTimeout(() => {
            maybePrepareSentence();
        }, 0);
    });

    editSentenceButton.addEventListener('click', () => {
        if (!pendingSentence) {
            return;
        }

        input.textContent = [pendingSentence, input.textContent].filter(Boolean).join(' ');
        hideConfirmation();
        renderSentences();
        input.focus();
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        if (maybePrepareSentence()) {
            return;
        }

        if (pendingSentence) {
            showToast('Keep or edit the sentence first.');
            return;
        }

        const text = draftText();

        if (!text) {
            showToast('Write something first.');
            input.focus();
            return;
        }

        drafts.push(text);
        sentences.length = 0;
        input.textContent = '';
        isBlackout = false;
        renderSentences();
        renderDrafts();
        showToast('Draft stored below.');
        input.focus();
    });

    input.addEventListener('input', () => {
        maybePrepareSentence();
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
        maybePrepareSentence();
    });

    stream.addEventListener('click', () => {
        if (!pendingSentence) {
            input.focus();
        }
    });

    blackoutButton.addEventListener('click', () => {
        isBlackout = !isBlackout;
        renderSentences();
        showToast(isBlackout ? 'Text blacked out.' : 'Text revealed.');
    });

    copyButton.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(draftText());
            showToast('Copied.');
        } catch (error) {
            showToast('Copy failed.');
        }
    });

    renderSentences();
    renderDrafts();
});
