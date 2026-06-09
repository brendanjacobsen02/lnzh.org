# Hand-drawn asset guide

How to draw art that drops straight into the site. See the live mechanism at
`dev/drawn-kit.html` (press **g** or add `?guide` to any page to reveal slots).

## Frames (drawn containers)

- **Draw the border only — leave the middle empty.** The middle is where text
  flows; an empty middle lets the box stretch to any size.
- **Keep the corners distinct from the edges.** The kit 9-slices the image:
  corners stay fixed, the straight edges repeat to fill. So draw corners you're
  happy to see un-stretched, and edges that tile cleanly.
- Format: **transparent PNG** (or SVG), drawn at ~**2×** for crispness.
- Tell me the **corner size** (the slice inset in px) so the tiling lands right.
- Save as `assets/frames/<name>.png` (+ `assets/frames/<name>-dark.png` for dark
  mode, or I can auto-derive it).
- I wire it as:
  `class="drawn-frame has-frame" style="--frame-src:url(...); --frame-slice:30; --frame-width:18px"`
  (edges default to `repeat`; flip `--frame-repeat:round` if you ever see a
  clipped tile).

## Cliparts (spot illustrations)

- **Transparent PNG, any aspect ratio.** Just the drawing, no background.
- Tell me the **width ∶ height** so the slot reserves the right shape.
- Save as `assets/clipart/<name>.png` (+ `<name>-dark.png`).
- I wire it as:
  `class="drawn-slot has-art" style="--slot-src:url(...); --slot-ratio:3/2"`

## The loop

1. Open a page with `?guide` (or press **g**) → see the dashed slots.
2. Screenshot it, draw your frames/cliparts where you want them.
3. Send the marked-up screenshot + the cut-out PNGs.
4. I wire them in. Empty/undrawn slots stay invisible in the meantime — the live
   page never looks unfinished.
