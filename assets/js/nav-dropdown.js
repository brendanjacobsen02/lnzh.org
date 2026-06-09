// Navigation dropdown functionality
const navScriptUrl = document.currentScript ? document.currentScript.src : window.location.href;
const cursorSpriteFrames = [
    '../images/ui/cursor-sprite-0.svg',
    '../images/ui/cursor-sprite-1.svg',
    '../images/ui/cursor-sprite-2.svg'
].map(path => new URL(path, navScriptUrl).href);

document.addEventListener('DOMContentLoaded', function() {
    // Make all external links open in new tab
    document.querySelectorAll('a[href^="http"]:not([href*="lnzh.org"])').forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    });
    const dropdownTriggers = document.querySelectorAll('nav .dropdown-trigger');

    // Handle "open-sidebar" link on homepage
    const openSidebarLink = document.getElementById('open-sidebar');
    if (openSidebarLink) {
        openSidebarLink.addEventListener('click', function(e) {
            e.preventDefault();
            const nav = document.querySelector('nav');
            const navTrigger = document.querySelector('nav .dropdown-trigger');
            const navContent = navTrigger ? navTrigger.nextElementSibling : null;
            // Make sure the dropdown is open, then glow the sidebar to draw the eye.
            if (navTrigger && navContent && navContent.classList.contains('dropdown-content')
                && !navContent.classList.contains('active')) {
                navTrigger.click();
            }
            if (nav) {
                nav.classList.remove('nav-glow');
                void nav.offsetWidth; // restart the animation if clicked again
                nav.classList.add('nav-glow');
                nav.addEventListener('animationend', () => nav.classList.remove('nav-glow'), { once: true });
            }
        });
    }

    dropdownTriggers.forEach((dropdownTrigger, index) => {
        enhanceStarToggle(dropdownTrigger);
        const dropdownContent = dropdownTrigger.nextElementSibling;

        if (dropdownContent && dropdownContent.classList.contains('dropdown-content')) {
            // Open by default; only collapsed if the visitor explicitly closed it.
            const storageKey = `dropdownExpanded_${index}`;
            const isExpanded = localStorage.getItem(storageKey) !== 'false';

            // On mobile/tablet (≤1024px), always start collapsed
            const isMobileOrTablet = window.innerWidth <= 1024;

            if (isExpanded && !isMobileOrTablet) {
                // Restore expanded state without animation
                const items = dropdownContent.querySelectorAll('.dropdown-item');
                items.forEach(item => {
                    item.style.transition = 'none';
                });

                dropdownContent.style.transition = 'none';
                dropdownContent.style.display = 'block';
                dropdownContent.style.maxHeight = 'none';
                dropdownContent.classList.add('active');
                dropdownTrigger.classList.add('active');
                // NB: no .nav-anim-open here — the restore must not play the bounce.

                // Re-enable transitions after a brief delay
                setTimeout(() => {
                    dropdownContent.style.transition = '';
                    items.forEach(item => {
                        item.style.transition = '';
                    });
                }, 10);
            }

            dropdownTrigger.addEventListener('click', function() {
                const isActive = dropdownContent.classList.contains('active');

                if (isActive) {
                    // Collapse - remove active first for reverse animation
                    dropdownContent.classList.remove('active');
                    dropdownTrigger.classList.remove('active');
                    dropdownContent.classList.remove('nav-anim-open');
                    dropdownTrigger.classList.remove('nav-anim-open');

                    // Wait for item animations to complete, then collapse height
                    setTimeout(() => {
                        dropdownContent.style.maxHeight = '0';
                    }, 100);

                    localStorage.setItem(storageKey, 'false');
                } else {
                    // Expand
                    dropdownContent.style.display = 'block';
                    const height = dropdownContent.scrollHeight;
                    dropdownContent.style.maxHeight = height + 'px';

                    // Trigger animations with slight delay for smooth reveal
                    setTimeout(() => {
                        dropdownContent.classList.add('active');
                        dropdownTrigger.classList.add('active');
                        // user-initiated open → play the bounce (never set on restore)
                        dropdownContent.classList.add('nav-anim-open');
                        dropdownTrigger.classList.add('nav-anim-open');
                    }, 10);

                    localStorage.setItem(storageKey, 'true');
                }
            });
        }
    });

    // List page dropdown functionality
    const listDropdownTriggers = document.querySelectorAll('.list-dropdown-trigger');

    listDropdownTriggers.forEach((trigger) => {
        const content = trigger.nextElementSibling;

        if (content && content.classList.contains('list-dropdown-content')) {
            trigger.addEventListener('click', function() {
                const isActive = content.classList.contains('active');

                if (isActive) {
                    content.classList.remove('active');
                    trigger.classList.remove('active');
                    content.style.maxHeight = '0';
                } else {
                    content.style.maxHeight = content.scrollHeight + 'px';
                    setTimeout(() => {
                        content.classList.add('active');
                        trigger.classList.add('active');
                    }, 10);
                }
            });
        }
    });

    // Coffee updates dropdown (uses same animation pattern as list dropdowns)
    const coffeeUpdatesTrigger = document.querySelector('.coffee-updates-trigger');
    if (coffeeUpdatesTrigger) {
        const content = coffeeUpdatesTrigger.nextElementSibling;
        if (content && content.classList.contains('coffee-updates-list')) {
            coffeeUpdatesTrigger.addEventListener('click', function() {
                const isActive = content.classList.contains('active');

                if (isActive) {
                    content.classList.remove('active');
                    coffeeUpdatesTrigger.classList.remove('active');
                    content.style.maxHeight = '0';
                } else {
                    content.style.maxHeight = content.scrollHeight + 'px';
                    setTimeout(() => {
                        content.classList.add('active');
                        coffeeUpdatesTrigger.classList.add('active');
                    }, 10);
                }
            });
        }
    }

    initCursorSprite();
});

