# Nav 4-star "Bouncy Wave" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the clunky `rotate(180deg) scale(1.1)` 4-star toggle spin with a springy left→right "Bouncy Wave" across the four stars, add an idle hint + hover preview and a bounce-in menu reveal, and fix the sidebar clipping bug.

**Architecture:** Progressive enhancement. `assets/js/nav-dropdown.js` (loads on every page) replaces the existing `<img class="nav-dropdown-toggle" src=".../4star.png">` at runtime with a flex row of four `<span class="nav-star">` that each show one quarter of the strip via `background-position` slicing — so each star animates independently. All motion is CSS keyframes keyed off the existing `.dropdown-trigger.active` class. Net surface: **two files** (`nav-dropdown.js`, `style.css`) plus one persistent dev harness. No HTML edits, no new image assets.

**Tech Stack:** Vanilla JS, CSS animations. Static site, no build step for these files, no JS test runner — the DOM-shape test is a persistent browser harness under `dev/` (matching `dev/critters.html`, `dev/drawn-kit.html`).

**Worktree:** All work happens in `/Users/lz/Documents/lnzh-nav-bounce` (branch `feat/nav-4star-bounce`, off `origin/main`). Do **not** edit the shared checkout at `/Users/lz/Documents/lnzh`.

**Spec:** `docs/superpowers/specs/2026-06-09-nav-4star-bounce-design.md`

---

## File Structure

- **Modify** `assets/js/nav-dropdown.js` — add `enhanceStarToggle(trigger)`; call it per nav trigger; suppress the open-bounce during the initial expanded-by-default restore.
- **Modify** `assets/css/style.css` — slice styles; bounce / idle / hover / menu-bounce keyframes; remove the old rotate rule; overflow fix.
- **Create** `dev/nav-star-test.html` — persistent browser harness asserting the slice DOM.

All paths below are relative to the worktree root `/Users/lz/Documents/lnzh-nav-bounce`.

---

## Task 1: Static 4-slice toggle (JS + CSS) + DOM harness

Replace the toggle `<img>` with four background-sliced `<span>`s that look identical to today's static strip. Remove the old rotate rule. No new animation yet.

**Files:**
- Modify: `assets/js/nav-dropdown.js` (add function + call site)
- Modify: `assets/css/style.css:240-251` (replace toggle + rotate rules)
- Create: `dev/nav-star-test.html`

- [ ] **Step 1: Write the failing test (DOM harness)**

Create `dev/nav-star-test.html`:

```html
<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<title>nav-star toggle — DOM harness</title>
<link rel="stylesheet" href="../assets/css/style.css">
<style>
  body{padding:2rem;font-family:system-ui}
  #report{margin-top:1rem;font:14px/1.7 ui-monospace,monospace;white-space:pre}
  .pass{color:#1a7f37}.fail{color:#c00;font-weight:bold}
</style>
</head>
<body>
  <!-- minimal nav so enhanceStarToggle() has a target to upgrade -->
  <nav>
    <ul>
      <li class="dropdown-trigger">
        <img src="../assets/images/ui/4star.png" alt="more" class="nav-dropdown-toggle">
      </li>
      <li class="dropdown-content" style="display:none">
        <ul class="dropdown-list">
          <li class="dropdown-item"><a href="#">blog</a></li>
        </ul>
      </li>
    </ul>
  </nav>

  <h1>nav-star toggle — DOM harness</h1>
  <p>Loads the real <code>nav-dropdown.js</code> and checks the 4-star toggle gets sliced.
     Open in a browser; every line should be green.</p>
  <div id="report">running…</div>

  <script src="../assets/js/nav-dropdown.js"></script>
  <script>
    const check = (name, cond) => ({name, ok: !!cond});
    window.addEventListener('load', () => setTimeout(() => {
      const trigger = document.querySelector('.dropdown-trigger');
      const star = trigger.querySelector('.nav-dropdown-toggle');
      const slices = trigger.querySelectorAll('.nav-star');
      const aspect = star && getComputedStyle(star).getPropertyValue('--star-aspect').trim();
      const src = star && getComputedStyle(star).getPropertyValue('--star-src');
      const results = [
        check('toggle is a sliced container (.fourstar)', star && star.classList.contains('fourstar')),
        check('original <img> was replaced', !trigger.querySelector('img.nav-dropdown-toggle')),
        check('has exactly 4 .nav-star slices', slices.length === 4),
        check('slices indexed --i 0..3', [...slices].every((s,i) => s.style.getPropertyValue('--i').trim() === String(i))),
        check('role=img preserved', star && star.getAttribute('role') === 'img'),
        check('aria-label = "more"', star && star.getAttribute('aria-label') === 'more'),
        check('--star-src points at 4star', src && src.includes('4star')),
        check('--star-aspect is a positive number', aspect && parseFloat(aspect) > 0),
      ];
      const report = document.getElementById('report');
      const failed = results.filter(r => !r.ok).length;
      report.innerHTML = results.map(r =>
        `<span class="${r.ok ? 'pass' : 'fail'}">${r.ok ? '✓ PASS' : '✗ FAIL'}  ${r.name}</span>`).join('\n')
        + `\n\n${failed ? '✗ ' + failed + ' FAILED' : '✓ all ' + results.length + ' checks passed'}`;
      console[failed ? 'error' : 'log'](`nav-star harness: ${results.length - failed}/${results.length} passed`);
    }, 200));
  </script>
</body>
</html>
```

