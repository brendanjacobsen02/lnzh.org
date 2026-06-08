# Writing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/writing/` to fit the blog's cutesy theme — quiet papery base, tech-minimalist with a light retro-arcade layer — while making the sentence tool genuinely usable (persistent drafts, export, gentle stats, whimsy).

**Architecture:** Extract the page's pure logic into a dependency-free `writing-core.js` (UMD: works as a browser `<script>` AND a Node `require`), unit-tested with Node's built-in `node:test`. `writing-tool.js` keeps all DOM wiring and consumes the core. Restyle via additive `.writing-*` rules in the shared `style.css`. All color via existing CSS variables (theme + accent picker for free). No new image assets; no new npm dependencies.

**Tech Stack:** Vanilla browser JS (classic scripts, CSP `script-src 'self'` → no inline JS/handlers), CSS custom properties, Newsreader + IBM Plex Mono (Google Fonts), `node:test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-06-09-writing-page-redesign-design.md`

---

## File Structure

- **Create** `assets/js/writing-core.js` — pure logic, no DOM. Exports `normalizeText`, `matchSentenceEnd`, `extractSentences`, `countWords`, `computeStats`, `pad2`, `serializeDrafts`, `deserializeDrafts`. UMD wrapper attaches `window.WritingCore` in the browser and `module.exports` in Node.
- **Create** `assets/js/writing-core.test.js` — `node:test` unit tests for the core (zero deps).
- **Modify** `assets/js/writing-tool.js` — consume `WritingCore`; add HUD render, localStorage persistence, export/download, per-draft actions, sparkle-on-accept, idle block cursor.
- **Modify** `writing/index.html` — load `writing-core.js` before `writing-tool.js`; add header tag, HUD element, `download` button; drafts populated by JS.
- **Modify** `assets/css/style.css` — add IBM Plex Mono to the font `@import`; restyle the `.writing-*` block (pixel grid, HUD, block cursor, boxy buttons, drafts + per-draft actions).

**Conventions (from AGENTS.md):** 4-space indent; no `innerHTML` for draft/localStorage data — use `textContent` / `append` / `createElement`; no inline event handlers (CSP) — use `addEventListener`; plain browser APIs only.

---

## Task 1: Pure-logic core module (`writing-core.js`) + tests

**Files:**
- Create: `assets/js/writing-core.js`
- Create: `assets/js/writing-core.test.js`

- [ ] **Step 1: Write the failing test**

Create `assets/js/writing-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const core = require('./writing-core.js');

test('normalizeText trims and collapses whitespace', () => {
    assert.equal(core.normalizeText('  hi   there \n'), 'hi there');
    assert.equal(core.normalizeText(''), '');
});

test('extractSentences splits on terminal punctuation, keeps remainder', () => {
    const r = core.extractSentences('One sentence. Two now! A third? leftover');
    assert.deepEqual(r.sentences, ['One sentence.', 'Two now!', 'A third?']);
    assert.equal(r.remainder, 'leftover');
});

test('extractSentences keeps closing quotes/brackets with the sentence', () => {
    const r = core.extractSentences('He said "hi." Next');
    assert.deepEqual(r.sentences, ['He said "hi."']);
    assert.equal(r.remainder, 'Next');
});

test('extractSentences returns no sentences when none are complete', () => {
    const r = core.extractSentences('still writing');
    assert.deepEqual(r.sentences, []);
    assert.equal(r.remainder, 'still writing');
});

test('countWords counts whitespace-separated tokens', () => {
    assert.equal(core.countWords('one two three'), 3);
    assert.equal(core.countWords('  spaced   out  '), 2);
    assert.equal(core.countWords(''), 0);
});

test('computeStats reports words, sentences (incl. in-progress), kept', () => {
    const reviewed = [
        { text: 'Kept one.', keep: true },
        { text: 'Cut this.', keep: false },
    ];
    const s = core.computeStats(reviewed, 'in progress');
    assert.equal(s.sentences, 3);          // 2 reviewed + 1 in-progress
    assert.equal(s.kept, 1);
    assert.equal(s.words, 6);              // "Kept one. Cut this. in progress"
});

test('computeStats with empty input is all zeros', () => {
    assert.deepEqual(core.computeStats([], ''), { words: 0, sentences: 0, kept: 0 });
});

test('pad2 zero-pads non-negative integers', () => {
    assert.equal(core.pad2(0), '00');
    assert.equal(core.pad2(7), '07');
    assert.equal(core.pad2(42), '42');
    assert.equal(core.pad2(-3), '00');
});

test('serialize/deserialize drafts round-trips and rejects junk', () => {
    const drafts = [{ id: 'a', text: 'hello', createdAt: 123 }];
    assert.deepEqual(core.deserializeDrafts(core.serializeDrafts(drafts)), drafts);
    assert.deepEqual(core.deserializeDrafts('not json'), []);
    assert.deepEqual(core.deserializeDrafts('{"x":1}'), []);   // not an array
    // drops entries without string text, coerces fields
    assert.deepEqual(
        core.deserializeDrafts('[{"text":"ok"},{"nope":1}]'),
        [{ id: '', text: 'ok', createdAt: 0 }]
    );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test assets/js/writing-core.test.js`
