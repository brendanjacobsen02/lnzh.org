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

        // Tag priority order and symbols (from Greek origins)
        // φ = philosophia, ι = idios (personal/life), γ = gastronomia, δ = dialektike
        const tagOrder = ['favourites', 'philosophy', 'life', 'food', 'dialectic'];
        const tagSymbols = {
            'favourites': '✭',
            'philosophy': 'φ',
            'life': 'ι',
            'food': 'γ',
            'dialectic': 'δ'
        };

        // Get highest priority tag for sorting
        function getPrimaryTag(card) {
            const tags = card.getAttribute('data-tags').split(' ');
            for (const tag of tagOrder) {
                if (tags.includes(tag)) return tag;
            }
            return 'zzz';
        }

        // Get year from card
        function getYear(card) {
            const dateSpans = card.querySelectorAll('.card-date span');
            const yearSpan = dateSpans[dateSpans.length - 1];
            return parseInt(yearSpan?.textContent) || 0;
        }

        if (filters.includes('all')) {
            // Show all cards, sort by: tag priority order, then date (descending)
            cardsArray.sort((a, b) => {
                const aTag = getPrimaryTag(a);
                const bTag = getPrimaryTag(b);
                const aOrder = tagOrder.indexOf(aTag);
                const bOrder = tagOrder.indexOf(bTag);

                // Sort by tag priority
                if (aOrder !== bOrder) return aOrder - bOrder;

                // Then by date descending
                return getYear(b) - getYear(a);
            });

            cardsArray.forEach(card => {
                card.style.display = 'flex';
                // Set all tag symbols in priority order
                const symbolSpan = card.querySelector('.card-date span:first-child');
                if (symbolSpan) {
                    const cardTags = card.getAttribute('data-tags').split(' ');
                    const symbols = tagOrder
                        .filter(tag => cardTags.includes(tag))
                        .map(tag => tagSymbols[tag])
                        .join(' ');
                    symbolSpan.textContent = symbols;
                }
                blogGrid.appendChild(card);
            });
        } else {
            // Show only cards that match ALL selected filters
            cardsArray.forEach(card => {
                const cardTags = card.getAttribute('data-tags').split(' ');
                const hasAllTags = filters.every(filter => cardTags.includes(filter));

                if (hasAllTags) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        }
    }

    // Initialize with "All" showing favourites first
    sortAndShowCards(['all']);
});
