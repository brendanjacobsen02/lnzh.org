// Blog filter functionality
document.addEventListener('DOMContentLoaded', function() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const blogCards = document.querySelectorAll('.blog-card');
    const blogGrid = document.querySelector('.blog-grid');

    function activateFilter(filter) {
        if (filter === 'all') {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-filter="all"]').classList.add('active');
            sortAndShowCards(['all']);
        } else {
            const targetButton = document.querySelector(`.filter-btn[data-filter="${filter}"]`);
            if (targetButton) {
                targetButton.classList.toggle('active');
            }

            const allButton = document.querySelector('[data-filter="all"]');
            allButton.classList.remove('active');

            const activeFilters = Array.from(filterButtons)
                .filter(btn => btn.classList.contains('active') && btn.getAttribute('data-filter') !== 'all')
                .map(btn => btn.getAttribute('data-filter'));

            if (activeFilters.length === 0) {
                allButton.classList.add('active');
                sortAndShowCards(['all']);
            } else {
                sortAndShowCards(activeFilters);
            }
        }
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            activateFilter(this.getAttribute('data-filter'));
        });
    });

    function sortAndShowCards(filters) {
        const cardsArray = Array.from(blogCards);
        const tagOrder = ['✩', 'φ', 'β', 'γ', 'δ'];
        const tagSymbols = { '✩': '✭', 'φ': 'φ', 'β': 'β', 'γ': 'γ', 'δ': 'δ' };

        function getPrimaryTag(card) {
            const tags = card.getAttribute('data-tags').split(' ');
            for (const tag of tagOrder) {
                if (tags.includes(tag)) return tag;
            }
            return 'zzz';
        }

        if (filters.includes('all')) {
            cardsArray.sort((a, b) => {
                const aOrder = tagOrder.indexOf(getPrimaryTag(a));
                const bOrder = tagOrder.indexOf(getPrimaryTag(b));
                return aOrder - bOrder;
            });

            cardsArray.forEach(card => {
                card.style.display = 'flex';
                const tagsDiv = card.querySelector('.card-tags');
                if (tagsDiv) {
                    const cardTags = card.getAttribute('data-tags').split(' ');
                    const symbols = tagOrder
                        .filter(tag => cardTags.includes(tag))
                        .map(tag => tagSymbols[tag])
                        .join(' ');
                    tagsDiv.textContent = symbols;
                }
                blogGrid.appendChild(card);
            });
        } else {
            cardsArray.forEach(card => {
                const cardTags = card.getAttribute('data-tags').split(' ');
                const hasAllTags = filters.every(filter => cardTags.includes(filter));
                card.style.display = hasAllTags ? 'flex' : 'none';
            });
        }
    }

    sortAndShowCards(['all']);
});