Expected: FAIL — `Cannot find module './writing-core.js'`.

- [ ] **Step 3: Write the implementation**

Create `assets/js/writing-core.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test assets/js/writing-core.test.js`
Expected: PASS — all tests pass (`# pass 9`).

- [ ] **Step 5: Run the JS syntax check**

Run: `for f in assets/js/*.js; do node --check "$f" || exit 1; done`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add assets/js/writing-core.js assets/js/writing-core.test.js
git commit -m "Add dependency-free writing-core logic module + tests"
```

---

## Task 2: Consume the core in `writing-tool.js` (behavior parity)

Refactor the existing logic to call `WritingCore` instead of its inline copies, with **no behavior change yet**. This isolates the refactor from the new features.

**Files:**
- Modify: `writing/index.html` (add the core `<script>` before `writing-tool.js`)
- Modify: `assets/js/writing-tool.js`

- [ ] **Step 1: Load the core before the tool in the page head**

In `writing/index.html`, the head currently ends with:

```html
    <script src="../assets/js/nav-dropdown.js"></script>
    <script src="../assets/js/theme-toggle.js"></script>
    <script src="../assets/js/writing-tool.js" defer></script>
```

Change to add the core (defer keeps execution order, before `writing-tool.js`):

```html
    <script src="../assets/js/nav-dropdown.js"></script>
    <script src="../assets/js/theme-toggle.js"></script>
    <script src="../assets/js/writing-core.js" defer></script>
    <script src="../assets/js/writing-tool.js" defer></script>
```

- [ ] **Step 2: Use the core inside `writing-tool.js`**

At the top of the `DOMContentLoaded` callback in `assets/js/writing-tool.js`, add a reference and remove the now-duplicated local helpers (`normalizeText`, `sentenceEndMatch`) and the inline sentence loop in `collectCompletedSentences`.

Add near the top of the callback (after the element lookups):

```js
    const core = window.WritingCore;
```

Delete the local `normalizeText` function (lines defining `function normalizeText(value) {...}`) and the local `sentenceEndMatch` function. Replace every call to `normalizeText(x)` with `core.normalizeText(x)` and every `sentenceEndMatch(x)` with `core.matchSentenceEnd(x)`.

Replace the body of `collectCompletedSentences` with a core-based version:

```js
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
```

- [ ] **Step 3: Syntax check**

Run: `for f in assets/js/*.js; do node --check "$f" || exit 1; done`
Expected: exit 0, no output.

- [ ] **Step 4: Manual browser verification (parity)**

Run: `python3 -m http.server 8000` and open `http://localhost:8000/writing/`.
Verify (unchanged behavior): typing `Hello world.` turns it into a kept/pending fragment; accept/reject popover works with "confirm sentence" on; blackout toggle still redacts; "complete draft" stores a draft below; copy works.

- [ ] **Step 5: Commit**

```bash
git add writing/index.html assets/js/writing-tool.js
git commit -m "Wire writing-tool to writing-core (no behavior change)"
```

---

## Task 3: Visual restyle — fonts, paper, pixel grid, boxy controls, cursor

Pure presentation. No new behavior.

**Files:**
- Modify: `assets/css/style.css`
- Modify: `writing/index.html` (header tag markup)

- [ ] **Step 1: Add IBM Plex Mono to the font import**

In `assets/css/style.css`, line 2 is currently:

```css
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
```

Replace with (adds IBM Plex Mono; one network import):

```css
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
```

- [ ] **Step 2: Add a mono chrome token**

In `:root` (after the `--accent` line, ~line 23 in `style.css`) add:

```css
    --mono: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
```

- [ ] **Step 3: Add the header tag markup**

In `writing/index.html`, replace the intro header:

```html
        <header class="intro">
            <h1>Writing</h1>
        </header>
```

with:

```html
        <header class="intro">
            <h1>Writing</h1>
            <p class="writing-tag">sentence by sentence</p>
        </header>
```

- [ ] **Step 4: Replace the `.writing-*` style block**

In `assets/css/style.css`, replace the existing `.sentence-stream` rule and add the new chrome rules. Append this block (it overrides/extends the existing `.writing-*` rules; keep existing rules that are not contradicted):

```css
/* ---- Writing page: tech-minimalist + light retro-arcade ---- */
.writing-tag {
    font-family: var(--mono);
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0.1rem 0 0;
}

