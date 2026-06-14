/*
 * favicon.js — sync the tab icon to the IN-PAGE theme (light / dark / nebula).
 *
 * The static <link rel="icon" type="image/svg+xml"> already self-inverts on OS
 * light/dark via an internal @media rule. This overrides its href to match the
 * site's OWN toggle — including the cosmic/nebula palette, which the OS-level
 * media query can't see. Observes <html>'s data-theme / data-palette, so it
 * rides the existing theme-toggle + the nebula supernova unlock without any
 * change to theme-toggle.js.
 *
 * Deferred external module (page CSP is script-src 'self'; img-src allows
 * data:, so the themed icon ships as a data: URI). Geometry mirrors the
 * canonical sprout in tools/make_favicon.py / favicon.svg — keep them in step.
 */
(function () {
    var INK = { light: '#000000', dark: '#f4f1e1', nebula: '#b794f6' };
    var PAPER = { light: '#f4f1e1', dark: '#100e0a', nebula: '#06040f' };

    function sprite(mode) {
        var ink = INK[mode], paper = PAPER[mode];
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="11 13.8 42 42">'
            + '<ellipse fill="' + ink + '" cx="25" cy="51.5" rx="3.3" ry="2.1"/>'
            + '<ellipse fill="' + ink + '" cx="39" cy="51.5" rx="3.3" ry="2.1"/>'
            + '<path fill="' + ink + '" d="M17 27 C18 16 46 16 47 27 C48 37 47 45 43 49 C41 52 23 52 21 49 C17 45 16 37 17 27 Z"/>'
            + '<circle fill="' + paper + '" cx="31" cy="30" r="9.3"/>'
            + '<circle fill="' + ink + '" cx="34.3" cy="30" r="4.2"/>'
            + '<circle fill="' + paper + '" cx="32.6" cy="28.4" r="1.1"/>'
            + '</svg>';
    }

    function currentMode() {
        var el = document.documentElement;
        if (el.getAttribute('data-palette') === 'cosmic') return 'nebula';
        return el.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    var link = document.querySelector('link[rel~="icon"][type="image/svg+xml"]');
    if (!link) return; // no SVG icon link on this page — leave the PNG fallback alone

    var last = null;
    function apply() {
        var mode = currentMode();
        if (mode === last) return;
        last = mode;
        link.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(sprite(mode)));
    }

    apply();
    try {
        new MutationObserver(apply).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme', 'data-palette']
        });
    } catch (e) {
        /* MutationObserver unavailable — the load-time apply() still themed it once. */
    }
})();
