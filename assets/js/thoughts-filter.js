// Thoughts page filtering and sorting
import { getAllLikes, incrementLike } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', function() {
    const container = document.querySelector('.thoughts-container');
    if (!container) return;

    // Collect all thoughts with their data
    const thoughts = [];
    const thoughtElements = container.querySelectorAll('.thought');

    thoughtElements.forEach((el, index) => {
        const dateSpan = el.querySelector('.date');
        const textEl = el.querySelector('p');
        const dateStr = dateSpan ? dateSpan.textContent : '';
        const text = textEl ? textEl.textContent : '';

        // Parse date (format: "Jan 23, 2026")
        const date = new Date(dateStr);

        thoughts.push({
            element: el,
            index: index,
            date: date,
            dateStr: dateStr,
            text: text,
            length: text.length,
            likes: 0
        });
    });

    // Get favourites from localStorage
    function getFavourites() {
        try {
            return JSON.parse(localStorage.getItem('thoughtFavourites') || '[]');
        } catch {
            return [];
        }
    }

    function saveFavourites(favs) {
        localStorage.setItem('thoughtFavourites', JSON.stringify(favs));
    }

    function toggleFavourite(index) {
        const favs = getFavourites();
        const idx = favs.indexOf(index);
        if (idx > -1) {
            favs.splice(idx, 1);
        } else {
            favs.push(index);
        }
        saveFavourites(favs);
        updateFavouriteButtons();
    }

    function isFavourite(index) {
        return getFavourites().includes(index);
    }

    // Like system using Firebase
    async function getLikes() {
        try {
            const likesData = await getAllLikes();
            const likesMap = {};

            // Convert Firebase format (thought_0, thought_1) to simple index map
            Object.keys(likesData).forEach(key => {
                if (key.startsWith('thought_')) {
                    const index = parseInt(key.replace('thought_', ''));
                    likesMap[index] = likesData[key];
                }
            });

            return likesMap;
        } catch (error) {
            console.error('Error fetching likes:', error);
            return {};
        }
    }

    // Track user's liked thoughts locally
    function getUserLikedThoughts() {
        try {
            return JSON.parse(localStorage.getItem('userLikedThoughts') || '[]');
        } catch {
            return [];
        }
    }

    function saveUserLikedThoughts(likedArray) {
        localStorage.setItem('userLikedThoughts', JSON.stringify(likedArray));
    }

    function hasUserLiked(index) {
        return getUserLikedThoughts().includes(index);
    }

    async function toggleLike(index) {
        try {
            const userLiked = getUserLikedThoughts();
            const alreadyLiked = userLiked.includes(index);

            if (alreadyLiked) {
                // Unlike: decrement and remove from user's liked list
                const newCount = await incrementLike(index, -1);
                thoughts[index].likes = newCount;
                const newUserLiked = userLiked.filter(i => i !== index);
                saveUserLikedThoughts(newUserLiked);
            } else {
                // Like: increment and add to user's liked list
                const newCount = await incrementLike(index, 1);
                thoughts[index].likes = newCount;
                userLiked.push(index);
                saveUserLikedThoughts(userLiked);
            }

            updateLikeDisplay(index);
            updateFavouriteButtons();

            // Also update the sort if we're on "likes"
            if (sortSelect && sortSelect.value === 'likes') {
                updateFilter();
            }
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    }

    function updateLikeDisplay(index) {
        const likeCountEl = thoughts[index].element.querySelector('.like-count');
        if (likeCountEl) {
            likeCountEl.textContent = thoughts[index].likes || 0;
        }
    }

    async function initializeLikes() {
        const likes = await getLikes();
        thoughts.forEach((t, i) => {
            t.likes = likes[i] || 0;
        });
    }

    // Add like buttons to each thought
    function addLikeButtons() {
        thoughts.forEach((t, i) => {
            const likeContainer = document.createElement('div');
            likeContainer.className = 'like-container';

            const likeCount = document.createElement('span');
            likeCount.className = 'like-count';
            likeCount.textContent = t.likes || 0;

            const btn = document.createElement('button');
            btn.className = 'fav-btn' + (hasUserLiked(i) ? ' active' : '');
            btn.innerHTML = '★';
            btn.title = 'Like this thought';
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await toggleLike(i);
            });

            likeContainer.appendChild(likeCount);
            likeContainer.appendChild(btn);
            t.element.insertBefore(likeContainer, t.element.firstChild);
        });
    }

    function updateFavouriteButtons() {
        thoughts.forEach((t, i) => {
            const btn = t.element.querySelector('.fav-btn');
            if (btn) {
                btn.className = 'fav-btn' + (hasUserLiked(i) ? ' active' : '');
            }
        });
    }

    // Remove month headers
    function removeMonthHeaders() {
        container.querySelectorAll('h2').forEach(h => h.remove());
        container.querySelectorAll('.month-content').forEach(mc => {
            while (mc.firstChild) {
                container.appendChild(mc.firstChild);
            }
            mc.remove();
        });
    }

    // Current mode: 'all', 'random', 'favs'
    let currentMode = 'all';
    let isReversed = false;

    // Sort and filter
    function applyFilter(mode, sortBy, searchTerm, reversed = false) {
        let filtered = [...thoughts];

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(t => t.text.toLowerCase().includes(term));
        }

        // Apply mode
        if (mode === 'favs') {
            const favs = getUserLikedThoughts();
            filtered = filtered.filter(t => favs.includes(t.index));
        } else if (mode === 'random' && filtered.length > 0) {
            const randomIndex = Math.floor(Math.random() * filtered.length);
            filtered = [filtered[randomIndex]];
        }

        // Sort (not for random mode)
        if (mode !== 'random') {
            switch (sortBy) {
                case 'date':
                    filtered.sort((a, b) => b.date - a.date);
                    break;
                case 'length':
                    filtered.sort((a, b) => b.length - a.length);
                    break;
                case 'likes':
                    filtered.sort((a, b) => b.likes - a.likes);
                    break;
            }

            // Reverse if needed
            if (reversed) {
                filtered.reverse();
            }
        }

        // Fade out current thoughts
        container.classList.add('reordering');

        setTimeout(() => {
            // Hide all thoughts
            thoughts.forEach(t => {
                t.element.style.display = 'none';
                t.element.classList.remove('fade-in');
            });

            // Show filtered thoughts in order
            filtered.forEach((t, idx) => {
                t.element.style.display = '';
                t.element.style.animationDelay = `${idx * 0.03}s`;
                t.element.classList.add('fade-in');
                container.appendChild(t.element);
            });

            // Remove animation classes after animation completes
            setTimeout(() => {
                container.classList.remove('reordering');
                filtered.forEach(t => {
                    t.element.style.animationDelay = '';
                    t.element.classList.remove('fade-in');
                });
            }, 500 + filtered.length * 30);
        }, 150);

        // Update count
        const countEl = document.getElementById('thought-count');
        if (countEl) {
            if (mode === 'random') {
                countEl.textContent = `1 of ${thoughts.length}`;
            } else {
                countEl.textContent = `${filtered.length} of ${thoughts.length}`;
            }
        }
    }

    // Initialize
    async function initialize() {
        removeMonthHeaders();
        await initializeLikes();
        addLikeButtons();
        updateFilter();
    }

    // Get controls
    const sortSelect = document.getElementById('sort-select');
    const searchInput = document.getElementById('search-input');
    const allBtn = document.getElementById('all-btn');
    const randomBtn = document.getElementById('random-btn');
    const favsBtn = document.getElementById('favs-btn');
    const reverseBtn = document.getElementById('reverse-order-btn');

    function setActiveButton(mode) {
        currentMode = mode;
        [allBtn, randomBtn, favsBtn].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (mode === 'all' && allBtn) allBtn.classList.add('active');
        if (mode === 'random' && randomBtn) randomBtn.classList.add('active');
        if (mode === 'favs' && favsBtn) favsBtn.classList.add('active');
    }

    function updateFilter() {
        const sortBy = sortSelect ? sortSelect.value : 'newest';
        const searchTerm = searchInput ? searchInput.value : '';
        applyFilter(currentMode, sortBy, searchTerm, isReversed);
    }

    function toggleReverse() {
        isReversed = !isReversed;
        if (reverseBtn) {
            reverseBtn.classList.toggle('reversed', isReversed);
        }
        updateFilter();
    }

    if (allBtn) allBtn.addEventListener('click', () => {
        setActiveButton('all');
        updateFilter();
    });

    if (randomBtn) randomBtn.addEventListener('click', () => {
        setActiveButton('random');
        updateFilter();
    });

    if (favsBtn) favsBtn.addEventListener('click', () => {
        setActiveButton('favs');
        updateFilter();
    });

    if (reverseBtn) reverseBtn.addEventListener('click', toggleReverse);

    if (sortSelect) sortSelect.addEventListener('change', updateFilter);
    if (searchInput) searchInput.addEventListener('input', () => {
        if (currentMode === 'random') {
            setActiveButton('all');
        }
        updateFilter();
    });

    // Initial render
    initialize();
});
