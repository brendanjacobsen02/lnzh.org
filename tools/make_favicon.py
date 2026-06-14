#!/usr/bin/env python3
"""Build the one-eyed "sprout" favicon from one canonical geometry.

Emits, into assets/images/content/ :
  - favicon.svg            self-inverting (light/dark via @media prefers-color-scheme)
  - favicon.png            light variant, transparent — fallback for non-SVG browsers
  - apple-touch-icon.png   light variant on an OPAQUE cream field (iOS ignores alpha)

The same geometry lives (by hand, frozen) in assets/js/favicon.js, which builds a
themed data: URI at runtime so the tab icon follows the in-page light/dark/nebula
toggle. Spec: docs/superpowers/specs/2026-06-14-favicon-sprout-design.md

Run:  uv run --quiet --with pillow python3 tools/make_favicon.py
"""
from __future__ import annotations
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "assets", "images", "content")

# --- canonical geometry (viewBox 0 0 64 64) -------------------------------
FEET = [(25, 51.5, 3.3, 2.1), (39, 51.5, 3.3, 2.1)]      # cx, cy, rx, ry  (INK)
BODY = [  # four cubic béziers, closed — wide flat-ish base so the feet attach
    ((17, 27), (18, 16), (46, 16), (47, 27)),
    ((47, 27), (48, 37), (47, 45), (43, 49)),
    ((43, 49), (41, 52), (23, 52), (21, 49)),
    ((21, 49), (17, 45), (16, 37), (17, 27)),
]
EYEBALL = (31, 30, 9.3)   # cx, cy, r  (PAPER)
PUPIL = (34.3, 30, 4.2)   # INK
GLINT = (32.6, 28.4, 1.1) # PAPER

# Tight square crop (vx, vy, side) so the mark fills the tab instead of
# floating in dead margin. Content spans x[16,48] y[16,53.6]; this leaves a
# few px of breathing room on each side.
VIEW = (11, 13.8, 42)

# --- theme tones (mirror assets/css/style.css tokens) ---------------------
LIGHT = dict(ink="#000000", paper="#f4f1e1")
DARK = dict(ink="#f4f1e1", paper="#100e0a")
NEBULA = dict(ink="#b794f6", paper="#06040f")   # lilac — favicon reads more purple than the pale in-page --ink #ece7fa


def _cubic(p0, c1, c2, p1, n=48):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * c1[0] + 3 * u * t**2 * c2[0] + t**3 * p1[0]
        y = u**3 * p0[1] + 3 * u**2 * t * c1[1] + 3 * u * t**2 * c2[1] + t**3 * p1[1]
        pts.append((x, y))
    return pts


def _body_polygon():
    poly = []
    for seg in BODY:
        poly.extend(_cubic(*seg))
    return poly


def render(size: int, ink: str, paper: str, bg: str | None = None) -> Image.Image:
    """Rasterize the sprout at `size`px (supersampled), optional opaque bg."""
    ss = 8
    R = size * ss
    vx, vy, side = VIEW
    s = R / side
    img = Image.new("RGBA", (R, R), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def ell(cx, cy, rx, ry, fill):
        d.ellipse([(cx - rx - vx) * s, (cy - ry - vy) * s,
                   (cx + rx - vx) * s, (cy + ry - vy) * s], fill=fill)

    for cx, cy, rx, ry in FEET:
        ell(cx, cy, rx, ry, ink)
    d.polygon([((x - vx) * s, (y - vy) * s) for x, y in _body_polygon()], fill=ink)
    ell(*EYEBALL[:2], EYEBALL[2], EYEBALL[2], paper)
    ell(*PUPIL[:2], PUPIL[2], PUPIL[2], ink)
    ell(*GLINT[:2], GLINT[2], GLINT[2], paper)

    img = img.resize((size, size), Image.LANCZOS)
    if bg is not None:
        base = Image.new("RGBA", (size, size), bg)
        base.alpha_composite(img)
        img = base
    return img


def svg_self_inverting() -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="11 13.8 42 42">'
        "<style>"
        ".ink{fill:%(li)s}.paper{fill:%(lp)s}"
        "@media (prefers-color-scheme:dark){.ink{fill:%(di)s}.paper{fill:%(dp)s}}"
        "</style>"
        '<ellipse class="ink" cx="25" cy="51.5" rx="3.3" ry="2.1"/>'
        '<ellipse class="ink" cx="39" cy="51.5" rx="3.3" ry="2.1"/>'
        '<path class="ink" d="M17 27 C18 16 46 16 47 27 C48 37 47 45 43 49 C41 52 23 52 21 49 C17 45 16 37 17 27 Z"/>'
        '<circle class="paper" cx="31" cy="30" r="9.3"/>'
        '<circle class="ink" cx="34.3" cy="30" r="4.2"/>'
        '<circle class="paper" cx="32.6" cy="28.4" r="1.1"/>'
        "</svg>"
    ) % {"li": LIGHT["ink"], "lp": LIGHT["paper"], "di": DARK["ink"], "dp": DARK["paper"]}


def main():
    with open(os.path.join(OUT, "favicon.svg"), "w") as f:
        f.write(svg_self_inverting())
    render(64, **LIGHT).save(os.path.join(OUT, "favicon.png"))
    render(180, ink=LIGHT["ink"], paper=LIGHT["paper"], bg=LIGHT["paper"]).save(
        os.path.join(OUT, "apple-touch-icon.png")
    )
    print("wrote favicon.svg, favicon.png (64), apple-touch-icon.png (180) ->", OUT)


if __name__ == "__main__":
    main()
