# Hand-drawn Site System — Design Spec

**Date:** 2026-06-09
**Branch:** `feat/handdrawn-redesign`
**Status:** Draft — awaiting author review, then per-system implementation plans

---

## 1. North star

> A serious website drawn over by a kid. A real artist working in MS Paint.

The site stays **serious and rigorously organized** — clean type, real hierarchy, structured layouts — and then gets **rough hand-drawn chrome and slightly-silly critters drawn over and hanging off it**. The seriousness is what makes the frog funny; the frog is what makes the seriousness lovable. It should feel deliberately *overengineered*.

This is **not** a layout reinvention. The current structure is good and stays. What's missing is hand-drawn visual richness (the author's art) and a delightful interactive layer (the engine). We are building the **system that receives that art**, not replacing the structure.

### Rejected directions (on purpose)

- **Free-verse / collage / scattered layouts.** Without a real physics engine and depth, they read as "poorly executed." Organization wins.
- **AI-generated or CSS-faked "hand-drawn" art.** Hand-drawn means hand-drawn — every drawing is authored by the site owner.

## 2. Principles / constraints

- **Hand-drawn means hand-drawn.** All illustrative art (frames, cliparts, critter sprites, ornaments) is authored by the owner. The engine never fakes it with filters, wobble, or generated art.
- **Asset-driven & swappable.** Every drawn element is a referenced asset that can be replaced without touching logic — consistent with how the site's existing clipart and nav word-images already work.
- **Graceful placeholders.** The site must never look broken or worse than it does today before art arrives. Every slot degrades to a clean, neutral default (e.g. the current CSS hairline border). Art is additive.
- **Dark-mode aware.** Every asset has a light and `-dark` variant, following the existing convention. Where possible, the `-dark` variant is auto-derived (see `tools/recolor_assets.py`) so the owner doesn't draw everything twice.
- **Restrained & accessible.** Motion respects `prefers-reduced-motion`; a calm-mode toggle can silence the critters; density is capped so it never gets busy.
- **No new dependencies.** Vanilla JS modules per page, 4-space indent, no `innerHTML` for user/dynamic data — per `AGENTS.md`.
- **Reuse existing infrastructure.** Theme tokens, accent picker, no-flash `theme-init`, `build.py`, recolor tools, and the merged `cursor-sprite` system.

## 3. The intake workflow (draw-over-screenshot loop)

The core collaboration model. The owner's marked-up screenshot *is* the spec.

1. **Engineer builds** the page's serious structure + the working machinery (frame slots, critter engine) with placeholders.
2. **Engineer hands** the owner a screenshot of that page.
3. **Owner draws over it** — frames, cliparts, the frog, the cat — wherever they go.
4. **Owner sends** the marked-up screenshot (the spec) and, when ready, the cut-out icons (the art).
5. **Engineer wires it in.**

**Key property:** the marked-up screenshot *alone* unblocks engineering — placement and behavior can be built before the final art exists. The icon is just the final swap-in. Neither party blocks the other.

### Drawing guardrails (so art drops in clean)

- **Frames/containers:** draw only the *border/edges*, leave the middle empty (content flows there; the empty middle lets the box stretch without distorting linework — the 9-slice trick). Transparent PNG, drawn at ~2× for crispness.
- **Critters:** send **one pose** → engine animates it with CSS motion (bob, sway, cling); or send **multiple frames** → engine does true frame-by-frame animation. Per-critter choice.
- **Dark variants:** auto-derive via `recolor_assets.py` where the linework recolors cleanly; hand-redraw only when it doesn't.

### Asset conventions

- Files live under existing folders: `assets/images/ui/` (chrome), `assets/clipart/` (spot art), plus a new `assets/critters/` (sprites).
- Naming: `name.png` + `name-dark.png` siblings (existing pattern).
- A small manifest records each drawn slot → asset(s), variant, and (for critters) frame count/anchor. Extends the existing `tools/recolor_manifest.json` approach.

## 4. System A — Hand-drawn UI kit *(build first; foundation)*

Turns the owner's drawings into reusable UI chrome. The load-bearing system everything else clips onto.

- **Drawn frame / container** — a CSS `border-image` 9-slice driven by a single custom property (e.g. `--frame-src`). Any element becomes hand-drawn by setting that property; the content area is the stretchy middle. Edge linework **repeats/rounds** rather than stretches, to preserve the hand-drawn feel. **Fallback:** the current hairline border when no asset is set.
- **Clipart slots** — per-section spot art, generalizing the existing blog-card model (`card-image`): an aspect-ratio box with `object-fit`. Empty = neutral placeholder.
- **Drawn buttons / dividers / inputs** — optional art overlays with CSS fallbacks, so controls can be hand-drawn or plain.
- **Theming** — each asset has light/`-dark` variants; the variant swaps via the existing `html[data-theme="dark"]` mechanism. Must remain compatible with the accent picker.
- **Convention** — a documented class + custom-property pattern (e.g. `.drawn-frame { --frame-src: url(...) }`) so adding a hand-drawn container is a one-line, asset-only change.

