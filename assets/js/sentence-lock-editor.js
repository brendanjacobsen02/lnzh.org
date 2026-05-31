document.addEventListener('DOMContentLoaded', function() {
    const draft = document.getElementById('sentence-draft');
    const lockedList = document.getElementById('locked-sentences');
    const showLockedToggle = document.getElementById('show-locked-toggle');
    const confirmLockToggle = document.getElementById('confirm-lock-toggle');
    const finishButton = document.getElementById('finish-session-btn');
    const copyButton = document.getElementById('copy-session-btn');
    const newButton = document.getElementById('new-session-btn');
    const status = document.getElementById('sentence-status');

    if (!draft || !lockedList) return;

    const terminalMarks = new Set(['.', '!', '?', '。', '！', '？']);
    const closers = new Set(['"', "'", '”', '’', ')', ']', '}', '»']);
    const commonAbbreviations = new Set([
        'mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'ft',
        'vs', 'etc', 'e.g', 'i.e', 'fig', 'no', 'vol', 'dept', 'inc', 'ltd',
        'co', 'corp', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep',
        'sept', 'oct', 'nov', 'dec', 'a.m', 'p.m', 'u.s', 'u.k'
    ]);

    let lockedSentences = [];
    let sessionComplete = false;
    let declinedCandidate = '';

    function getWordBefore(text, index) {
        const before = text.slice(0, index).match(/([A-Za-z](?:[A-Za-z]|\.)*)\.?$/);
        return before ? before[1].toLowerCase() : '';
    }

    function isDecimalPoint(text, index) {
        return /\d/.test(text[index - 1] || '') && /\d/.test(text[index + 1] || '');
    }

    function isPendingNumber(text, index) {
        return /\d/.test(text[index - 1] || '') && !text[index + 1];
    }

    function isUrlOrEmail(text, index) {
        const start = Math.max(0, index - 24);
        const end = Math.min(text.length, index + 24);
        const fragment = text.slice(start, end);
        return /(?:https?:\/\/|www\.)\S*$/i.test(text.slice(start, index + 1)) ||
            /\S+@\S*\.\S*/.test(fragment) ||
            /\b[A-Za-z0-9-]+\.(?:com|org|net|edu|gov|io|co|app|dev)\b/i.test(fragment);
    }

    function isAbbreviation(text, index) {
        const word = getWordBefore(text, index);
        if (!word) return false;
        if (commonAbbreviations.has(word)) return true;
        if (/^(?:[a-z]\.){1,}[a-z]?$/i.test(word)) return true;
        if (/^[A-Z]$/.test(text[index - 1] || '')) return true;
        return false;
    }

    function isEllipsis(text, index) {
        return text.slice(index, index + 3) === '...' ||
            text.slice(index - 1, index + 2) === '...' ||
            text.slice(index - 2, index + 1) === '...';
    }

    function isTerminalAt(text, index) {
        const char = text[index];
        if (!terminalMarks.has(char)) return false;
        if (char === '.' && (isDecimalPoint(text, index) || isPendingNumber(text, index) || isUrlOrEmail(text, index) || isAbbreviation(text, index))) {
            return false;
        }
        return true;
    }

    function sentenceEndFrom(text, terminalIndex) {
        let index = terminalIndex + 1;
        while (terminalMarks.has(text[index]) || closers.has(text[index])) index += 1;
        return index;
    }

    function canLockAt(text, endIndex) {
        if (endIndex >= text.length) return true;
        return /\s/.test(text[endIndex]);
    }

    function findCompletedSentences(text) {
        const completed = [];
        let start = 0;
        let index = 0;

        while (index < text.length) {
            if (isTerminalAt(text, index)) {
                const end = sentenceEndFrom(text, index);
                if (canLockAt(text, end)) {
                    const sentence = text.slice(start, end).trim();
                    if (sentence) completed.push(sentence);
                    start = end;
                    while (/\s/.test(text[start] || '')) start += 1;
                    index = start;
                    continue;
                }
            }
            index += 1;
        }

        return {
            completed: completed,
            rest: text.slice(start).replace(/^\s+/, '')
        };
    }

    function renderLocked() {
        lockedList.replaceChildren();
        lockedSentences.forEach((sentence, index) => {
            const p = document.createElement('p');
            p.className = 'locked-sentence';
            p.textContent = sentence;
            p.dataset.index = index + 1;
            lockedList.appendChild(p);
        });
        lockedList.hidden = !sessionComplete && !showLockedToggle.checked;
        status.textContent = `${lockedSentences.length} locked${sessionComplete ? ' · session complete' : ''}`;
    }

    function lockSentences(sentences) {
        let acceptedCount = 0;
        let stopped = false;

        sentences.forEach((sentence) => {
            if (stopped) return;
            if (confirmLockToggle.checked) {
                if (sentence === declinedCandidate) {
                    stopped = true;
                    return;
                }
                const shouldLock = window.confirm(`Lock this sentence?\n\n${sentence}`);
                if (!shouldLock) {
                    declinedCandidate = sentence;
                    stopped = true;
                    return;
                }
            }
            lockedSentences.push(sentence);
            acceptedCount += 1;
        });

        if (acceptedCount > 0) {
            declinedCandidate = '';
            renderLocked();
        }

        return acceptedCount;
    }

    function processDraft() {
        if (sessionComplete) return;
        const parsed = findCompletedSentences(draft.value);
        if (parsed.completed.length === 0) return;

        const lockedCount = lockSentences(parsed.completed);
        if (lockedCount === parsed.completed.length) {
            draft.value = parsed.rest;
        } else if (lockedCount > 0) {
            draft.value = parsed.completed.slice(lockedCount).concat(parsed.rest ? [parsed.rest] : []).join(' ');
        }
    }

    function completeSession() {
        const text = draft.value.trim();
        if (text) {
            if (!confirmLockToggle.checked || window.confirm(`Lock the remaining text and complete the session?\n\n${text}`)) {
                lockedSentences.push(text);
                draft.value = '';
            } else {
                return;
            }
        }
        sessionComplete = true;
        draft.disabled = true;
        showLockedToggle.checked = true;
        renderLocked();
    }

    async function copySession() {
        const text = lockedSentences.concat(draft.value.trim() ? [draft.value.trim()] : []).join('\n\n');
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);
            status.textContent = 'copied';
            setTimeout(renderLocked, 900);
        } catch {
            draft.focus();
            draft.select();
        }
    }

    function newSession() {
        if ((lockedSentences.length > 0 || draft.value.trim()) && !window.confirm('Start a new empty session?')) return;
        lockedSentences = [];
        sessionComplete = false;
        declinedCandidate = '';
        draft.disabled = false;
        draft.value = '';
        renderLocked();
        draft.focus();
    }

    draft.addEventListener('input', processDraft);
    draft.addEventListener('paste', function() {
        window.setTimeout(processDraft, 0);
    });
    showLockedToggle.addEventListener('change', renderLocked);
    finishButton.addEventListener('click', completeSession);
    copyButton.addEventListener('click', copySession);
    newButton.addEventListener('click', newSession);

    renderLocked();
});
