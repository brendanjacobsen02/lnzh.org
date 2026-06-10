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
 *
 * Also boots the special "cosmic" palette (localStorage 'palette') so the
 * nebula mode paints from the first frame with no flash of the base theme.
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
        // Special palette ("cosmic" nebula mode): a full-site dark palette layered
        // over the dark theme. It pins a dark backdrop, so set it AND force the
        // dark theme before first paint (no flash of the base theme). Drop the
        // accent — a compound html[data-theme="dark"][data-accent] rule would
        // out-specify the palette's --link.
        var pal = localStorage.getItem('palette');
        if (pal === 'cosmic') {
            document.documentElement.setAttribute('data-palette', pal);
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.removeAttribute('data-accent');
        }
    } catch (e) {
        /* Storage / matchMedia unavailable — fall back to default light theme. */
    }
})();
