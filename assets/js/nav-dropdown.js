// Navigation dropdown functionality
document.addEventListener('DOMContentLoaded', function() {
    const dropdownTrigger = document.querySelector('.dropdown-trigger');
    const dropdownContent = document.querySelector('.dropdown-content');

    if (dropdownTrigger && dropdownContent) {
        // Check localStorage for saved state
        const isExpanded = localStorage.getItem('dropdownExpanded') === 'true';

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

                localStorage.setItem('dropdownExpanded', 'false');
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

                localStorage.setItem('dropdownExpanded', 'true');
            }
        });
    }
});
