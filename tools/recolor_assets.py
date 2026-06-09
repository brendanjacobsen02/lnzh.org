#!/usr/bin/env python3
"""Generate dark-mode beige variants of monochrome PNG assets.

Scans every PNG under ``assets/`` (skipping the gitignored ``instagram-*``
dumps and the handful of full-color brand logos), classifies each opaque
image as either FLAT monochrome (wordmarks, icons, arrows, stars, the hr
rule) or SHADED grayscale (clipart + coffee illustrations), and writes a
sibling ``<name>-dark.png`` for each:

  * FLAT  -> every opaque pixel recolored to beige #F2F2E4, alpha preserved.
  * SHADED -> per-channel luminance invert (255 - v) blended ~12% toward
    beige for warmth, alpha preserved.

A manifest (``tools/recolor_manifest.json``) records source -> variant -> class
for the toggle script and verifier to consume.

The script is idempotent: re-running overwrites the variants with identical
output and regenerates the manifest. It deliberately never reads or rewrites
existing ``-dark.png`` files as sources.

Run:
    cd /Users/lz/Documents/lnzh
    uv run --quiet --with pillow python3 tools/recolor_assets.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = REPO_ROOT / "assets"
MANIFEST_PATH = REPO_ROOT / "tools" / "recolor_manifest.json"

# Beige paper color used for FLAT recolor and SHADED warm tint.
BEIGE = (0xF2, 0xF2, 0xE4)

# Opaque-pixel threshold: pixels with alpha above this are "ink".
ALPHA_THRESHOLD = 16

# FLAT vs SHADED boundary: at or below this many unique opaque RGB colors the
# image is treated as flat monochrome (black + anti-aliasing).
FLAT_MAX_UNIQUE_COLORS = 600

# Warmth blend factor applied to inverted SHADED pixels (toward beige).
WARM_BLEND = 0.12

# Substring marking a paths to skip entirely (gitignored Instagram dumps).
INSTAGRAM_MARKER = "instagram-"

# Suffix that identifies generated variants (never treated as a source).
DARK_SUFFIX = "-dark"

# Full-color brand/logo assets that must stay untouched. Paths relative to
# the repo root.
EXCLUDED_RELATIVE = {
    "assets/images/content/cashapp.png",
    "assets/images/content/cashapplogo.png",
    "assets/images/content/venmologo.png",
    "assets/images/content/zellelogo.png",
    "assets/images/content/favicon.png",
}


@dataclass
class Result:
    source: str  # repo-root-relative POSIX path of the source asset
    variant: str  # repo-root-relative POSIX path of the generated -dark.png
    cls: str  # "flat" or "shaded"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def rel(path: Path) -> str:
    """Repo-root-relative POSIX path string."""
    return path.relative_to(REPO_ROOT).as_posix()


def iter_source_pngs() -> list[Path]:
    """All in-scope source PNGs, sorted for deterministic output."""
    sources: list[Path] = []
    for path in sorted(ASSETS_DIR.rglob("*.png")):
        posix = path.as_posix()
        if INSTAGRAM_MARKER in posix:
            continue
        if path.stem.endswith(DARK_SUFFIX):
            # Never use a previously generated variant as a source.
            continue
        if rel(path) in EXCLUDED_RELATIVE:
            continue
        sources.append(path)
    return sources


def classify(img: Image.Image) -> str:
    """Return 'flat' or 'shaded' for an RGBA image.

    Counts unique opaque RGB colors; flat monochrome art has very few.
    Works on the raw RGBA byte buffer (4 bytes/pixel): faster than per-pixel
    access and cleanly typed (``tobytes`` -> ``bytes``).
    """
    rgba = img.convert("RGBA")
    raw = rgba.tobytes()  # RGBA, 4 bytes per pixel, row-major
    unique: set[tuple[int, int, int]] = set()
    for i in range(0, len(raw), 4):
        if raw[i + 3] > ALPHA_THRESHOLD:
            unique.add((raw[i], raw[i + 1], raw[i + 2]))
            if len(unique) > FLAT_MAX_UNIQUE_COLORS:
                return "shaded"
    return "flat"


def recolor_flat(img: Image.Image) -> Image.Image:
    """Recolor every opaque pixel to beige, preserving the original alpha."""
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    solid = Image.new("RGBA", rgba.size, (*BEIGE, 255))
    solid.putalpha(alpha)
    return solid


def _warm_invert_lut(beige_value: int) -> list[int]:
    """256-entry LUT: invert (255 - v) then blend toward the beige channel.

    out = (255 - v) * (1 - WARM_BLEND) + beige_value * WARM_BLEND
    Done via a lookup table so it is Pillow-version independent and fast.
    """
    lut: list[int] = []
    for v in range(256):
        inverted = 255 - v
        blended = inverted * (1.0 - WARM_BLEND) + beige_value * WARM_BLEND
        lut.append(max(0, min(255, round(blended))))
    return lut


def recolor_shaded(img: Image.Image) -> Image.Image:
    """Luminance-invert each channel then blend toward beige; keep alpha."""
    rgba = img.convert("RGBA")
    r, g, b, a = rgba.split()
    nr = r.point(_warm_invert_lut(BEIGE[0]))
    ng = g.point(_warm_invert_lut(BEIGE[1]))
    nb = b.point(_warm_invert_lut(BEIGE[2]))
    return Image.merge("RGBA", (nr, ng, nb, a))


def variant_path(source: Path) -> Path:
    return source.with_name(f"{source.stem}{DARK_SUFFIX}.png")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    if not ASSETS_DIR.is_dir():
        print(f"error: assets dir not found: {ASSETS_DIR}", file=sys.stderr)
        return 1

    results: list[Result] = []
    flat_count = 0
    shaded_count = 0

    for source in iter_source_pngs():
        with Image.open(source) as raw:
            img = raw.convert("RGBA")
        cls = classify(img)
        if cls == "flat":
            out = recolor_flat(img)
            flat_count += 1
        else:
            out = recolor_shaded(img)
            shaded_count += 1

        out_path = variant_path(source)
        out.save(out_path, "PNG")
        results.append(Result(source=rel(source), variant=rel(out_path), cls=cls))

    manifest = [
        {"source": r.source, "variant": r.variant, "class": r.cls} for r in results
    ]
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")

    excluded = sorted(EXCLUDED_RELATIVE)
    print(f"variants generated : {len(results)}")
    print(f"  flat (recolored) : {flat_count}")
    print(f"  shaded (inverted): {shaded_count}")
    print(f"excluded full-color: {len(excluded)}")
    for e in excluded:
        print(f"    - {e}")
    print(f"manifest written   : {rel(MANIFEST_PATH)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
