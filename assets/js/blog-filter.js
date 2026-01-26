// Blog filter functionality
document.addEventListener('DOMContentLoaded', function() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const blogCards = document.querySelectorAll('.blog-card');
    const blogGrid = document.querySelector('.blog-grid');

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');

            if (filter === 'all') {
                // Deselect all other buttons and select "All"
                filterButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');

                // Show all cards in order (favourites first)
                sortAndShowCards(['all']);
            } else {
                // Toggle the clicked button
                this.classList.toggle('active');

                // Deselect "All" button if any other button is selected
                const allButton = document.querySelector('[data-filter="all"]');
                allButton.classList.remove('active');

                // Get all active filters (excluding "all")
                const activeFilters = Array.from(filterButtons)
                    .filter(btn => btn.classList.contains('active') && btn.getAttribute('data-filter') !== 'all')
                    .map(btn => btn.getAttribute('data-filter'));

                // If no filters are active, reactivate "All"
                if (activeFilters.length === 0) {
                    allButton.classList.add('active');
                    sortAndShowCards(['all']);
                } else {
                    sortAndShowCards(activeFilters);
                }
            }
        });
    });

    function sortAndShowCards(filters) {
        const cardsArray = Array.from(blogCards);

        if (filters.includes('all')) {
            // Show all cards, favourites first
            cardsArray.forEach(card => {
                card.style.display = 'flex';
                card.style.order = card.getAttribute('data-tags') === 'favourites' ? '0' : '1';
            });
        } else {
            // Show only cards that match ALL selected filters
            cardsArray.forEach(card => {
                const cardTags = card.getAttribute('data-tags').split(' ');
                const hasAllTags = filters.every(filter => cardTags.includes(filter));

                if (hasAllTags) {
                    card.style.display = 'flex';
                    card.style.order = cardTags.includes('favourites') ? '0' : '1';
                } else {
                    card.style.display = 'none';
                }
            });
        }
    }

    // Initialize with "All" showing favourites first
    sortAndShowCards(['all']);
});
