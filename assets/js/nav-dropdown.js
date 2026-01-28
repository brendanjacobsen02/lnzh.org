// Navigation dropdown functionality
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
            // Check localStorage for saved state
            const storageKey = `dropdownExpanded_${index}`;
            const isExpanded = localStorage.getItem(storageKey) === 'true';

            if (isExpanded) {
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
});
