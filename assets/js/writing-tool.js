document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('writing-editor');
    const input = document.getElementById('sentence-input');
    const stream = document.getElementById('sentence-stream');
    const review = document.getElementById('sentence-review');
    const reviewList = document.getElementById('sentence-review-list');
    const blackoutButton = document.getElementById('toggle-blackout');
    const copyButton = document.getElementById('copy-writing');
    const draftsSection = document.getElementById('completed-drafts');
    const draftList = document.getElementById('draft-list');
    const toast = document.getElementById('writing-toast');

    if (
        !form ||
        !input ||
        !stream ||
        !review ||
        !reviewList ||
        !blackoutButton ||
        !copyButton ||
        !draftsSection ||
        !draftList ||
        !toast
    ) {
        return;
    }

    const reviewedSentences = [];
    const drafts = [];
    let isBlackout = false;
    let toastTimer;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('active');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.classList.remove('active');
        }, 1400);
    }

    function normalizeText(value) {
        return value.trim().replace(/\s+/g, ' ');
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
        const currentText = normalizeText(input.textContent);
        return [completedText(), currentText].filter(Boolean).join(' ');
    }

    function sentenceEndMatch(value) {
        return value.match(/[.!?;:]+(?:["'”’)\]]+)?(?:\s|$)/);
    }

    function updateControls() {
        const hasText = draftText().length > 0;
        const hasKeptSentences = keptSentences().length > 0;
        blackoutButton.disabled = !hasKeptSentences;
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
        keptSentences().forEach((sentence, index, sentences) => {
            const sentenceElement = document.createElement('span');
            sentenceElement.className = 'sentence-fragment';
            sentenceElement.textContent = sentence;
            stream.append(sentenceElement);

            if (index < sentences.length - 1) {
                stream.append(' ');
            }
        });

        if (keptSentences().length > 0) {
            stream.append(' ');
        }

        stream.append(input);
        stream.classList.toggle('is-blackout', isBlackout);
        stream.classList.toggle('has-sentences', keptSentences().length > 0);
        updateControls();
    }

    function renderReview() {
        reviewList.replaceChildren();
        review.hidden = reviewedSentences.length === 0;

        reviewedSentences.forEach((sentence, index) => {
            const item = document.createElement('label');
            item.className = 'sentence-review-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = sentence.keep;
            checkbox.addEventListener('change', () => {
                reviewedSentences[index].keep = checkbox.checked;
                renderSentences();
            });

            const text = document.createElement('span');
            text.className = 'sentence-review-text';
            text.textContent = sentence.text;

            item.append(checkbox, text);
            reviewList.append(item);
        });

        updateControls();
    }

    function collectCompletedSentences() {
        let text = input.textContent;
        let match = sentenceEndMatch(text);
        let changed = false;

        while (match) {
            const endIndex = match.index + match[0].trimEnd().length;
            const sentence = normalizeText(text.slice(0, endIndex));
            text = text.slice(endIndex).trimStart();

            if (sentence) {
                reviewedSentences.push({ text: sentence, keep: false });
                changed = true;
            }

            match = sentenceEndMatch(text);
        }

        if (changed) {
            input.textContent = text;
            renderReview();
            renderSentences();
        } else {
            updateControls();
        }

        return changed;
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

        drafts.push(text);
        reviewedSentences.length = 0;
        input.textContent = '';
        isBlackout = false;
        renderReview();
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
    renderReview();
    renderDrafts();
});
