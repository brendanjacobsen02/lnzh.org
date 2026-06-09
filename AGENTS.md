# Repository Guidelines

## Project Structure & Module Organization

This is a static personal site. Top-level folders such as `about/`, `blog/`, `coffee/`, `orders/`, and `thoughts/` each contain an `index.html` page. Shared files live under `assets/`:

- `assets/css/style.css` contains the global stylesheet.
- `assets/js/` contains page-specific browser scripts and Firebase helpers.
- `assets/images/content/`, `assets/images/icons/`, `assets/images/ui/`, and `assets/clipart/` hold referenced image assets.
- `FIRESTORE_RULES.txt` documents rules for Firebase-backed features.

There is no generated build output, package manifest, or test directory.

## Build, Test, and Development Commands

- `./serve` serves the site locally and opens it in the browser (auto-picks a free port starting at 8000). Pass a port (`./serve 3000`) or `--no-open` to skip the browser. Use this instead of opening files directly when testing ES modules. Equivalent to `python3 -m http.server 8000`.
- `for f in assets/js/*.js; do node --check "$f" || exit 1; done` checks JavaScript syntax without executing browser-only imports.
- `git status --short` verifies the working tree before and after edits.

For asset cleanup, search before deleting: `rg -F "coffee.png" .`.

## Coding Style & Naming Conventions

Use 4-space indentation in HTML, CSS, and JavaScript. Prefer plain browser APIs and small page-specific scripts over new dependencies. Keep filenames lowercase where possible; do not rename historical assets without updating every reference.

Avoid rendering user data with `innerHTML`. Use `textContent`, `append`, and DOM node creation for order, review, email, and localStorage-derived values.

## Testing Guidelines

There is no automated test suite. Before finishing changes:

- Run the JavaScript syntax check above.
- Serve the site locally and open affected pages.
- Confirm changed asset paths return `200` and deleted assets are no longer referenced.
- For Firebase-backed pages, verify the page degrades clearly if network or permissions fail.

## Commit & Pull Request Guidelines

Recent commits use short, imperative summaries, for example `Fix latte caramel workflow`. Keep commits focused and describe the behavioral change.

Do not commit directly to `main`. Use one branch per task, preferably named like `codex/short-task-name`, and keep each branch limited to the requested change. Avoid unrelated edits.

Pull requests should include a brief summary, affected pages, verification commands, and screenshots for visual changes. Note any Firebase rule or console changes that must be applied outside the repository.

## Security & Configuration Tips

Do not commit private Firebase credentials, admin passwords, or local config files. Public Firebase client config is acceptable, but authorization must come from Firestore rules or a real backend, not client-side passwords. Keep ignored local files such as `assets/js/firebase-config.local.js` out of HTML unless the file is deployed intentionally.
