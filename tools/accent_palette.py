#!/usr/bin/env python3
"""Derive AA-compliant accent token values for the site's data-accent system.

Each accent recolors --link / --link-hover only. We need, for every hue:
  - light --link: >= 4.5:1 on the light paper #f2f2e4
  - dark  --link: >= 4.5:1 on the dark  paper #16150f
  - hover = link darkened (light) / lightened (dark), still readable.

Candidate values are seeded from the existing --cat-* palette so accents stay
cohesive with the site. Any value failing AA is auto-darkened (light) or
auto-lightened (dark) toward the target until it passes. Prints the CSS blocks.

Run: python3 tools/accent_palette.py
"""

PAPER_LIGHT = "#f2f2e4"
PAPER_DARK = "#16150f"
AA = 4.5

# hue -> (light seed = cat-*-deep, dark seed = cat-* dark value)
SEEDS = {
    "green":  ("#119c36", "#3fd06a"),   # current default (already in :root)
    "teal":   ("#3a6270", "#5a92a3"),
    "amber":  ("#a16a2e", "#d29a52"),
    "coral":  ("#8a3f3b", "#c26c68"),
    "violet": ("#5f4770", "#9a7eac"),
    "olive":  ("#857b2d", "#bbae4a"),
}


def _hex(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def _to_hex(rgb):
    return "#" + "".join(f"{max(0,min(255,round(v))):02x}" for v in rgb)


def _lin(v):
    v /= 255
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def _lum(rgb):
    r, g, b = (_lin(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(fg, bg):
    a, b = _lum(_hex(fg)), _hex(bg) and _lum(_hex(bg))
    hi, lo = max(a, b), min(a, b)
    return (hi + 0.05) / (lo + 0.05)


def _blend(rgb, target, t):
    return tuple(rgb[i] + (target[i] - rgb[i]) * t for i in range(3))


def adjust(hexv, bg, target_rgb, need=AA, step=0.04):
    """Blend hexv toward target_rgb (black to darken, white to lighten) until
    contrast on bg >= need. Returns adjusted hex."""
    rgb = list(_hex(hexv))
    for _ in range(26):
        if ratio(_to_hex(rgb), bg) >= need:
            break
        rgb = list(_blend(rgb, target_rgb, step))
    return _to_hex(rgb)


BLACK, WHITE = (0, 0, 0), (255, 255, 255)
results = {}
for hue, (light_seed, dark_seed) in SEEDS.items():
    light = adjust(light_seed, PAPER_LIGHT, BLACK)            # darken onto beige
    dark = adjust(dark_seed, PAPER_DARK, WHITE)               # lighten onto dark
    light_hover = adjust(_to_hex(_blend(_hex(light), BLACK, 0.35)), PAPER_LIGHT, BLACK)
    dark_hover = adjust(_to_hex(_blend(_hex(dark), WHITE, 0.35)), PAPER_DARK, WHITE)
    results[hue] = (light, light_hover, dark, dark_hover)

print("hue      light(link)  AA     light-hover  dark(link)   AA     dark-hover")
for hue, (l, lh, d, dh) in results.items():
    print(f"{hue:8} {l}    {ratio(l, PAPER_LIGHT):.2f}   {lh}      "
          f"{d}    {ratio(d, PAPER_DARK):.2f}   {dh}")

print("\n/* ---- accent overrides (generated; green = default :root) ---- */")
for hue, (l, lh, d, dh) in results.items():
    if hue == "green":
        continue
    print(f'html[data-accent="{hue}"] {{ --link: {l}; --link-hover: {lh}; }}')
    print(f'html[data-theme="dark"][data-accent="{hue}"] {{ --link: {d}; --link-hover: {dh}; }}')
