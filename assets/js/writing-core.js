// Pure, DOM-free logic for the writing tool. UMD: usable as a browser
// <script> (window.WritingCore) and as a Node module (require) for tests.
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (typeof window !== 'undefined') {
        window.WritingCore = api;
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function normalizeText(value) {
        return String(value == null ? '' : value).trim().replace(/\s+/g, ' ');
    }

    function matchSentenceEnd(value) {
        return value.match(/[.!?;:]+(?:["'”’)\]]+)?(?:\s|$)/);
    }

    function extractSentences(text) {
        const sentences = [];
        let rest = String(text == null ? '' : text);
        let match = matchSentenceEnd(rest);

        while (match) {
            const endIndex = match.index + match[0].trimEnd().length;
            const sentence = normalizeText(rest.slice(0, endIndex));
            rest = rest.slice(endIndex).trimStart();
            if (sentence) {
                sentences.push(sentence);
            }
            match = matchSentenceEnd(rest);
        }

        return { sentences: sentences, remainder: rest };
    }

    function countWords(text) {
        const trimmed = normalizeText(text);
        return trimmed ? trimmed.split(' ').length : 0;
    }

    function computeStats(reviewed, currentText) {
        const list = Array.isArray(reviewed) ? reviewed : [];
        const current = normalizeText(currentText);
        const reviewedText = list.map(function (s) { return s.text; }).join(' ');
        const allText = [reviewedText, current].filter(Boolean).join(' ');
        return {
            words: countWords(allText),
            sentences: list.length + (current ? 1 : 0),
            kept: list.filter(function (s) { return s && s.keep; }).length,
        };
    }

    function pad2(n) {
        const v = Math.max(0, Math.floor(Number(n) || 0));
        return String(v).padStart(2, '0');
    }

    function serializeDrafts(drafts) {
        return JSON.stringify(Array.isArray(drafts) ? drafts : []);
    }

    function deserializeDrafts(json) {
        let data;
        try {
            data = JSON.parse(json);
        } catch (err) {
            return [];
        }
        if (!Array.isArray(data)) {
            return [];
        }
        return data
            .filter(function (d) { return d && typeof d.text === 'string'; })
            .map(function (d) {
                return {
                    id: typeof d.id === 'string' ? d.id : String(d.id || ''),
                    text: d.text,
                    createdAt: Number(d.createdAt) || 0,
                };
            });
    }

    return {
        normalizeText: normalizeText,
        matchSentenceEnd: matchSentenceEnd,
        extractSentences: extractSentences,
        countWords: countWords,
        computeStats: computeStats,
        pad2: pad2,
        serializeDrafts: serializeDrafts,
        deserializeDrafts: deserializeDrafts,
    };
});
