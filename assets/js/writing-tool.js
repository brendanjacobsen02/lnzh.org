document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('writing-editor');
    const input = document.getElementById('sentence-input');
    const stream = document.getElementById('sentence-stream');
    const blackoutButton = document.getElementById('toggle-blackout');
    const copyButton = document.getElementById('copy-writing');
    const clearButton = document.getElementById('clear-writing');
    const toast = document.getElementById('writing-toast');

    if (!form || !input || !stream || !blackoutButton || !copyButton || !clearButton || !toast) {
        return;
    }

    const sentences = [];
    let isBlackout = false;
    let toastTimer;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('active');
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.classList.remove('active');
        }, 1800);
    }

    function completedText() {
        return sentences.join(' ');
    }

    function updateControls() {
        const hasSentences = sentences.length > 0;
        blackoutButton.disabled = !hasSentences;
        copyButton.disabled = !hasSentences;
        clearButton.disabled = !hasSentences;
        blackoutButton.textContent = isBlackout ? 'reveal' : 'blackout';
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

    function sentenceIsComplete(value) {
        return /[.!?]["')\]]?\s*$/.test(value.trim());
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const sentence = input.textContent.trim().replace(/\s+/g, ' ');

        if (!sentence) {
            showToast('Write a sentence first.');
            input.focus();
            return;
        }

        if (!sentenceIsComplete(sentence)) {
            showToast('End the sentence, then complete it.');
            input.focus();
            return;
        }

        sentences.push(sentence);
        input.textContent = '';
        renderSentences();
        showToast('Sentence added.');
        input.focus();
    });

    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            form.requestSubmit();
            return;
        }
    });

    input.addEventListener('paste', (event) => {
        event.preventDefault();
        const pastedText = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, pastedText);
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
            await navigator.clipboard.writeText(completedText());
            showToast('Copied.');
        } catch (error) {
            showToast('Copy failed.');
        }
    });

    clearButton.addEventListener('click', () => {
        if (sentences.length === 0) {
            return;
        }

        sentences.length = 0;
        isBlackout = false;
        renderSentences();
        showToast('Cleared.');
        input.focus();
    });

    renderSentences();
});
