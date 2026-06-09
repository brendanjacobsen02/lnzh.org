---
name: lnzh-ui
description: Use when making ANY visual/UI/CSS change to lnzh.org (this repo) — styling a page or component, editing assets/css/style.css, adjusting layout/colors/typography. Encodes the paper/ink design tokens, the Newsreader/Spectral/Archivo font rules, the framed-surface + boxy-control patterns, and the MANDATORY high-fidelity both-themes verification before claiming any visual change is done. Also invoke the global frontend-design skill for the quality bar.
---

# lnzh.org UI

A static personal site with a calm paper/ink aesthetic, hand-drawn nav assets, and a "cozy terminal" component language (the **writing page** is the canonical reference). Light + dark themes via `html[data-theme]`. Everything lives in one stylesheet: `assets/css/style.css`.

## 1. Use the tokens — never hardcode colors

All color/surface/line values are CSS variables in `:root`, with a full set of overrides under `html[data-theme="dark"]`. **If you use `var(--x)`, light and dark both work automatically. If you hardcode a hex, you break one theme.**

| Token | Role |
|---|---|
| `--paper` / `--paper-raised` | page background / raised surface (cards, controls, the editor) |
| `--ink` / `--ink-soft` | strongest text / near-black body |
| `--text` / `--muted` / `--faint` | body / secondary / faint-disabled text scale |
| `--line` / `--line-soft` / `--line-strong` | hairline / lighter hairline / strong border |
| `--text-rgb` / `--paper-raised-rgb` / `--shadow-rgb` | base channels for `rgba(var(--text-rgb), .2)` translucency |
| `--inset-highlight` | subtle top-edge highlight on raised surfaces |
| `--link` / `--link-hover` | accent (forest green default; varies by `data-accent`) |
| `--cat-*` / `--cat-*-deep` | category/header accent palette |

Prefer translucent borders/overlays built from `rgba(var(--text-rgb), …)` so they read correctly in both themes.

## 2. Fonts (hard rule)

Three roles, also variables:

- `--header` = **Newsreader** (serif) — headers/wordmarks (`h1`–`h4`).
- `--body` = **Spectral** (serif) — body, **subtitles**, lists, all reading prose.
- `--mono` = **Archivo** — **ONLY** buttons and the smallest elements (HUD stat counters, keycaps, keyboard hints, micro-labels, per-item date eyebrows). Tabular figures keep number rows tidy.

**Never put `--mono` on a subtitle or any reading/larger text.** Subtitles are `--body` (e.g. `.writing-tag` is Spectral italic). Headings are `--header`.

## 3. Component patterns (writing page = canonical)

**Framed surface** (cards, panels, the editor):
```css
background: var(--paper-raised);
border: 1px solid rgba(var(--text-rgb), 0.16);
box-shadow: 0 1px 2px rgba(var(--shadow-rgb), 0.05);
/* square corners (border-radius: 0) — the site is square; keycaps are the only rounded thing */
```

**Boxy controls — one cohesive family** (buttons, selects, inputs share these):
```css
font-family: var(--mono); font-size: 0.7rem; text-transform: lowercase; letter-spacing: 0.05em;
height: 2.1rem; padding: 0 0.8rem;
border: 1px solid rgba(var(--text-rgb), 0.2); background: var(--paper-raised); color: var(--text);
/* hover: border-color rgba(var(--text-rgb),0.5) + color var(--ink) */
/* active/selected: background var(--ink); color var(--paper) */
```
Give every control in a row the **same height/padding/border** so it reads as one set. Icon-only buttons get a square footprint (`width: 2.1rem; padding: 0; justify-content: center`).

**Micro-label / eyebrow / date:** `var(--mono)`, ~0.62rem, `text-transform: uppercase`, `letter-spacing: ~0.1em`, `color: var(--muted)`.

**Keycaps:** see `.kc` (small mono caps with a 2px bottom border).

## 4. Theming pitfalls (real bugs this caused)

- **Hard offset shadows** like `2px 2px 0 rgba(0,0,0,0.14)` are **invisible on dark paper** — `--shadow-rgb` is black, dark bg is near-black. Don't lean on them for "boxiness"; use a border + `--paper-raised` surface instead.
- **`--line-strong`** (`#000` light / bright tan dark) on small controls looks cheap/harsh — use `rgba(var(--text-rgb), 0.2)` for control/card hairlines; reserve `--line-strong` for genuinely strong dividers.
- A treatment that looks fine in one theme often fails in the other. **Always check both.**

## 5. MANDATORY verification before saying it's done

Do NOT claim a visual change is good from a downscaled full-page thumbnail. That is the failure mode this skill exists to prevent.

1. **Serve** the worktree: `python3 -m http.server 8000 --directory <worktree>`
2. **High-DPI, tight crop** on the actual region (Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`):
   ```
   "$CHROME" --headless --disable-gpu --hide-scrollbars \
     --force-device-scale-factor=2 --window-size=1180,640 --virtual-time-budget=6000 \
     --screenshot=/tmp/shot.png "http://localhost:8000/<path>/"
   ```
   Read the PNG and judge it like a designer: consistent sizing, soft borders, real surfaces, contrast, no orphaned/floating elements.
3. **Both themes.** Default follows `prefers-color-scheme`. Force one by writing a same-origin seed page in the worktree and screenshotting *it* (theme-init.js reads localStorage):
   ```html
   <!-- _seed-dark.html (delete before committing) -->
   <script>localStorage.setItem('theme','dark');location.replace('/<path>/');</script>
   ```
   Screenshot `/_seed-dark.html` and `/_seed-light.html`. Remove the seed files before committing.
4. Invoke the global **`frontend-design`** skill for UI work — it sets the anti-"AI-slop" quality bar.

When asking the user to look, host an HTTP server and give the URL (never `file://`).

## Reference
- Canonical components: `.writing-*`, `.editor`, `.kc`, `.filter-btn` in `assets/css/style.css`.
- `AGENTS.md` (repo conventions), `CLAUDE.md` (worktree isolation + ship workflow).
