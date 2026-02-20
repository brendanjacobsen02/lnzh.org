import { db } from './firebase-config.js';
import {
    collection,
    addDoc,
    doc,
    getDocs,
    orderBy,
    query,
    runTransaction,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const form = document.getElementById('coffee-comment-form');
const nameInput = document.getElementById('coffee-comment-name');
const textInput = document.getElementById('coffee-comment-text');
const starButtons = document.querySelectorAll('#coffee-comment-stars [data-stars]');
const sortSelect = document.getElementById('coffee-comments-sort');
const reverseBtn = document.getElementById('coffee-comments-reverse');
const commentsList = document.getElementById('coffee-comments-list');
const statusText = document.getElementById('coffee-comments-status');
const ratingText = document.getElementById('coffee-rating');

let commentsCache = [];
let selectedStars = 5;
let sortBy = 'date';
let isReversed = false;

function getStarredComments() {
    try {
        return JSON.parse(localStorage.getItem('coffeeCommentStarred') || '[]');
    } catch {
        return [];
    }
}

function saveStarredComments(ids) {
    localStorage.setItem('coffeeCommentStarred', JSON.stringify(ids));
}

function hasStarred(commentId) {
    return getStarredComments().includes(commentId);
}

function formatTimestamp(timestamp) {
    if (!timestamp) {
        return '—';
    }
    const date = timestamp.toDate();
    const hours = date.getHours();
    const mins = String(date.getMinutes()).padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = ((hours + 11) % 12) + 1;
    return `${displayHour}:${mins} ${period}`;
}

function buildThread(comments) {
    const map = new Map();
    const roots = [];

    comments.forEach((comment) => {
        map.set(comment.id, { ...comment, replies: [] });
    });

    map.forEach((comment) => {
        if (comment.parentId) {
            const parent = map.get(comment.parentId);
            if (parent) {
                parent.replies.push(comment);
            } else {
                roots.push(comment);
            }
        } else {
            roots.push(comment);
        }
    });

    return roots;
}

function renderStars(count) {
    if (!count || Number.isNaN(count)) {
        return '';
    }
    const filled = '★'.repeat(count);
    const empty = '☆'.repeat(Math.max(0, 5 - count));
    return `${filled}${empty}`;
}

function roundToHalf(value) {
    return Math.round(value * 2) / 2;
}

function renderAverageStars(value) {
    if (!value || Number.isNaN(value)) {
        return '';
    }
    const full = Math.floor(value);
    const hasHalf = value - full >= 0.5;
    const empty = Math.max(0, 5 - full - (hasHalf ? 1 : 0));
    return `${'★'.repeat(full)}${hasHalf ? '⯪' : ''}${'☆'.repeat(empty)}`;
}

function updateRating() {
    if (!ratingText) {
        return;
    }
    const parents = commentsCache.filter((comment) => !comment.parentId);
    const rated = parents.filter((comment) => typeof comment.stars === 'number' && comment.stars > 0);
    if (!rated.length) {
        ratingText.textContent = 'ratings: —';
        return;
    }
    const total = rated.reduce((sum, comment) => sum + comment.stars, 0);
    const average = total / rated.length;
    const rounded = roundToHalf(average);
    ratingText.textContent = `ratings: ${renderAverageStars(rounded)} (${rounded.toFixed(1)})`;
}

function sortRootComments(comments) {
    const sorted = comments.slice();
    switch (sortBy) {
        case 'date':
            sorted.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            break;
        case 'starred':
            sorted.sort((a, b) => (b.starCount || 0) - (a.starCount || 0));
            break;
        default:
            break;
    }
    if (isReversed) {
        sorted.reverse();
    }
    return sorted;
}

function renderComment(comment, depth = 0) {
    const wrapper = document.createElement('div');
    if (depth) {
        wrapper.classList.add('comment-reply');
        wrapper.style.marginLeft = `${depth * 2.5}rem`;
    }

    const name = comment.name && comment.name.trim() ? comment.name.trim() : 'anonymous';
    const timestamp = formatTimestamp(comment.createdAt);

    if (comment.stars) {
        const starsEl = document.createElement('p');
        starsEl.textContent = renderStars(comment.stars);
        wrapper.appendChild(starsEl);
    }

    const header = document.createElement('p');
    header.innerHTML = `<strong>${name}</strong> · ${timestamp}`;
    wrapper.appendChild(header);

    const body = document.createElement('p');
    body.textContent = comment.text || '';
    wrapper.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'comment-actions';

    const starCount = document.createElement('span');
    starCount.className = 'like-count';
    starCount.textContent = comment.starCount || 0;

    const starBtn = document.createElement('button');
    starBtn.className = 'fav-btn';
    starBtn.type = 'button';
    starBtn.dataset.action = 'star';
    starBtn.dataset.id = comment.id;
    starBtn.textContent = '★';
    if (hasStarred(comment.id)) {
        starBtn.classList.add('active');
    }

    const replyBtn = document.createElement('button');
    replyBtn.className = 'filter-btn';
    replyBtn.type = 'button';
    replyBtn.dataset.action = 'reply';
    replyBtn.dataset.id = comment.id;
    replyBtn.textContent = 'reply';
    actions.appendChild(replyBtn);
    actions.appendChild(starBtn);
    actions.appendChild(starCount);
    wrapper.appendChild(actions);

    const replyForm = document.createElement('div');
    replyForm.classList.remove('is-open');
    replyForm.dataset.replyForm = comment.id;
    replyForm.className = 'thoughts-controls';

    const replyName = document.createElement('input');
    replyName.type = 'text';
    replyName.placeholder = 'Name (optional)';
    replyName.maxLength = 40;

    const replyText = document.createElement('input');
    replyText.type = 'text';
    replyText.placeholder = 'Write a reply...';
    replyText.maxLength = 280;

    const replySubmit = document.createElement('button');
    replySubmit.className = 'filter-btn';
    replySubmit.type = 'button';
    replySubmit.dataset.action = 'submit-reply';
    replySubmit.dataset.id = comment.id;
    replySubmit.textContent = 'post reply';

    replyForm.appendChild(replyName);
    replyForm.appendChild(replyText);
    replyForm.appendChild(replySubmit);
    wrapper.appendChild(replyForm);

    if (comment.replies && comment.replies.length) {
        comment.replies.forEach((reply) => {
            wrapper.appendChild(renderComment(reply, depth + 1));
        });
    }

    return wrapper;
}

function renderComments() {
    commentsList.innerHTML = '';
    if (!commentsCache.length) {
        statusText.textContent = 'No reviews yet.';
        updateRating();
        return;
    }
    const threaded = buildThread(commentsCache);
    const sortedRoots = sortRootComments(threaded);
    statusText.textContent = `${sortedRoots.length} review${sortedRoots.length === 1 ? '' : 's'}.`;
    updateRating();
    sortedRoots.forEach((comment, index) => {
        commentsList.appendChild(renderComment(comment));
        if (index < sortedRoots.length - 1) {
            const divider = document.createElement('hr');
            divider.className = 'comment-divider';
            commentsList.appendChild(divider);
        }
    });
}

async function loadComments() {
    statusText.textContent = 'Loading reviews...';
    try {
        const commentsRef = collection(db, 'coffeeComments');
        const snap = await getDocs(query(commentsRef, orderBy('createdAt', 'asc')));
        const comments = [];
        snap.forEach((docSnap) => {
            comments.push({ id: docSnap.id, ...docSnap.data() });
        });
        commentsCache = comments;
        renderComments();
    } catch (error) {
        console.error('Failed to load comments', error);
        statusText.textContent = 'Unable to load reviews.';
    }
}

async function submitComment({ name, text, parentId = null, stars = null }) {
    const trimmed = text.trim();
    if (!trimmed) {
        alert('Review cannot be empty.');
        return;
    }
    await addDoc(collection(db, 'coffeeComments'), {
        name: name.trim() || null,
        text: trimmed,
        parentId: parentId || null,
        stars: parentId ? null : stars,
        starCount: 0,
        createdAt: serverTimestamp()
    });
    await loadComments();
}

async function toggleStar(commentId) {
    if (!commentId) {
        return;
    }
    const starred = getStarredComments();
    const alreadyStarred = starred.includes(commentId);
    const delta = alreadyStarred ? -1 : 1;
    try {
        await runTransaction(db, async (transaction) => {
            const ref = doc(db, 'coffeeComments', commentId);
            const snap = await transaction.get(ref);
            if (!snap.exists()) {
                return;
            }
            const current = snap.data().starCount || 0;
            const next = Math.max(0, current + delta);
            transaction.update(ref, { starCount: next });
        });
        if (alreadyStarred) {
            saveStarredComments(starred.filter((id) => id !== commentId));
        } else {
            starred.push(commentId);
            saveStarredComments(starred);
        }
        await loadComments();
    } catch (error) {
        console.error('Star failed', error);
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitComment({
        name: nameInput.value,
        text: textInput.value,
        stars: selectedStars
    });
    nameInput.value = '';
    textInput.value = '';
});

commentsList.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const action = target.dataset.action;
    const id = target.dataset.id;

    if (action === 'star') {
        await toggleStar(id);
    }
    if (action === 'reply') {
        const formEl = commentsList.querySelector(`[data-reply-form="${id}"]`);
        const allForms = commentsList.querySelectorAll('[data-reply-form]');
        const allReplyButtons = commentsList.querySelectorAll('[data-action="reply"]');
        allForms.forEach((form) => {
            if (form !== formEl) {
                form.classList.remove('is-open');
            }
        });
        allReplyButtons.forEach((btn) => {
            if (btn !== target) {
                btn.classList.remove('active');
            }
        });
        if (formEl) {
            const shouldOpen = !formEl.classList.contains('is-open');
            formEl.classList.toggle('is-open', shouldOpen);
            target.classList.toggle('active', shouldOpen);
        }
    }
    if (action === 'submit-reply') {
        const formEl = commentsList.querySelector(`[data-reply-form="${id}"]`);
        if (!formEl) {
            return;
        }
        const inputs = formEl.querySelectorAll('input');
        const replyName = inputs[0]?.value || '';
        const replyText = inputs[1]?.value || '';
        await submitComment({ name: replyName, text: replyText, parentId: id });
    }
});

starButtons.forEach((button) => {
    button.addEventListener('click', () => {
        starButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        selectedStars = Number(button.dataset.stars);
    });
});

if (starButtons.length) {
    const defaultButton = Array.from(starButtons).find((btn) => btn.dataset.stars === '5') || starButtons[0];
    if (defaultButton) {
        defaultButton.classList.add('active');
        selectedStars = Number(defaultButton.dataset.stars);
    }
}

if (sortSelect) {
    sortSelect.addEventListener('change', () => {
        sortBy = sortSelect.value;
        renderComments();
    });
}

if (reverseBtn) {
    reverseBtn.addEventListener('click', () => {
        isReversed = !isReversed;
        reverseBtn.classList.toggle('reversed', isReversed);
        renderComments();
    });
}

loadComments();
