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
            const navTrigger = document.querySelector('nav .dropdown-trigger');
            if (navTrigger) {
                navTrigger.click();
            }
        });
    }

    dropdownTriggers.forEach((dropdownTrigger, index) => {
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