- [ ] **Step 2: Run the harness to verify it fails**

Run: `open dev/nav-star-test.html`
Expected: report shows **✗ FAIL** lines (no `.fourstar`, 0 slices) because `enhanceStarToggle` doesn't exist yet.

- [ ] **Step 3: Add `enhanceStarToggle()` to `nav-dropdown.js`**

Insert this function just **above** `function initCursorSprite() {` (near the end, top-level scope):

```javascript
// Replace the single 4-star <img> toggle with four background-sliced <span>s so
// each star can animate on its own. --star-src / --star-aspect are read from the
// source PNG, keeping the toggle asset-swappable (e.g. four hand-drawn stars later).
function enhanceStarToggle(trigger) {
    const img = trigger.querySelector('img.nav-dropdown-toggle');
    if (!img) return;

    const src = img.getAttribute('src');
    const label = img.getAttribute('alt') || 'more';

    const star = document.createElement('span');
    star.className = 'nav-dropdown-toggle fourstar';
    star.setAttribute('role', 'img');
    star.setAttribute('aria-label', label);
    star.style.setProperty('--star-src', `url("${src}")`);
    star.style.setProperty('--star-aspect', '2.2419'); // fallback until natural size is known

    for (let i = 0; i < 4; i++) {
        const slice = document.createElement('span');
        slice.className = 'nav-star';
        slice.style.setProperty('--i', i);
        star.appendChild(slice);
    }

    img.replaceWith(star);

    // Refine the aspect ratio from the real asset so sizing survives a redraw.
    const probe = new Image();
    probe.onload = () => {
        if (probe.naturalWidth && probe.naturalHeight) {
            star.style.setProperty('--star-aspect', (probe.naturalWidth / probe.naturalHeight).toFixed(4));
        }
    };
    probe.src = src;
}
```

- [ ] **Step 4: Call it for each nav trigger**

In `nav-dropdown.js`, inside `dropdownTriggers.forEach((dropdownTrigger, index) => {`, make the **first line** of the callback enhance the toggle. Change:

```javascript
    dropdownTriggers.forEach((dropdownTrigger, index) => {
        const dropdownContent = dropdownTrigger.nextElementSibling;
```

to:

```javascript
    dropdownTriggers.forEach((dropdownTrigger, index) => {
        enhanceStarToggle(dropdownTrigger);
        const dropdownContent = dropdownTrigger.nextElementSibling;
```

- [ ] **Step 5: Replace the toggle CSS + delete the rotate rule**

In `assets/css/style.css`, replace the block at lines 240–251:

```css
.nav-dropdown-toggle {
    width: auto;
    height: 1.25rem;
    display: block;
    object-fit: contain;
    object-position: left center;
    transition: transform 0.6s cubic-bezier(0.68, -0.4, 0.265, 1.35);
}

.dropdown-trigger.active .nav-dropdown-toggle {
    transform: rotate(180deg) scale(1.1);
}
```

with:

