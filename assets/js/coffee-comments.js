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
const commentsList = document.getElementById('coffee-comments-list');
const statusText = document.getElementById('coffee-comments-status');

let commentsCache = [];

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

function renderComment(comment, depth = 0) {
    const wrapper = document.createElement('div');
    wrapper.style.marginLeft = depth ? '1rem' : '0';

    const name = comment.name && comment.name.trim() ? comment.name.trim() : 'anonymous';
    const timestamp = formatTimestamp(comment.createdAt);

    const header = document.createElement('p');
    header.innerHTML = `<strong>${name}</strong> · ${timestamp}`;
    wrapper.appendChild(header);

    const body = document.createElement('p');
    body.textContent = comment.text || '';
    wrapper.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'filter-buttons';

    const likeBtn = document.createElement('button');
    likeBtn.className = 'filter-btn';
    likeBtn.type = 'button';
    likeBtn.dataset.action = 'like';
    likeBtn.dataset.id = comment.id;
    likeBtn.textContent = `like (${comment.likes || 0})`;

    const dislikeBtn = document.createElement('button');
    dislikeBtn.className = 'filter-btn';
    dislikeBtn.type = 'button';
    dislikeBtn.dataset.action = 'dislike';
    dislikeBtn.dataset.id = comment.id;
    dislikeBtn.textContent = `dislike (${comment.dislikes || 0})`;

    const replyBtn = document.createElement('button');
    replyBtn.className = 'filter-btn';
    replyBtn.type = 'button';
    replyBtn.dataset.action = 'reply';
    replyBtn.dataset.id = comment.id;
    replyBtn.textContent = 'reply';

    actions.appendChild(likeBtn);
    actions.appendChild(dislikeBtn);
    actions.appendChild(replyBtn);
    wrapper.appendChild(actions);

    const replyForm = document.createElement('div');
    replyForm.hidden = true;
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
        statusText.textContent = 'No comments yet.';
        return;
    }
    statusText.textContent = `${commentsCache.length} comment${commentsCache.length === 1 ? '' : 's'}.`;
    const threaded = buildThread(commentsCache);
    threaded.forEach((comment) => {
        commentsList.appendChild(renderComment(comment));
    });
}

async function loadComments() {
    statusText.textContent = 'Loading comments...';
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
        statusText.textContent = 'Unable to load comments.';
    }
}

async function submitComment({ name, text, parentId = null }) {
    const trimmed = text.trim();
    if (!trimmed) {
        alert('Comment cannot be empty.');
        return;
    }
    await addDoc(collection(db, 'coffeeComments'), {
        name: name.trim() || null,
        text: trimmed,
        parentId: parentId || null,
        likes: 0,
        dislikes: 0,
        createdAt: serverTimestamp()
    });
    await loadComments();
}

async function reactToComment(commentId, field) {
    if (!commentId) {
        return;
    }
    try {
        await runTransaction(db, async (transaction) => {
            const ref = doc(db, 'coffeeComments', commentId);
            const snap = await transaction.get(ref);
            if (!snap.exists()) {
                return;
            }
            const current = snap.data()[field] || 0;
            transaction.update(ref, { [field]: current + 1 });
        });
        await loadComments();
    } catch (error) {
        console.error('Reaction failed', error);
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitComment({
        name: nameInput.value,
        text: textInput.value
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

    if (action === 'like') {
        await reactToComment(id, 'likes');
    }
    if (action === 'dislike') {
        await reactToComment(id, 'dislikes');
    }
    if (action === 'reply') {
        const formEl = commentsList.querySelector(`[data-reply-form="${id}"]`);
        if (formEl) {
            formEl.hidden = !formEl.hidden;
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

loadComments();
