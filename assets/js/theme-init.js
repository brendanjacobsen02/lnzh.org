/*
 * theme-init.js — no-flash theme bootstrap.
 *
 * SYNCHRONOUS, render-blocking. Must be loaded in <head> BEFORE the
 * stylesheet <link>, with NO `defer`/`async`, so the correct
 * `data-theme` is set on <html> before the first paint (no FOUC).
 *
 * External file (no inline scripts) to satisfy the page CSP
 * `script-src 'self'`.
 *
 * Resolution order:
 *   1. localStorage 'theme' === 'light' | 'dark'  -> use it
 *   2. otherwise, OS preference via prefers-color-scheme
 *   3. on any error, leave the document untouched (defaults to light)
 */
(function () {
    try {
        var t = localStorage.getItem('theme');
        if (t !== 'light' && t !== 'dark') {
            t = (window.matchMedia &&
                 window.matchMedia('(prefers-color-scheme: dark)').matches)
                ? 'dark'
                : 'light';
        }
        document.documentElement.setAttribute('data-theme', t);
        // Accent (orthogonal to theme): green is the :root default = no attribute.
        var ac = localStorage.getItem('accent');
        if (ac && /^[a-z]+$/.test(ac) && ac !== 'green') {
            document.documentElement.setAttribute('data-accent', ac);
        }
    } catch (e) {
        /* Storage / matchMedia unavailable — fall back to default light theme. */
    }
})();
