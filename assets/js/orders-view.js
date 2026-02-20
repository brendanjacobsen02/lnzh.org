import { db } from './firebase-config.js';
import {
    collection,
    getDocs,
    query
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const ordersBody = document.getElementById('orders-body');
const statusText = document.getElementById('status-text');
const filterButtons = document.querySelectorAll('[data-filter]');
const sortButtons = document.querySelectorAll('[data-sort]');

let ordersCache = [];
let activeFilter = 'incomplete';
let sortState = { key: 'createdAt', direction: 'desc' };

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

function formatDateLabel(dateString) {
    if (!dateString) {
        return '—';
    }
    return dateString;
}

function formatMilk(milk) {
    if (!milk) {
        return '—';
    }
    const normalized = milk.toLowerCase();
    if (normalized === 'whole') {
        return 'W';
    }
    if (normalized === 'soy') {
        return 'S';
    }
    return milk;
}

function isComplete(order) {
    return order.status === 'complete';
}

function getSortValue(order, key) {
    switch (key) {
        case 'name':
            return (order.name || '').toLowerCase();
        case 'drink':
            return (order.drink || '').toLowerCase();
        case 'temp':
            return (order.temp || '').toLowerCase();
        case 'milk':
            return (order.milk || '').toLowerCase();
        case 'pickupDate':
            return order.pickupDate || '';
        case 'pickupTime':
            return order.pickupTime || '';
        case 'createdAt':
            return order.createdAt ? order.createdAt.toMillis() : 0;
        default:
            return '';
    }
}

function sortOrders(orders) {
    const { key, direction } = sortState;
    const modifier = direction === 'asc' ? 1 : -1;
    return orders.slice().sort((a, b) => {
        const aValue = getSortValue(a, key);
        const bValue = getSortValue(b, key);
        if (aValue < bValue) {
            return -1 * modifier;
        }
        if (aValue > bValue) {
            return 1 * modifier;
        }
        return 0;
    });
}

function renderOrders(orders) {
    ordersBody.innerHTML = '';

    const filtered = orders.filter((order) => {
        if (activeFilter === 'complete') {
            return isComplete(order);
        }
        return !isComplete(order);
    });

    if (filtered.length === 0) {
        statusText.textContent = 'No orders found for this view.';
        return;
    }

    const sorted = sortOrders(filtered);

    sorted.forEach((order) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.name || '—'}</td>
            <td>${order.drink || '—'}</td>
            <td>${order.temp || '—'}</td>
            <td>${formatMilk(order.milk)}</td>
            <td>${formatDateLabel(order.pickupDate)}</td>
            <td>${order.pickupTime || '—'}</td>
            <td>${formatTimestamp(order.createdAt)}</td>
        `;
        ordersBody.appendChild(row);
    });

    statusText.textContent = `${filtered.length} order${filtered.length === 1 ? '' : 's'} shown.`;
}

async function loadOrders(filter) {
    statusText.textContent = 'Loading orders...';

    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef);

    try {
        const snap = await getDocs(ordersQuery);
        const orders = [];
        snap.forEach((docSnap) => {
            orders.push({ id: docSnap.id, ...docSnap.data() });
        });
        ordersCache = orders;
        renderOrders(ordersCache);
    } catch (error) {
        console.error('Failed to load orders', error);
        statusText.textContent = 'Unable to load orders. Check your connection.';
    }
}

filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
        filterButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        activeFilter = button.dataset.filter;
        loadOrders(activeFilter);
    });
});

sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const key = button.dataset.sort;
        if (sortState.key === key) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState = { key, direction: 'asc' };
        }
        renderOrders(ordersCache);
    });
});

loadOrders(activeFilter);