**Deliverable:** the component + slot convention + placeholders + the first draw-over screenshot for a pilot page.

## 5. System B — Critter engine *(build second; the "overengineered" delight)*

A config-driven interactive overlay. The engine is real working machinery; the owner supplies the sprite art.

- **Anchor types:**
  - **Cursor follower** — generalizes the merged `cursor-sprite-*.svg` + `.cursor-sprite` system.
  - **Edge percher** — anchors to a target element's corner/edge (e.g. a frog gripping a frame corner); stays attached across scroll/resize.
  - **Background dweller** — sits in a background layer, loops (e.g. a dancing cat), low z-index, `pointer-events: none` so it never blocks clicks.
- **Roster config** — a JS config (or `data-` attributes) listing each critter: id, asset(s), anchor, behavior, frame count/timing, density tier.
- **Animation** — engine supports both single-pose CSS motion and multi-frame sprite animation.
- **Restraint** — a calm-mode toggle (hook into the existing writing-page settings gear / theme system); `prefers-reduced-motion` disables motion; a density cap. Performance via `requestAnimationFrame` + transforms only + `will-change`.
- **Placeholders** — ships with dummy sprites so the cat dances and the frog clings before real art arrives; the owner draws over the placeholders and swaps them in.

**Deliverable:** an engine that can place a looping background critter, an edge-percher, and a cursor follower from config + frames, with calm-mode and reduced-motion off-switches.

## 6. System C — Information architecture (organize the parts) *(runs alongside)*

Pure organization, no art required.

- **Room inventory (from repo):** `index`, `about`, `blog` (+ posts), `writing`, `list`, `time`, `photographs`, `recipes`, `essays`, `coffee` (+ `confirmed`), `thoughts`, `orders`, `tip`, `form`, `archive/*`, `dev/theme-demo`.
- **Per-room decision:** keep / cut / merge / finish. Several are empty stubs ("coming soon"): `photographs`, `recipes`, `essays`, `time`.
- **Navigation:** today everything hides behind one `✦` dropdown. Propose a clearer structure.
- These decisions are resolved within this sub-project with the owner (see Open Questions); the spec captures the audit, not a pre-baked verdict.

## 7. Integration with the existing site

- Build on theme tokens (`:root` + dark in `style.css`), the accent picker, no-flash `theme-init`, `build.py`, and the recolor tools.
- New assets follow existing folders + `-dark` sibling naming.
- No new runtime dependencies; per-page vanilla JS modules; no `innerHTML` for dynamic data.
- Firestore posture unchanged (no auth; rules-only).

## 8. Build sequence

1. **UI kit** — frame component + slot convention + placeholders + pilot page.
2. **Critter engine** — generalize cursor sprite; add edge-percher + background dweller; calm-mode.
3. **IA pass** — audit → decisions → apply kit + critters across the kept rooms.

Each sub-project gets its own implementation plan → build → verify. Incremental, frequent commits; JS syntax check + local serve per `AGENTS.md`; ships as a PR off `origin/main`.

## 9. Out of scope / non-goals

- Physics-engine free-verse / scattered layouts.
- AI-generated or CSS-faked hand-drawn art.
- Backend / auth changes.
- New dependencies or a build framework.

## 10. Success criteria

- A container becomes hand-drawn by dropping in one PNG (+ its `-dark` variant) and setting one property — and looks clean with **no** asset present.
- The critter engine places a looping background critter, an edge-percher, and a cursor follower from config + frames, with working calm-mode and reduced-motion off-switches.
- Every "coming soon" room has a decided fate.
- No regressions: existing pages, dark mode, accent picker, and the writing page still work; JS syntax check passes; pages serve `200`.
- The intended contrast reads through: serious base, playful overlay.

## 11. Open questions (resolve during review / first sub-project)

- **IA:** which rooms to cut vs. finish? (`photographs`, `recipes`, `essays`, `time`, `coffee`, `thoughts`, `orders`, `tip`, `archive`)
- **Pilot page:** which page do we apply the UI kit to first? (suggest a content-light one like `essays` or `about`.)
- **Nav:** tweak the `✦` dropdown, or rethink navigation entirely?
- **Frame edges:** linework should repeat/tile (default) or stretch?
