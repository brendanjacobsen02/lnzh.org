import { db } from './firebase-config.js';
import {
    addDoc,
    collection,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const form = document.getElementById('email-form');
const emailInput = document.getElementById('email-input');
const statusEl = document.getElementById('email-status');

function setStatus(message, isError = false) {
    if (!statusEl) {
        return;
    }
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#b5524d' : '#333';
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email) {
        setStatus('Please enter an email.', true);
        return;
    }

    form.querySelector('button[type="submit"]').disabled = true;
    setStatus('Submitting...');

    try {
        await addDoc(collection(db, 'emails'), {
            email,
            createdAt: serverTimestamp()
        });
        emailInput.value = '';
        setStatus('Thanks! You are on the list.');
    } catch (error) {
        console.error('Failed to submit email', error);
        setStatus('Unable to submit right now. Try again.', true);
    } finally {
        form.querySelector('button[type="submit"]').disabled = false;
    }
});
