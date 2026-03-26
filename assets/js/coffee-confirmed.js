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
    const card = document.createElement('div');
    card.className = 'blog-card confirmed-card';

    const title = document.createElement('div');
    title.className = 'card-title';
    title.setAttribute('aria-hidden', 'true');

    const image = document.createElement('div');
    image.className = 'card-image';
    const drinkKey = (data.drink || '').toLowerCase();
    let clipartSrc = null;
    if (drinkKey === 'espresso') {
        clipartSrc = '../../assets/clipart/espressoclip.png';
    } else if (drinkKey === 'latte') {
        clipartSrc = '../../assets/clipart/latteclip.png';
    } else if (drinkKey === 'americano') {
        clipartSrc = '../../assets/clipart/americanoclip.png';
    }
    if (clipartSrc) {
        const clipart = document.createElement('img');
        clipart.src = clipartSrc;
        clipart.alt = '';
        image.appendChild(clipart);
    }

    const details = document.createElement('div');
    details.className = 'card-tags';
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

    if (data.caramel) {
        parts.push(`<div><strong>Caramel:</strong> ${data.caramel}</div>`);
    }

    if (data.ownCup) {
        parts.push(`<div><strong>Own cup:</strong> ${data.ownCup}</div>`);
    }

    const dateLabel = data.pickupDate ? getDateLabel(data.pickupDate) : '—';
    const timeLabel = data.pickupLabel || timeValueToLabel(data.pickupTime);
    parts.push(`<div><strong>Pickup:</strong> ${dateLabel} at ${timeLabel}</div>`);

    details.innerHTML = parts.join('');
    card.appendChild(title);
    if (image.childElementCount > 0) {
        card.appendChild(image);
    }
    card.appendChild(details);
    summaryEl.innerHTML = '';
    summaryEl.appendChild(card);
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

const confirmedCard = document.querySelector('.confirmed-card');
if (confirmedCard) {
    let isDragging = false;
    let targetRx = 0;
    let targetRy = 0;
    let currentRx = 0;
    let currentRy = 0;
    let rect = null;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const maxTilt = 10;
    const spring = 0.12;
    const idleAmp = 1.6;

    const updateRect = () => {
        rect = confirmedCard.getBoundingClientRect();
    };

    const setShadow = (rx, ry) => {
        const shadowX = ry * 0.6;
        const shadowY = -rx * 0.6;
        const blur = 14 + Math.abs(rx) + Math.abs(ry);
        confirmedCard.style.boxShadow = `${shadowX}px ${shadowY}px ${blur}px rgba(0, 0, 0, 0.18)`;
    };

    const updateTargetFromPointer = (clientX, clientY) => {
        if (!rect) {
            updateRect();
        }
        if (!rect) {
            return;
        }
        const x = (clientX - rect.left) / rect.width;
        const y = (clientY - rect.top) / rect.height;
        const dx = clamp(x - 0.5, -0.5, 0.5);
        const dy = clamp(y - 0.5, -0.5, 0.5);
        targetRy = clamp(dx * maxTilt * 2, -maxTilt, maxTilt);
        targetRx = clamp(-dy * maxTilt * 2, -maxTilt, maxTilt);
    };

    const animate = (timestamp) => {
        if (!isDragging) {
            if (Math.abs(targetRx) < 0.5 && Math.abs(targetRy) < 0.5) {
                const t = timestamp / 1000;
                targetRx = Math.sin(t * 0.8) * idleAmp;
                targetRy = Math.cos(t * 0.7) * idleAmp;
            } else {
                targetRx *= 0.94;
                targetRy *= 0.94;
            }
        }

        currentRx += (targetRx - currentRx) * spring;
        currentRy += (targetRy - currentRy) * spring;

        confirmedCard.style.transform = `rotateX(${currentRx}deg) rotateY(${currentRy}deg)`;
        setShadow(currentRx, currentRy);
        requestAnimationFrame(animate);
    };

    const onPointerDown = (event) => {
        isDragging = true;
        confirmedCard.classList.add('is-dragging');
        confirmedCard.setPointerCapture(event.pointerId);
        updateTargetFromPointer(event.clientX, event.clientY);
    };

    const onPointerMove = (event) => {
        if (!isDragging) {
            return;
        }
        updateTargetFromPointer(event.clientX, event.clientY);
    };

    const endDrag = (event) => {
        if (!isDragging) {
            return;
        }
        isDragging = false;
        confirmedCard.classList.remove('is-dragging');
        confirmedCard.releasePointerCapture(event.pointerId);
        targetRx = 0;
        targetRy = 0;
    };

    confirmedCard.addEventListener('pointerdown', onPointerDown);
    confirmedCard.addEventListener('pointermove', onPointerMove);
    confirmedCard.addEventListener('pointerup', endDrag);
    confirmedCard.addEventListener('pointercancel', endDrag);
    window.addEventListener('resize', () => {
        rect = null;
    });
    requestAnimationFrame(animate);
}