```css
/* 4-star dropdown toggle. nav-dropdown.js swaps the <img> for a flex row of four
   background-sliced <span class="nav-star">, so each star animates on its own.
   --star-src / --star-aspect are set by the JS from the source PNG (asset-swappable,
   like the .drawn-* kit). The bare-<img> rules below are the no-JS fallback. */
.nav-dropdown-toggle {
    height: 1.25rem;
    width: auto;
    display: block;
    object-fit: contain;
    object-position: left center;
}

.fourstar.nav-dropdown-toggle {
    display: flex;
    width: calc(1.25rem * var(--star-aspect, 2.2419));
}

.nav-star {
    flex: 1;
    height: 100%;
    background-image: var(--star-src);
    background-repeat: no-repeat;
    background-size: 400% 100%;                         /* strip = 4× one slice */
    background-position-x: calc(var(--i) * 33.3333%);   /* 0 / 33.33 / 66.67 / 100% */
    background-position-y: center;
    transform-origin: bottom center;
}
```

- [ ] **Step 6: Run the harness to verify it passes**

Run: `open dev/nav-star-test.html`
Expected: **✓ all 8 checks passed** (all green). Console logs `nav-star harness: 8/8 passed`.

- [ ] **Step 7: Eyeball the real site**

Run: `open index.html`
Expected: the four stars render as before (static), correctly sized at the sidebar's left. Clicking the stars still opens/closes the menu. No spin on open (rotate removed). No clipping change yet.

- [ ] **Step 8: Commit**

```bash
git -C /Users/lz/Documents/lnzh-nav-bounce add assets/js/nav-dropdown.js assets/css/style.css dev/nav-star-test.html
git -C /Users/lz/Documents/lnzh-nav-bounce commit -m "$(printf 'Nav 4-star: slice toggle into 4 animatable stars\n\nReplace the <img> toggle with four background-sliced spans at runtime;\nremove the old rotate(180)+scale spin. Adds a dev DOM harness.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 2: Open animation — Bouncy Wave (Springy)

Add the springy squash-and-stretch hop, staggered left→right on open.

**Files:**
- Modify: `assets/css/style.css` (add after the `.nav-star` rule from Task 1)

- [ ] **Step 1: Add the bounce keyframes + animation**

Immediately after the `.nav-star { … }` rule, add:

```css
/* Open: a springy squash-and-stretch hop rippling left→right across the stars. */
@keyframes navStarBounce {
    0%   { transform: translateY(0)     scaleY(1); }
    28%  { transform: translateY(-10px) scaleY(1.18); }
    52%  { transform: translateY(0)     scaleY(0.8); }
    72%  { transform: translateY(-3px)  scaleY(1.07); }
    100% { transform: translateY(0)     scaleY(1); }
}

.dropdown-trigger.active .nav-star {
    animation: navStarBounce 0.56s cubic-bezier(0.3, 1.2, 0.5, 1) backwards;
    animation-delay: calc(var(--i) * 70ms);
}
```

- [ ] **Step 2: Verify in the browser**

Run: `open index.html`
Expected: clicking the stars to open plays a left→right bouncy wave (star 0 first, star 3 last, ~70 ms apart); they squash/stretch and settle. Closing then re-opening **re-fires** the bounce each time. (Initial page load may auto-play once — fixed in Task 5.)

- [ ] **Step 3: Commit**

```bash
git -C /Users/lz/Documents/lnzh-nav-bounce add assets/css/style.css
git -C /Users/lz/Documents/lnzh-nav-bounce commit -m "$(printf 'Nav 4-star: springy left-to-right bounce on open\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 3: Bounce-in menu reveal

Replace the menu items' slide-in with a small matching bounce.

**Files:**
- Modify: `assets/css/style.css:405-457` (the `.dropdown-item` slide + nth-child transition delays)

- [ ] **Step 1: Replace the slide rules with a bounce keyframe**

Replace lines 405–457 (the `.dropdown-item` rule through `.dropdown-content.active .dropdown-item:nth-child(10)`):

