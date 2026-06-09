// Hand-drawn UI kit — guide mode toggle.
// Reveals empty .drawn-frame / .drawn-slot placeholders so you can screenshot a
// page and see exactly where to draw. Enable with ?guide in the URL, or press
// "g" (ignored while typing in a field). Production (no ?guide) stays clean.
(function () {
    function setGuide(on) {
        document.body.classList.toggle('draw-guide', on);
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (/[?&]guide(\b|=)/.test(window.location.search)) {
            setGuide(true);
        }

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'g' || e.metaKey || e.ctrlKey || e.altKey) {
                return;
            }
            const el = document.activeElement;
            if (el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)) {
                return;
            }
            setGuide(!document.body.classList.contains('draw-guide'));
        });
    });
})();