// Replace the single 4-star <img> toggle with four background-sliced <span>s so
// each star can animate on its own. --star-src / --star-aspect are read from the
// source PNG, keeping the toggle asset-swappable (e.g. four hand-drawn stars later).
function enhanceStarToggle(trigger) {
    const img = trigger.querySelector('img.nav-dropdown-toggle');
    if (!img) return;

    const src = img.getAttribute('src');
    // Resolve to an ABSOLUTE URL before stashing it in --star-src. A relative
    // url() inside a custom property resolves against the STYLESHEET that
    // consumes it (assets/css/style.css), NOT this page — so a page-relative
    // path becomes assets/css/assets/... and 404s on every page whose depth
    // differs from the stylesheet's (e.g. the homepage). Absolute sidesteps that
    // and lets theme-toggle.js match/swap it for the dark variant.
    const absSrc = new URL(src, document.baseURI).href;
    const label = img.getAttribute('alt') || 'more';

    const star = document.createElement('span');
    star.className = 'nav-dropdown-toggle fourstar';
    star.setAttribute('role', 'img');
    star.setAttribute('aria-label', label);
    star.style.setProperty('--star-src', `url("${absSrc}")`);
    star.style.setProperty('--star-aspect', '2.2419'); // fallback until natural size is known

    for (let i = 0; i < 4; i++) {
        const slice = document.createElement('span');
        slice.className = 'nav-star';
        slice.style.setProperty('--i', i);
        star.appendChild(slice);
    }

    img.replaceWith(star);

    // Refine the aspect ratio from the real asset so sizing survives a redraw.
    const probe = new Image();
    probe.onload = () => {
        if (probe.naturalWidth && probe.naturalHeight) {
            star.style.setProperty('--star-aspect', (probe.naturalWidth / probe.naturalHeight).toFixed(4));
        }
    };
    probe.src = absSrc;
}

function initCursorSprite() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

    if (prefersReducedMotion || !hasFinePointer) {
        return;
    }

    const sprite = document.createElement('img');
    sprite.className = 'cursor-sprite';
    sprite.src = cursorSpriteFrames[0];
    sprite.alt = '';
    sprite.setAttribute('aria-hidden', 'true');
    sprite.decoding = 'async';
    document.body.append(sprite);

    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let spriteX = pointerX;
    let spriteY = pointerY;
    let frameIndex = 0;
    let lastFrameTime = 0;
    let isVisible = false;

    function showSprite() {
        if (!isVisible) {
            isVisible = true;
            spriteX = pointerX;
            spriteY = pointerY;
            sprite.classList.add('is-visible');
        }
    }

    document.addEventListener('pointermove', (event) => {
        if (event.pointerType && event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
            return;
        }

        pointerX = event.clientX;
        pointerY = event.clientY;
        showSprite();
    }, { passive: true });

    document.addEventListener('pointerleave', () => {
        isVisible = false;
        sprite.classList.remove('is-visible');
    });

    function animate(now) {
        spriteX += (pointerX - spriteX) * 0.18;
        spriteY += (pointerY - spriteY) * 0.18;

        if (now - lastFrameTime > 140) {
            frameIndex = (frameIndex + 1) % cursorSpriteFrames.length;
            sprite.src = cursorSpriteFrames[frameIndex];
            lastFrameTime = now;
        }

        sprite.style.transform = `translate3d(${spriteX + 14}px, ${spriteY + 18}px, 0)`;
        requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
}