```css
.dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    opacity: 0;
    transform: translateX(-10px);
    transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.3, 0.64, 1);
}

.dropdown-content.active .dropdown-item {
    opacity: 1;
    transform: translateX(0);
}

.dropdown-content.active .dropdown-item:nth-child(1) {
    transition-delay: 0.05s;
}

.dropdown-content.active .dropdown-item:nth-child(2) {
    transition-delay: 0.1s;
}

.dropdown-content.active .dropdown-item:nth-child(3) {
    transition-delay: 0.15s;
}

.dropdown-content.active .dropdown-item:nth-child(4) {
    transition-delay: 0.2s;
}

.dropdown-content.active .dropdown-item:nth-child(5) {
    transition-delay: 0.25s;
}

.dropdown-content.active .dropdown-item:nth-child(6) {
    transition-delay: 0.3s;
}

.dropdown-content.active .dropdown-item:nth-child(7) {
    transition-delay: 0.35s;
}

.dropdown-content.active .dropdown-item:nth-child(8) {
    transition-delay: 0.4s;
}

.dropdown-content.active .dropdown-item:nth-child(9) {
    transition-delay: 0.45s;
}

.dropdown-content.active .dropdown-item:nth-child(10) {
    transition-delay: 0.5s;
}
```

with:

```css
.dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    opacity: 0;                 /* hidden until the menu opens */
}

/* Open: each word drops in with a small bounce, echoing the stars.
   `both` fill holds opacity:0 during the stagger delay and opacity:1 after. */
@keyframes navItemBounce {
    0%   { opacity: 0; transform: translateY(-10px) scale(0.96); }
    60%  { opacity: 1; transform: translateY(3px)   scale(1.02); }
    100% { opacity: 1; transform: translateY(0)     scale(1); }
}

.dropdown-content.active .dropdown-item {
    animation: navItemBounce 0.42s cubic-bezier(0.3, 1.3, 0.5, 1) both;
}

.dropdown-content.active .dropdown-item:nth-child(1)  { animation-delay: 0.12s; }
.dropdown-content.active .dropdown-item:nth-child(2)  { animation-delay: 0.19s; }
.dropdown-content.active .dropdown-item:nth-child(3)  { animation-delay: 0.26s; }
.dropdown-content.active .dropdown-item:nth-child(4)  { animation-delay: 0.33s; }
.dropdown-content.active .dropdown-item:nth-child(5)  { animation-delay: 0.40s; }
.dropdown-content.active .dropdown-item:nth-child(6)  { animation-delay: 0.47s; }
.dropdown-content.active .dropdown-item:nth-child(7)  { animation-delay: 0.54s; }
.dropdown-content.active .dropdown-item:nth-child(8)  { animation-delay: 0.61s; }
.dropdown-content.active .dropdown-item:nth-child(9)  { animation-delay: 0.68s; }
.dropdown-content.active .dropdown-item:nth-child(10) { animation-delay: 0.75s; }
```

- [ ] **Step 2: Verify in the browser**

Run: `open index.html`
Expected: on open, the menu words (blog, writing, list, about, time, archive) drop in one-by-one with a little bounce. On close they disappear (revert to hidden). No item stays stuck visible or invisible.

- [ ] **Step 3: Commit**

```bash
git -C /Users/lz/Documents/lnzh-nav-bounce add assets/css/style.css
git -C /Users/lz/Documents/lnzh-nav-bounce commit -m "$(printf 'Nav menu: bounce-in reveal to match the stars\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 4: Idle hint + hover preview

Add a soft periodic wave at rest (when collapsed) and a quick hop on hover.

**Files:**
- Modify: `assets/css/style.css` (add after the `navStarBounce` rule from Task 2)

- [ ] **Step 1: Add idle + hover keyframes**

After the `.dropdown-trigger.active .nav-star { … }` rule, add:

```css
/* At rest (collapsed): a gentle periodic wave inviting the click. Loops, but the
   global prefers-reduced-motion catch-all near the end of this file neutralizes it. */
@keyframes navStarIdle {
    0%, 70%, 100% { transform: translateY(0); }
    78% { transform: translateY(-4px)   scaleY(1.07); }
    85% { transform: translateY(0)      scaleY(0.98); }
    92% { transform: translateY(-1.5px); }
}

.dropdown-trigger:not(.active) .nav-star {
    animation: navStarIdle 3.8s ease-in-out infinite;
    animation-delay: calc(var(--i) * 0.07s);
}

/* Hover (while collapsed): a quick one-hop across the row. More specific than the
   idle rule, so it wins on hover. */
@keyframes navStarHop {
    0%   { transform: translateY(0); }
    40%  { transform: translateY(-8px) scaleY(1.14); }
    100% { transform: translateY(0); }
}

