import { db } from './firebase-config.js';
import {
    collection,
    doc,
    deleteDoc,
    getDocs,
    query,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const ordersBody = document.getElementById('orders-body');
const statusText = document.getElementById('status-text');
const filterButtons = document.querySelectorAll('[data-filter]');
const sortButtons = document.querySelectorAll('[data-sort]');
const loginSection = document.getElementById('orders-login');
const loginInput = document.getElementById('orders-password');
const loginButton = document.getElementById('orders-login-btn');
const loginError = document.getElementById('orders-login-error');
const ordersPanel = document.getElementById('orders-panel');

const ORDERS_PASSWORD = window.__ORDERS_PASSWORD__ || '';

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

function isComplete(order) {
    return order.status === 'complete';
}

function getStyleText(order) {
    const styleParts = [];
    if (order.temp) {
        styleParts.push(order.temp);
    }
    if (order.milk) {
        styleParts.push(order.milk);
    }
    return styleParts.length ? styleParts.join(' / ') : '—';
}

function getSortValue(order, key) {
    switch (key) {
        case 'name':
            return (order.name || '').toLowerCase();
        case 'drink':
            return (order.drink || '').toLowerCase();
        case 'style':
            return getStyleText(order).toLowerCase();
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
        const completed = isComplete(order);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${order.name || '—'}</td>
            <td>${order.drink || '—'}</td>
            <td>${getStyleText(order)}</td>
            <td>${formatDateLabel(order.pickupDate)}</td>
            <td>${order.pickupTime || '—'}</td>
            <td>${formatTimestamp(order.createdAt)}</td>
            <td>${completed ? 'completed' : 'incomplete'}</td>
            <td>
                <button class="filter-btn" type="button" data-toggle-status="${order.id}">
                    ${completed ? 'mark incomplete' : 'mark complete'}
                </button>
                <button class="filter-btn" type="button" data-delete="${order.id}">delete</button>
            </td>
        `;
        ordersBody.appendChild(row);
    });

    statusText.textContent = `${filtered.length} order${filtered.length === 1 ? '' : 's'} shown.`;
}

async function loadOrders(filter) {
    statusText.textContent = 'Loading orders...';

    const ordersRef = collection(db, 'orders');
    let ordersQuery = query(ordersRef);

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

async function deleteOrder(order) {
    if (!order || !order.id) {
        return;
    }
    const confirmed = window.confirm(`Delete order for ${order.name || 'this customer'}?`);
    if (!confirmed) {
        return;
    }

    try {
        await deleteDoc(doc(db, 'orders', order.id));

        ordersCache = ordersCache.filter((item) => item.id !== order.id);
        renderOrders(ordersCache);
    } catch (error) {
        console.error('Failed to delete order', error);
        alert('Unable to delete order. Please try again.');
    }
}

async function toggleOrderStatus(order) {
    if (!order || !order.id) {
        return;
    }
    const nextStatus = isComplete(order) ? 'incomplete' : 'complete';
    try {
        await updateDoc(doc(db, 'orders', order.id), {
            status: nextStatus
        });
        order.status = nextStatus;
        renderOrders(ordersCache);
    } catch (error) {
        console.error('Failed to update status', error);
        alert('Unable to update status. Please try again.');
    }
}

ordersBody.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete]');
    if (deleteButton) {
        const orderId = deleteButton.dataset.delete;
        const order = ordersCache.find((item) => item.id === orderId);
        deleteOrder(order);
        return;
    }

    const statusButton = event.target.closest('[data-toggle-status]');
    if (!statusButton) {
        return;
    }
    const orderId = statusButton.dataset.toggleStatus;
    const order = ordersCache.find((item) => item.id === orderId);
    toggleOrderStatus(order);
});

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

function setAuthed(isAuthed) {
    loginSection.hidden = isAuthed;
    ordersPanel.hidden = !isAuthed;
    if (isAuthed) {
        loadOrders(activeFilter);
    }
}

function checkPassword() {
    if (!ORDERS_PASSWORD) {
        setAuthed(true);
        return;
    }
    const value = loginInput.value.trim();
    if (value === ORDERS_PASSWORD) {
        sessionStorage.setItem('ordersAuthed', 'true');
        loginError.hidden = true;
        setAuthed(true);
    } else {
        loginError.hidden = false;
    }
}

loginButton.addEventListener('click', checkPassword);
loginInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        checkPassword();
    }
});

if (sessionStorage.getItem('ordersAuthed') === 'true') {
    setAuthed(true);
} else {
    setAuthed(false);
}