.sentence-stream {
    min-height: 13rem;
    padding: 1.25rem 1.35rem;
    border: 1px solid rgba(var(--text-rgb), 0.22);
    background:
        linear-gradient(var(--paper-raised), var(--paper-raised)) padding-box,
        repeating-linear-gradient(0deg, rgba(var(--text-rgb), 0.035) 0 1px, transparent 1px 9px),
        repeating-linear-gradient(90deg, rgba(var(--text-rgb), 0.035) 0 1px, transparent 1px 9px);
    line-height: 1.75;
    white-space: normal;
    cursor: text;
    box-shadow: inset 0 1px 0 var(--inset-highlight);
    caret-color: var(--link);
}

/* Idle "ready" block cursor — shown only when the editor is empty */
.sentence-stream:not(.has-sentences) .sentence-input-inline:empty::after {
    content: "";
    display: inline-block;
    width: 0.5em;
    height: 1.02em;
    margin-left: 1px;
    vertical-align: -2px;
    background: var(--link);
    animation: writingBlink 1.05s steps(1) infinite;
}

@keyframes writingBlink {
    50% { opacity: 0; }
}

/* HUD scoreboard */
.writing-hud {
    font-family: var(--mono);
    font-size: 0.72rem;
    letter-spacing: 0.05em;
    color: var(--muted);
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
}

.writing-hud b {
    color: var(--link);
    font-weight: 600;
}

/* Boxy arcade controls */
.writing-actions .filter-btn,
.settings-toggle {
    font-family: var(--mono);
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: lowercase;
    box-shadow: 2px 2px 0 rgba(var(--shadow-rgb), 0.14);
}

.writing-actions .filter-btn:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 rgba(var(--shadow-rgb), 0.14);
}

/* Drafts list chrome */
.completed-drafts h2,
.completed-draft-label,
.draft-actions button {
    font-family: var(--mono);
}

.completed-draft-label {
    font-size: 0.66rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--faint);
}

.draft-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.4rem;
}

.draft-actions button {
    font-size: 0.66rem;
    letter-spacing: 0.04em;
    padding: 0.2rem 0.45rem;
    border: 1px solid rgba(var(--text-rgb), 0.3);
    background: transparent;
    color: var(--text);
    cursor: pointer;
}

.draft-actions button:hover {
    opacity: 0.65;
}

/* Sparkle that pops when a sentence is kept */
.writing-sparkle {
    position: fixed;
    z-index: 25;
    color: var(--link);
    pointer-events: none;
    font-size: 1rem;
    animation: writingSparkle 0.7s ease-out forwards;
}

@keyframes writingSparkle {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
    35% { opacity: 1; transform: translate(-50%, -90%) scale(1.15); }
    100% { opacity: 0; transform: translate(-50%, -150%) scale(0.9); }
}
```

- [ ] **Step 5: Quiet the new animations under reduced motion**

The existing `@media (prefers-reduced-motion: reduce)` block (end of `style.css`) already sets `* { transition-duration: 0.01ms !important; }` but does NOT cover `animation`. Add an `animation` neutralizer inside that media query's `*` rule:

```css
    * {
        transition-duration: 0.01ms !important;
        transition-delay: 0ms !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
    }
```

- [ ] **Step 6: Manual browser verification (look & feel, both themes)**

Reload `/writing/`. Verify: header shows the mono `sentence by sentence` tag; writing box shows the faint pixel grid; caret is accent-colored; an empty editor shows the blinking block cursor; buttons are boxy with an offset shadow and depress on click. Toggle dark mode (and each accent via the gear) — grid, caret, and accents recolor correctly with good contrast.

- [ ] **Step 7: Commit**

```bash
git add assets/css/style.css writing/index.html
git commit -m "Restyle writing page: mono chrome, pixel grid, boxy controls, block cursor"
```

---

## Task 4: Live HUD stats

**Files:**
- Modify: `writing/index.html` (add the HUD element)
- Modify: `assets/js/writing-tool.js`

- [ ] **Step 1: Add the HUD element to the markup**

In `writing/index.html`, inside `<form class="writing-editor" ...>`, immediately after the closing `</div>` of `sentence-stream` and before `<div class="writing-settings">`, add:

```html
                    <div class="writing-hud" id="writing-hud" aria-live="off">
                        <span>words <b id="hud-words">00</b></span>
                        <span>sentences <b id="hud-sentences">00</b></span>
                        <span>kept <b id="hud-kept">00</b></span>
                    </div>
