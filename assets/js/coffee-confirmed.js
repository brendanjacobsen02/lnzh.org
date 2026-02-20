const summaryEl = document.getElementById('order-summary');

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateLabel(dateString) {
    const parsed = new Date(`${dateString}T00:00:00`);
    return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function getDateLabel(dateString) {
    const today = getLocalDateString();
    const baseLabel = formatDateLabel(dateString);
    if (dateString !== today) {
        return `${baseLabel} (preorder)`;
    }
    return `${baseLabel} (today)`;
}

function timeValueToLabel(value) {
    if (!value) {
        return '—';
    }
    const [hoursStr, minsStr] = value.split(':');
    const hours = Number(hoursStr);
    const mins = Number(minsStr);
    if (Number.isNaN(hours) || Number.isNaN(mins)) {
        return value;
    }
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = ((hours + 11) % 12) + 1;
    return `${displayHour}:${String(mins).padStart(2, '0')} ${period}`;
}

function renderSummary(data) {
    if (!summaryEl) {
        return;
    }
    if (!data) {
        summaryEl.innerHTML = '<p>Order details not found. Please place a new order.</p>';
        return;
    }
    const parts = [
        `<div><strong>Name:</strong> ${data.name || '—'}</div>`,
        `<div><strong>Drink:</strong> ${data.drink || '—'}</div>`
    ];

    if (data.temp) {
        parts.push(`<div><strong>Style:</strong> ${data.temp}</div>`);
    }

    if (data.milk) {
        parts.push(`<div><strong>Milk:</strong> ${data.milk}</div>`);
    }

    const dateLabel = data.pickupDate ? getDateLabel(data.pickupDate) : '—';
    const timeLabel = data.pickupLabel || timeValueToLabel(data.pickupTime);
    parts.push(`<div><strong>Pickup:</strong> ${dateLabel} at ${timeLabel}</div>`);

    summaryEl.innerHTML = parts.join('');
}

let orderData = null;
try {
    const raw = localStorage.getItem('coffeeLastOrder');
    if (raw) {
        orderData = JSON.parse(raw);
    }
} catch (error) {
    console.error('Failed to load order summary', error);
}

renderSummary(orderData);