.dropdown-trigger:not(.active):hover .nav-star {
    animation: navStarHop 0.45s ease;
    animation-delay: calc(var(--i) * 0.05s);
}
```

- [ ] **Step 2: Verify in the browser**

Run: `open index.html`
Expected: with the menu **collapsed** (click to close it first — it opens by default on desktop), the stars do a soft looping wave at rest, and hovering them plays a quick left→right hop. With the menu **open**, neither plays (the open-bounce rule owns `.active`).

- [ ] **Step 3: Commit**

```bash
git -C /Users/lz/Documents/lnzh-nav-bounce add assets/css/style.css
git -C /Users/lz/Documents/lnzh-nav-bounce commit -m "$(printf 'Nav 4-star: idle hint + hover preview when collapsed\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 5: Suppress the open-bounce on initial restore

The dropdown is expanded-by-default on desktop and restored with `.active` on load. Stop that from auto-playing the bounce.

**Files:**
- Modify: `assets/js/nav-dropdown.js` (the `if (isExpanded && !isMobileOrTablet)` restore block)
- Modify: `assets/css/style.css` (one guard rule)

- [ ] **Step 1: Add the CSS guard**

In `assets/css/style.css`, right after the `.dropdown-trigger.active .nav-star { … }` bounce rule (Task 2), add:

```css
/* Suppress the open-bounce when JS restores the expanded state on page load. */
.dropdown-trigger.nav-no-anim .nav-star { animation: none !important; }
```

- [ ] **Step 2: Set/clear the guard during restore**

In `nav-dropdown.js`, the restore block currently reads:

```javascript
            if (isExpanded && !isMobileOrTablet) {
                // Restore expanded state without animation
                const items = dropdownContent.querySelectorAll('.dropdown-item');
                items.forEach(item => {
                    item.style.transition = 'none';
                });

                dropdownContent.style.transition = 'none';
                dropdownContent.style.display = 'block';
                dropdownContent.style.maxHeight = 'none';
                dropdownContent.classList.add('active');
                dropdownTrigger.classList.add('active');

                // Re-enable transitions after a brief delay
                setTimeout(() => {
                    dropdownContent.style.transition = '';
                    items.forEach(item => {
                        item.style.transition = '';
                    });
                }, 10);
            }
```

Replace it with (adds `nav-no-anim` on the trigger and kills item animations during the restore tick, then clears both):

```javascript
            if (isExpanded && !isMobileOrTablet) {
                // Restore expanded state without animation
                const items = dropdownContent.querySelectorAll('.dropdown-item');
                items.forEach(item => {
                    item.style.transition = 'none';
                    item.style.animation = 'none';
                });

                dropdownContent.style.transition = 'none';
                dropdownContent.style.display = 'block';
                dropdownContent.style.maxHeight = 'none';
                dropdownContent.classList.add('active');
                dropdownTrigger.classList.add('active');
                dropdownTrigger.classList.add('nav-no-anim');

                // Re-enable transitions/animations after a brief delay
                setTimeout(() => {
                    dropdownContent.style.transition = '';
                    items.forEach(item => {
                        item.style.transition = '';
                        item.style.animation = '';
                    });
                    dropdownTrigger.classList.remove('nav-no-anim');
                }, 10);
            }
```

- [ ] **Step 3: Verify in the browser**

Run: `open index.html`
Expected: on a fresh load (desktop width, menu expanded-by-default) the stars and menu items are **already shown, still, with no bounce**. Then closing and re-opening the menu **does** bounce. (Tip: to force the expanded default, run `localStorage.removeItem('dropdownExpanded_0')` in the console and reload.)

- [ ] **Step 4: Re-run the DOM harness (no regression)**

Run: `open dev/nav-star-test.html`
Expected: still **✓ all 8 checks passed**.

- [ ] **Step 5: Commit**