```

- [ ] **Step 2: Reference HUD nodes and add a render function**

In `assets/js/writing-tool.js`, add to the element lookups near the top:

```js
    const hudWords = document.getElementById('hud-words');
    const hudSentences = document.getElementById('hud-sentences');
    const hudKept = document.getElementById('hud-kept');
```

Add these to the existing null-guard `if (...)` block so the tool still bails cleanly if markup is missing: append `|| !hudWords || !hudSentences || !hudKept` to the condition.

Add a render function (near `updateControls`):

```js
    function renderStats() {
        const stats = core.computeStats(reviewedSentences, input.textContent);
        hudWords.textContent = core.pad2(stats.words);
        hudSentences.textContent = core.pad2(stats.sentences);
        hudKept.textContent = core.pad2(stats.kept);
    }
```

- [ ] **Step 3: Call `renderStats` wherever state changes**

Call `renderStats()` at the end of `updateControls()` (runs on every input/render), so it stays in sync:

```js
    function updateControls() {
        const hasText = draftText().length > 0;
        copyButton.disabled = !hasText;
        renderStats();
    }
```

- [ ] **Step 4: Syntax check**

Run: `for f in assets/js/*.js; do node --check "$f" || exit 1; done`
Expected: exit 0.

- [ ] **Step 5: Manual browser verification**

Reload `/writing/`. Type `Hello there. A second one!` and a few trailing words — verify `words`, `sentences`, and `kept` update live and are zero-padded (e.g. `words 06`). Accept/reject a sentence and confirm `kept` changes.

- [ ] **Step 6: Commit**

```bash
git add writing/index.html assets/js/writing-tool.js
git commit -m "Add live zero-padded HUD stats to writing page"
```

---

## Task 5: Persistent drafts (localStorage) + per-draft delete

**Files:**
- Modify: `assets/js/writing-tool.js`

- [ ] **Step 1: Migrate the drafts model to objects + add storage helpers**

The current `drafts` array holds strings; change it to hold `{ id, text, createdAt }`. Near the top of the callback add the storage key and helpers:

```js
    const DRAFTS_KEY = 'lnzh.writing.drafts';

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
```

Change the `drafts` declaration from `const drafts = [];` to:

```js
    const drafts = loadDrafts();
```

- [ ] **Step 2: Update `renderDrafts` for the object model (DOM nodes only)**

Replace `renderDrafts` with a version that reads `draft.text`, numbers entries with `pad2`, and renders via `createElement`/`textContent` (NO `innerHTML`, per AGENTS.md). Delete buttons get an `addEventListener` (no inline handlers, per CSP):

```js
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

            actions.append(deleteButton);
            draftElement.append(label, text, actions);
            draftList.prepend(draftElement);
        });
    }
```

- [ ] **Step 3: Push an object (not a string) on completion + persist**

In the `form` submit handler, replace `drafts.push(text);` with:

```js
        drafts.push({ id: makeDraftId(), text: text, createdAt: Date.now() });
        saveDrafts();
```

- [ ] **Step 4: Syntax check**

Run: `for f in assets/js/*.js; do node --check "$f" || exit 1; done`
Expected: exit 0.

- [ ] **Step 5: Manual browser verification (persistence is the key check)**

Reload `/writing/`. Write `First draft.` → complete draft. Write `Second draft.` → complete draft. Confirm both appear (newest on top, labelled `draft 01`, `draft 02`). **Reload the page** — both drafts must still be there. Click `delete` on one — it disappears and stays gone after another reload.

- [ ] **Step 6: Commit**

```bash
git add assets/js/writing-tool.js
git commit -m "Persist writing drafts to localStorage; add per-draft delete"
```

---

## Task 6: Export (download) + per-draft copy/download + sparkle whimsy

**Files:**
- Modify: `writing/index.html` (add `download` button)
- Modify: `assets/js/writing-tool.js`

- [ ] **Step 1: Add the `download` action button**

In `writing/index.html`, in `<div class="writing-actions">`, after the copy button, add:

```html
                        <button class="filter-btn" type="button" id="download-writing" disabled>download</button>
```

- [ ] **Step 2: Add a download helper and wire the current-draft button**

In `assets/js/writing-tool.js`, add a reusable text-download helper:

```js
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
```

Add the element lookup `const downloadButton = document.getElementById('download-writing');` and append `|| !downloadButton` to the null-guard `if`. In `updateControls`, also gate it:

```js
        copyButton.disabled = !hasText;
        downloadButton.disabled = !hasText;
```

Wire it (near the copy handler):

```js
    downloadButton.addEventListener('click', () => {
        const text = draftText();
        if (!text) {
            return;
        }
        downloadText('writing-draft.txt', text);
        showToast('Downloaded.');
    });
```

- [ ] **Step 3: Add copy + download buttons to each saved draft**

In `renderDrafts` (from Task 5), inside the `forEach`, add two more buttons to `actions` BEFORE the delete button:

```js
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
```

and change the append line to:

```js
            actions.append(copyDraftButton, downloadDraftButton, deleteButton);
```

- [ ] **Step 4: Sparkle on accept**

Add a sparkle spawner and call it when a sentence is kept. Add the helper:

```js
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
```

In `acceptSentenceButton`'s click handler, before `renderSentences()`, capture the popover position and spawn:

```js
        const rect = keepPopover.getBoundingClientRect();
        spawnSparkle(rect.left + rect.width / 2, rect.top);
```

Also spawn for the auto-keep path: in the `form` submit handler, when a draft is stored, spawn near the complete button is optional — keep sparkle tied to per-sentence accept only (matches the mockup).

- [ ] **Step 5: Syntax check**

Run: `for f in assets/js/*.js; do node --check "$f" || exit 1; done`
Expected: exit 0.

- [ ] **Step 6: Manual browser verification**

Reload `/writing/`. With text present, `download` saves `writing-draft.txt` with the right contents; `copy` still works. Each saved draft has `copy` / `download` / `delete` — verify `download` yields `draft-01.txt` etc. With "confirm sentence" on, accepting a sentence pops a ✦ sparkle near the popover. Enable OS "reduce motion" → sparkle no longer animates/appears.

- [ ] **Step 7: Commit**

```bash
git add writing/index.html assets/js/writing-tool.js
git commit -m "Add draft export (download), per-draft actions, sparkle-on-accept"
```

---

## Task 7: Final verification pass

**Files:** none (verification only; fix-forward commits if issues found).

- [ ] **Step 1: Full unit + syntax run**

Run: `node --test assets/js/writing-core.test.js`
Expected: all pass.
Run: `for f in assets/js/*.js; do node --check "$f" || exit 1; done`
Expected: exit 0.

- [ ] **Step 2: `innerHTML` audit on the changed file**

Run: `grep -n "innerHTML" assets/js/writing-tool.js`
Expected: no matches (draft/localStorage data must render via DOM nodes).

- [ ] **Step 3: Asset/404 + theme sweep**

Serve (`python3 -m http.server 8000`), open `/writing/`, open devtools Network + Console. Verify: no 404s, no console errors, IBM Plex Mono loads. Exercise the full flow (type → accept/reject → stats → complete → reload persists → copy/download/delete). Toggle light/dark and cycle every accent — confirm grid, caret, HUD numerals, sparkle, and buttons recolor with legible contrast.

- [ ] **Step 4: Reduced-motion sweep**

With OS reduce-motion on: theme toggle is instant, the block cursor/sparkle don't animate, no involuntary motion.

- [ ] **Step 5: Commit any fixes, then push the branch**

```bash
git status --short          # confirm only intended files
git push -u origin feat/writing-page-redesign
```

---

## Self-Review (completed)

- **Spec coverage:** fonts (T3), accent/theme via variables (T3/T7), pixel grid + block cursor + boxy controls + sparkle (T3/T6), HUD stats (T4), persistent drafts (T5), export/download + per-draft actions (T6), no-`innerHTML` rule (T5 + T7 audit), reduced-motion (T3/T6/T7), no new image assets (none added), branch hygiene (T7). Block-cursor caveat honored: caret tinted + idle-only block (T3).
- **Placeholder scan:** none — every code step has complete code; every run step has an exact command + expected output.
- **Type/name consistency:** `WritingCore` API names (`extractSentences`, `computeStats`, `pad2`, `serializeDrafts`, `deserializeDrafts`) are identical between Task 1's definition and their use in Tasks 2/4/5. `drafts` is objects `{id,text,createdAt}` from Task 5 onward; `renderDrafts` is defined once (T5) then extended (T6) consistently; `downloadText`/`spawnSparkle` defined before use.
```
