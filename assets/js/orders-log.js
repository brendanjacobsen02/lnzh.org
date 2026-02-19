import { db } from './firebase-config.js';
import {
    collection,
    getDocs,
    orderBy,
    query,
    where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const ordersBody = document.getElementById('orders-body');
const statusText = document.getElementById('status-text');
const filterButtons = document.querySelectorAll('[data-filter]');

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

function formatPickup(order) {
    if (!order.pickupDate || !order.pickupTime) {
        return '—';
    }
    return `${order.pickupDate} ${order.pickupTime}`;
}

function renderOrders(orders) {
    ordersBody.innerHTML = '';

    if (orders.length === 0) {
        statusText.textContent = 'No orders found for this view.';
        return;
    }

    orders.forEach((order) => {
        const styleParts = [];
        if (order.temp) {
            styleParts.push(order.temp);
        }
        if (order.milk) {
            styleParts.push(order.milk);
        }
        const styleText = styleParts.length ? styleParts.join(' / ') : '—';
        const line = document.createElement('p');
        line.innerHTML = `
            <strong>${order.name || '—'}</strong> — ${order.drink || '—'} — ${styleText} — ${formatPickup(order)} — placed ${formatTimestamp(order.createdAt)}
        `;
        ordersBody.appendChild(line);
    });

    statusText.textContent = `${orders.length} order${orders.length === 1 ? '' : 's'} shown.`;
}

async function loadOrders(filter) {
    statusText.textContent = 'Loading orders...';

    const ordersRef = collection(db, 'orders');
    let ordersQuery = query(ordersRef, orderBy('createdAt', 'desc'));

    if (filter === 'today') {
        const today = getLocalDateString();
        ordersQuery = query(ordersRef, where('pickupDate', '==', today));
    }

    try {
        const snap = await getDocs(ordersQuery);
        const orders = [];
        snap.forEach((docSnap) => {
            orders.push(docSnap.data());
        });

        if (filter === 'today') {
            orders.sort((a, b) => {
                const aTime = a.createdAt ? a.createdAt.toMillis() : 0;
                const bTime = b.createdAt ? b.createdAt.toMillis() : 0;
                return bTime - aTime;
            });
        }
        renderOrders(orders);
    } catch (error) {
        console.error('Failed to load orders', error);
        statusText.textContent = 'Unable to load orders. Check your connection.';
    }
}

filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        filterButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        loadOrders(button.dataset.filter);
    });
});

loadOrders('today');