```bash
git -C /Users/lz/Documents/lnzh-nav-bounce add assets/js/nav-dropdown.js assets/css/style.css
git -C /Users/lz/Documents/lnzh-nav-bounce commit -m "$(printf 'Nav 4-star: do not auto-play bounce on initial restore\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 6: Fix the sidebar clipping

`nav { overflow-y: auto }` forces `overflow-x` to `auto`, silently clipping the toggle. Switch to `visible`, restoring scroll only on very short viewports.

**Files:**
- Modify: `assets/css/style.css:125-133` (the `nav` rule)

- [ ] **Step 1: Change the overflow + add a short-viewport guard**

In the `nav { … }` rule, change `overflow-y: auto;` (line 132) to `overflow: visible;`. The rule becomes:

```css
nav {
    position: fixed;
    left: 0;
    top: 0;
    width: 20%;
    height: 100vh;
    padding: 40px 20px 40px 60px;
    overflow: visible;
}

/* Very short viewports: restore scrolling so a long expanded menu stays reachable
   (accepts horizontal clip only in this rare case). */
@media (max-height: 640px) {
    nav { overflow-y: auto; }
}
```

- [ ] **Step 2: Verify nothing clips**

Run: `open index.html`
Expected: open/close the menu and hover the stars at a normal window height — the stars and menu items are never cut off at the sidebar's left/top edge. Shrink the window to < 640px tall with the menu open: the nav scrolls instead of hiding items.

- [ ] **Step 3: Commit**

```bash
git -C /Users/lz/Documents/lnzh-nav-bounce add assets/css/style.css
git -C /Users/lz/Documents/lnzh-nav-bounce commit -m "$(printf 'Nav: fix overflow-x clipping of the toggle\n\noverflow-y:auto forced overflow-x to auto and clipped the star; use\noverflow:visible, restoring scroll only under max-height:640px.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Task 7: Full verification pass + flip spec status

No code beyond confirming the matrix and updating the spec status line.

- [ ] **Step 1: Cross-browser / theme / depth matrix**

Open in **Chrome and Safari**, toggle **light and dark** (theme toggle in the footer/nav), on **`index.html`** and a **deep page** (`open blog/veganism/index.html` — `../../` relative paths). For each, confirm:
- Open bounces left→right; close + re-open re-fires.
- Menu words bounce in; collapse hides them.
- Collapsed: idle wave loops; hover hops.
- Nothing clips at the sidebar edge.
- Dark mode: the stars read fine (coloring unchanged, as agreed).

- [ ] **Step 2: Reduced-motion**

Enable macOS **System Settings → Accessibility → Display → Reduce Motion**, reload `index.html`.
Expected: no bounce/idle/hover motion; the menu opens to fully-visible items instantly. (Handled by the existing global `@media (prefers-reduced-motion: reduce)` catch-all at style.css ~2583 — no extra rule needed. If any motion still shows, that's a real failure to investigate.)

- [ ] **Step 3: DOM harness final green**

Run: `open dev/nav-star-test.html`
Expected: **✓ all 8 checks passed**.

- [ ] **Step 4: Flip the spec status**

In `docs/superpowers/specs/2026-06-09-nav-4star-bounce-design.md`, change `**Status:** Design — pending review` to `**Status:** Implemented`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/lz/Documents/lnzh-nav-bounce add docs/superpowers/specs/2026-06-09-nav-4star-bounce-design.md
git -C /Users/lz/Documents/lnzh-nav-bounce commit -m "$(printf 'Spec: mark nav 4-star Bouncy Wave implemented\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review (author checklist — completed)

**Spec coverage:** Springy bounce L→R (T2) · bounce-in menu (T3) · idle hint + hover (T4) · 4-slice asset-driven structure + JS enhancement (T1) · suppress auto-play on restore (T5) · overflow clip fix + short-viewport guard (T6) · reduced-motion (T7, via existing global rule) · dark-mode unchanged (T7) · two-file surface, no HTML/asset edits (T1). All spec sections map to a task.

**Placeholder scan:** none — every code/CSS/JS block is complete and exact.

**Type/name consistency:** `enhanceStarToggle`, classes `.fourstar` / `.nav-star` / `.nav-no-anim`, custom props `--star-src` / `--star-aspect` / `--i`, and keyframes `navStarBounce` / `navItemBounce` / `navStarIdle` / `navStarHop` are used identically across tasks and the harness.

**Note on reduced-motion:** relies on the pre-existing global catch-all (style.css ~2583: `* { animation-duration:0.01ms !important; animation-iteration-count:1 !important }`), which collapses the looping idle to a single instant frame and snaps the bounces to their rest/visible end states. No redundant rule added (DRY).
