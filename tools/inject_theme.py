#!/usr/bin/env python3
"""
inject_theme.py — wire the dark-mode theme scripts into every styled page.

Idempotently edits every ``index.html`` under the repo that links
``assets/css/style.css`` and is NOT itself under ``assets/`` (archive/ pages
are included, so navigating there keeps consistent theming). For each page:

  * Derive the asset-path prefix from that page's EXISTING ``nav-dropdown.js``
    <script> ``src`` (e.g. ``assets/``, ``../assets/``, ``../../assets/`` —
    the depth-3 archive page yields ``../../../assets/`` and is handled too).
  * Insert ``<script src="<prefix>js/theme-init.js"></script>`` inside <head>
    immediately BEFORE the ``style.css`` <link> line. This must be
    render-blocking (NO defer/async) so the correct theme is set before paint.
  * Insert ``<script src="<prefix>js/theme-toggle.js"></script>`` immediately
    AFTER the existing ``nav-dropdown.js`` <script> line.

Idempotent: a page already carrying an include is left untouched.

Run from the repo root:

    python3 tools/inject_theme.py
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Matches the page's existing nav-dropdown.js include and captures the prefix
# (the bit before "js/nav-dropdown.js", e.g. "../../assets/").
NAV_DROPDOWN_RE = re.compile(
    r'<script\s+src="(?P<prefix>(?:\.\./)*assets/)js/nav-dropdown\.js"\s*>\s*</script>'
)

# Matches the stylesheet <link> for style.css (any prefix). Captures the full
# tag plus the leading indentation on its line so we can mirror it.
STYLE_LINK_RE = re.compile(
    r'(?P<indent>[ \t]*)(?P<link><link\b[^>]*\bhref="(?:\.\./)*assets/css/style\.css"[^>]*>)'
)


def find_pages() -> list[Path]:
    """All index.html files that link style.css and are not under assets/."""
    pages = []
    for path in sorted(REPO_ROOT.rglob("index.html")):
        rel = path.relative_to(REPO_ROOT)
        if "assets" in rel.parts:
            continue
        text = path.read_text(encoding="utf-8")
        if "assets/css/style.css" in text:
            pages.append(path)
    return pages


def inject(path: Path) -> bool:
    """Inject both theme includes into one page. Returns True if changed."""
    text = path.read_text(encoding="utf-8")
    rel = path.relative_to(REPO_ROOT)

    # Idempotent: skip a page that already has the wiring.
    if "js/theme-toggle.js" in text and "js/theme-init.js" in text:
        return False

    nav_match = NAV_DROPDOWN_RE.search(text)
    if not nav_match:
        print(f"  ! {rel}: no nav-dropdown.js <script> found; skipping", file=sys.stderr)
        return False
    prefix = nav_match.group("prefix")

    changed = False

    # 1. theme-init.js — render-blocking, immediately BEFORE the style.css link.
    if "js/theme-init.js" not in text:
        link_match = STYLE_LINK_RE.search(text)
        if not link_match:
            print(f"  ! {rel}: no style.css <link> found; skipping", file=sys.stderr)
            return False
        indent = link_match.group("indent")
        init_tag = f'{indent}<script src="{prefix}js/theme-init.js"></script>\n'
        # Insert just before the matched line (preserving its own indentation).
        insert_at = link_match.start("indent")
        text = text[:insert_at] + init_tag + text[insert_at:]
        changed = True

    # 2. theme-toggle.js — immediately AFTER the nav-dropdown.js <script> line.
    if "js/theme-toggle.js" not in text:
        # Re-locate the nav-dropdown include (offsets shifted after step 1).
        nav_match = NAV_DROPDOWN_RE.search(text)
        line_start = text.rfind("\n", 0, nav_match.start()) + 1
        indent = text[line_start:nav_match.start()]
        toggle_tag = f'\n{indent}<script src="{prefix}js/theme-toggle.js"></script>'
        insert_at = nav_match.end()
        text = text[:insert_at] + toggle_tag + text[insert_at:]
        changed = True

    if changed:
        path.write_text(text, encoding="utf-8")
    return changed


def main() -> int:
    pages = find_pages()
    edited = 0
    skipped = 0
    for path in pages:
        rel = path.relative_to(REPO_ROOT)
        if inject(path):
            print(f"  + {rel}")
            edited += 1
        else:
            print(f"  = {rel} (already wired / skipped)")
            skipped += 1
    print(f"\nScanned {len(pages)} styled page(s): {edited} edited, {skipped} unchanged.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
