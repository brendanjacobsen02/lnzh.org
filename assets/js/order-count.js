import { db } from './firebase-config.js';
import {
    doc,
    getDoc,
    setDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const countEl = document.getElementById('order-count');

function formatCount(value) {
    if (typeof value !== 'number') {
        return '—';
    }
    return value.toLocaleString();
}

async function loadOrderCount() {
    if (!countEl) {
        return;
    }
    try {
        const countRef = doc(db, 'stats', 'orders');
        const snap = await getDoc(countRef);
        let total = 93;
        if (snap.exists()) {
            const data = snap.data();
            if (data && typeof data.totalOrders === 'number') {
                total = Math.max(data.totalOrders, 93);
            }
        } else {
            await setDoc(countRef, { totalOrders: total }, { merge: true });
        }
        countEl.innerHTML = `<i>Total orders so far: ${formatCount(total)}</i>`;
    } catch (error) {
        console.error('Failed to load order count', error);
        countEl.innerHTML = '<i>Total orders so far: —</i>';
    }
}

loadOrderCount();
