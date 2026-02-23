import { db } from './firebase-config.js';
import {
    collection,
    doc,
    deleteDoc,
    getDoc,
    getDocs,
    query,
    setDoc,
    updateDoc,
    where,
    writeBatch
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
const menuButtons = document.querySelectorAll('[data-menu-key]');
const menuStatusText = document.getElementById('menu-status-text');

const ORDERS_PASSWORD = window.__ORDERS_PASSWORD__ || '';

const DEFAULT_SOLD_OUT = {
    espresso: true,
    latte: true,
    americano: true,
    matcha: false,
    chai: false,
    thaitea: false,
    chocolatechipcookie: false
};

let ordersCache = [];
let activeFilter = 'incomplete';
let sortState = { key: 'createdAt', direction: 'desc' };
let isAuthed = false;
let menuState = { ...DEFAULT_SOLD_OUT };

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

function formatGluten(gluten) {
    if (!gluten) {
        return '—';
    }
    const normalized = gluten.toLowerCase();
    if (normalized.includes('gluten')) {
        return 'GF';
    }
    if (normalized === 'regular') {
        return 'Reg';
    }
    return gluten;
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
        case 'gluten':
            return (order.gluten || '').toLowerCase();
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

function normalizeSoldOutMap(raw) {
    const base = { ...DEFAULT_SOLD_OUT };
    if (!raw || typeof raw !== 'object') {
        return base;
    }
    Object.keys(raw).forEach((key) => {
        if (typeof raw[key] === 'boolean') {
            base[key] = raw[key];
        }
    });
    return base;
}

function setMenuButtonState(button, soldOut) {
    if (!button) {
        return;
    }
    const label = button.dataset.menuLabel || button.textContent.trim();
    button.dataset.menuLabel = label;
    button.classList.toggle('active', soldOut);
    button.textContent = soldOut ? `${label} (sold out)` : label;
}

function applyMenuState() {
    menuButtons.forEach((button) => {
        const key = button.dataset.menuKey;
        const soldOut = Boolean(menuState[key]);
        setMenuButtonState(button, soldOut);
    });
}

async function persistMenuState() {
    const menuRef = doc(db, 'menu', 'availability');
    await setDoc(menuRef, { soldOut: menuState }, { merge: true });
}

async function bootstrapMenuDefaults() {
    const flag = localStorage.getItem('menuSoldOutBootstrap');
    if (flag) {
        return;
    }
    const forcedKeys = ['espresso', 'latte', 'americano'];
    let changed = false;
    forcedKeys.forEach((key) => {
        if (!menuState[key]) {
            menuState[key] = true;
            changed = true;
        }
    });
    if (changed) {
        try {
            await persistMenuState();
        } catch (error) {
            console.error('Failed to apply default sold out settings', error);
        }
    }
    localStorage.setItem('menuSoldOutBootstrap', 'true');
}

async function loadMenuState() {
    if (!menuButtons.length || !menuStatusText) {
        return;
    }
    menuStatusText.textContent = 'Loading menu status...';
    try {
        const menuRef = doc(db, 'menu', 'availability');
        const snap = await getDoc(menuRef);
        if (snap.exists()) {
            const data = snap.data() || {};
            const soldOut = data.soldOut && typeof data.soldOut === 'object' ? data.soldOut : data;
            menuState = normalizeSoldOutMap(soldOut);
        } else {
            menuState = { ...DEFAULT_SOLD_OUT };
            await setDoc(menuRef, { soldOut: menuState }, { merge: true });
        }
        await bootstrapMenuDefaults();
        applyMenuState();
        menuStatusText.textContent = 'Menu status synced.';
    } catch (error) {
        console.error('Failed to load menu status', error);
        menuStatusText.textContent = 'Unable to load menu status.';
        menuState = { ...DEFAULT_SOLD_OUT };
        applyMenuState();
    }
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
            <td>${order.temp || '—'}</td>
            <td>${formatMilk(order.milk)}</td>
            <td>${formatGluten(order.gluten)}</td>
            <td>${formatDateLabel(order.pickupDate)}</td>
            <td>${order.pickupTime || '—'}</td>
            <td>${formatTimestamp(order.createdAt)}</td>
            <td>
                <button class="filter-btn" type="button" data-toggle-status="${order.id}">
                    ${completed ? 'mark incomplete' : 'mark complete'}
                </button>
            </td>
            <td>
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

async function autoCompletePastOrders() {
    const today = getLocalDateString();
    const lastRun = localStorage.getItem('ordersAutoComplete');
    if (lastRun === today) {
        return;
    }
    try {
        const ordersRef = collection(db, 'orders');
        const snap = await getDocs(query(ordersRef, where('pickupDate', '<', today)));
        if (snap.empty) {
            localStorage.setItem('ordersAutoComplete', today);
            return;
        }
        const batch = writeBatch(db);
        let updates = 0;
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data && data.status !== 'complete') {
                batch.update(docSnap.ref, { status: 'complete' });
                updates += 1;
            }
        });
        if (updates > 0) {
            await batch.commit();
        }
        localStorage.setItem('ordersAutoComplete', today);
    } catch (error) {
        console.error('Failed to auto-complete past orders', error);
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

menuButtons.forEach((button) => {
    button.addEventListener('click', async () => {
        const key = button.dataset.menuKey;
        if (!key) {
            return;
        }
        const previous = menuState[key];
        menuState[key] = !previous;
        applyMenuState();
        if (menuStatusText) {
            menuStatusText.textContent = 'Saving menu status...';
        }
        try {
            await persistMenuState();
            if (menuStatusText) {
                menuStatusText.textContent = 'Menu status saved.';
            }
        } catch (error) {
            console.error('Failed to update menu status', error);
            menuState[key] = previous;
            applyMenuState();
            if (menuStatusText) {
                menuStatusText.textContent = 'Unable to save menu status.';
            }
            alert('Unable to update menu status. Please try again.');
        }
    });
});

function setAuthed(nextAuthed) {
    isAuthed = Boolean(nextAuthed);
    loginSection.hidden = isAuthed;
    ordersPanel.hidden = !isAuthed;
    if (isAuthed) {
        loginError.hidden = true;
        autoCompletePastOrders().finally(() => loadOrders(activeFilter));
        loadMenuState();
    }
}

function checkPassword() {
    if (!ORDERS_PASSWORD) {
        isAuthed = true;
        setAuthed(true);
        return;
    }
    const value = loginInput.value.trim();
    if (value === ORDERS_PASSWORD) {
        sessionStorage.setItem('ordersAuthed', 'true');
        loginError.hidden = true;
        isAuthed = true;
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

isAuthed = sessionStorage.getItem('ordersAuthed') === 'true';
setAuthed(isAuthed);
