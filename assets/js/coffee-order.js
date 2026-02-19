let firebaseLoadPromise = null;

async function getFirebase() {
    if (!firebaseLoadPromise) {
        firebaseLoadPromise = Promise.all([
            import('./firebase-config.js'),
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js')
        ]).then(([configModule, firestoreModule]) => ({
            db: configModule.db,
            firestore: firestoreModule
        }));
    }
    return firebaseLoadPromise;
}

const STEP_DRINK = document.getElementById('step-drink');
const STEP_TEMP = document.getElementById('step-temp');
const STEP_MILK = document.getElementById('step-milk');
const STEP_DETAILS = document.getElementById('step-details');
const STEP_CONFIRM = document.getElementById('step-confirm');

const drinkButtons = STEP_DRINK.querySelectorAll('[data-drink]');
const tempButtons = STEP_TEMP.querySelectorAll('[data-temp]');
const milkButtons = STEP_MILK.querySelectorAll('[data-milk]');
const nameInput = document.getElementById('customer-name');
const dateButtons = document.querySelectorAll('[data-date]');
const slotList = document.getElementById('slot-list');
const slotNote = document.getElementById('slot-note');
const backButton = document.getElementById('back-button');
const submitButton = document.getElementById('submit-button');
const summaryEl = document.getElementById('order-summary');

const ORDER_WINDOW = {
    startMinutes: 7 * 60 + 30,
    endMinutes: 8 * 60 + 15,
    interval: 5
};

const HIGH_CAPACITY_START = 8 * 60;
const HIGH_CAPACITY_END = 8 * 60 + 15;
const DEFAULT_CAPACITY = 5;
const HIGH_CAPACITY = 10;

let selectedDrink = null;
let selectedTemp = null;
let selectedMilk = null;
let selectedSlot = null;
let selectedDateKey = null;
let slotCounts = {};
let isAfterWindow = false;

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDateStringForKey(key) {
    const today = new Date();
    if (key === 'tomorrow') {
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        return getLocalDateString(tomorrow);
    }
    return getLocalDateString(today);
}

function formatDateLabel(dateString) {
    const parsed = new Date(`${dateString}T00:00:00`);
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function minutesToLabel(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = ((hours + 11) % 12) + 1;
    return `${displayHour}:${String(mins).padStart(2, '0')} ${period}`;
}

function minutesToValue(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function getSlotMinutes() {
    const slots = [];
    for (let time = ORDER_WINDOW.startMinutes; time <= ORDER_WINDOW.endMinutes; time += ORDER_WINDOW.interval) {
        slots.push({
            minutes: time,
            value: minutesToValue(time),
            label: minutesToLabel(time)
        });
    }
    return slots;
}

function animateIn(element) {
    if (!element) {
        return;
    }
    element.style.animation = 'none';
    void element.offsetHeight;
    element.style.animation = 'fadeIn 0.5s ease-out';
}

function getSlotCapacity(minutes) {
    if (minutes >= HIGH_CAPACITY_START && minutes <= HIGH_CAPACITY_END) {
        return HIGH_CAPACITY;
    }
    return DEFAULT_CAPACITY;
}

function setVisibility({ showTemp, showMilk, showDetails, showConfirm }) {
    const wasTempHidden = STEP_TEMP.hidden;
    const wasMilkHidden = STEP_MILK.hidden;
    const wasDetailsHidden = STEP_DETAILS.hidden;
    const wasConfirmHidden = STEP_CONFIRM.hidden;

    STEP_TEMP.hidden = !showTemp;
    STEP_MILK.hidden = !showMilk;
    STEP_DETAILS.hidden = !showDetails;
    STEP_CONFIRM.hidden = !showConfirm;

    if (showTemp && wasTempHidden) {
        animateIn(STEP_TEMP);
    }
    if (showMilk && wasMilkHidden) {
        animateIn(STEP_MILK);
    }
    if (showDetails && wasDetailsHidden) {
        animateIn(STEP_DETAILS);
    }
    if (showConfirm && wasConfirmHidden) {
        animateIn(STEP_CONFIRM);
    }
}

function hideConfirm() {
    STEP_CONFIRM.hidden = true;
}

function clearSelections(buttons) {
    buttons.forEach((btn) => btn.classList.remove('active'));
}

async function loadSlotCounts(dateString) {
    const { db, firestore } = await getFirebase();
    const { collection, getDocs, query, where } = firestore;
    const slotsQuery = query(
        collection(db, 'orderSlots'),
        where('date', '==', dateString)
    );
    const snap = await getDocs(slotsQuery);
    slotCounts = {};
    snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.time) {
            slotCounts[data.time] = data.count || 0;
        }
    });
}

function getEarliestMinute(now) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    if (nowMinutes <= ORDER_WINDOW.startMinutes) {
        return ORDER_WINDOW.startMinutes;
    }
    return Math.ceil(nowMinutes / ORDER_WINDOW.interval) * ORDER_WINDOW.interval;
}

function renderSlots(dateKey) {
    slotList.innerHTML = '';
    selectedSlot = null;

    const now = new Date();
    const earliestMinute = dateKey === 'today' ? getEarliestMinute(now) : ORDER_WINDOW.startMinutes;
    const slots = getSlotMinutes();

    if (earliestMinute > ORDER_WINDOW.endMinutes) {
        slotNote.hidden = false;
        slotNote.textContent = 'The pickup window is closed for today.';
        animateIn(slotNote);
        return;
    }

    const availableSlots = slots.filter((slot) => slot.minutes >= earliestMinute);
    const filteredSlots = availableSlots.filter((slot) => {
        const capacity = getSlotCapacity(slot.minutes);
        return (slotCounts[slot.value] || 0) < capacity;
    });

    if (filteredSlots.length === 0) {
        slotNote.hidden = false;
        slotNote.textContent = 'All pickup slots are full right now.';
        animateIn(slotNote);
        return;
    }

    slotNote.hidden = true;
    filteredSlots.forEach((slot) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-btn';
        button.textContent = slot.label;
        button.dataset.time = slot.value;
        button.addEventListener('click', () => {
            slotList.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('active'));
            button.classList.add('active');
            selectedSlot = slot;
            hideConfirm();
        });
        slotList.appendChild(button);
    });

    animateIn(slotList);
}

function requiresTemp(drink) {
    return drink === 'Latte' || drink === 'Americano';
}

function requiresMilk(drink) {
    return drink === 'Latte';
}

function getTempLabel() {
    return selectedTemp ? selectedTemp : 'No temp selection';
}

function getMilkLabel() {
    return selectedMilk ? selectedMilk : 'No milk selection';
}

function buildSummary() {
    const dateString = getDateStringForKey(selectedDateKey);
    const baseLabel = formatDateLabel(dateString);
    const dateLabel = isAfterWindow ? `${baseLabel} (preorder)` : baseLabel;
    const parts = [
        `<div><strong>Name:</strong> ${selectedName()}</div>`,
        `<div><strong>Drink:</strong> ${selectedDrink}</div>`
    ];

    if (requiresTemp(selectedDrink)) {
        parts.push(`<div><strong>Style:</strong> ${getTempLabel()}</div>`);
    }

    if (requiresMilk(selectedDrink)) {
        parts.push(`<div><strong>Milk:</strong> ${getMilkLabel()}</div>`);
    }

    parts.push(`<div><strong>Pickup:</strong> ${dateLabel} at ${selectedSlot.label}</div>`);
    summaryEl.innerHTML = parts.join('');
}

function selectedName() {
    return nameInput.value.trim();
}

async function refreshSlots() {
    try {
        if (!selectedDateKey) {
            slotNote.hidden = false;
            slotNote.textContent = 'Select a pickup day to see times.';
            slotList.innerHTML = '';
            animateIn(slotNote);
            return;
        }
        const dateString = getDateStringForKey(selectedDateKey);
        await loadSlotCounts(dateString);
        renderSlots(selectedDateKey);
    } catch (error) {
        console.error('Error loading slots', error);
        slotNote.hidden = false;
        slotNote.textContent = 'Unable to load pickup times right now. Please refresh.';
        animateIn(slotNote);
    }
}

async function placeOrder() {
    const name = selectedName();
    if (!selectedDrink) {
        alert('Please choose a drink.');
        return;
    }
    if (requiresTemp(selectedDrink) && !selectedTemp) {
        alert('Please choose hot or cold.');
        return;
    }
    if (requiresMilk(selectedDrink) && !selectedMilk) {
        alert('Please choose a milk type.');
        return;
    }
    if (!name) {
        alert('Please enter your name.');
        return;
    }
    if (!selectedSlot) {
        alert('Please select a pickup time.');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Placing order...';

    const pickupDate = getDateStringForKey(selectedDateKey);
    const slotKey = `${pickupDate}_${selectedSlot.value}`;
    const capacity = getSlotCapacity(selectedSlot.minutes);

    try {
        const { db, firestore } = await getFirebase();
        const { collection, doc, runTransaction, serverTimestamp } = firestore;
        await runTransaction(db, async (transaction) => {
            const slotRef = doc(db, 'orderSlots', slotKey);
            const slotSnap = await transaction.get(slotRef);
            const currentCount = slotSnap.exists() ? (slotSnap.data().count || 0) : 0;

            if (currentCount >= capacity) {
                throw new Error('Slot full');
            }

            transaction.set(slotRef, {
                date: pickupDate,
                time: selectedSlot.value,
                count: currentCount + 1,
                updatedAt: serverTimestamp()
            }, { merge: true });

            const orderRef = doc(collection(db, 'orders'));
            transaction.set(orderRef, {
                name: name,
                drink: selectedDrink,
                temp: requiresTemp(selectedDrink) ? selectedTemp : null,
                milk: requiresMilk(selectedDrink) ? selectedMilk : null,
                pickupDate: pickupDate,
                pickupTime: selectedSlot.value,
                createdAt: serverTimestamp()
            });
        });

        buildSummary();
        setVisibility({
            showTemp: requiresTemp(selectedDrink),
            showMilk: requiresMilk(selectedDrink),
            showDetails: true,
            showConfirm: true
        });
    } catch (error) {
        console.error('Order failed', error);
        if (error.message === 'Slot full') {
            alert('That pickup time just filled up. Please choose another.');
            await refreshSlots();
        } else {
            alert('Something went wrong placing your order. Please try again.');
        }
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Place order';
    }
}

function setupDrinkButtons() {
    drinkButtons.forEach((button) => {
        button.addEventListener('click', () => {
            clearSelections(drinkButtons);
            button.classList.add('active');
            selectedDrink = button.dataset.drink;
            selectedTemp = null;
            selectedMilk = null;
            selectedSlot = null;
            clearSelections(tempButtons);
            clearSelections(milkButtons);
            slotList.innerHTML = '';
            slotNote.hidden = true;
            hideConfirm();

            if (requiresTemp(selectedDrink)) {
                setVisibility({ showTemp: true, showMilk: false, showDetails: false, showConfirm: false });
            } else {
                setVisibility({ showTemp: false, showMilk: false, showDetails: true, showConfirm: false });
                refreshSlots();
            }
        });
    });
}

function setupTempButtons() {
    tempButtons.forEach((button) => {
        button.addEventListener('click', () => {
            clearSelections(tempButtons);
            button.classList.add('active');
            selectedTemp = button.dataset.temp;
            selectedMilk = null;
            clearSelections(milkButtons);
            hideConfirm();
            if (requiresMilk(selectedDrink)) {
                setVisibility({ showTemp: true, showMilk: true, showDetails: false, showConfirm: false });
            } else {
                setVisibility({ showTemp: true, showMilk: false, showDetails: true, showConfirm: false });
                refreshSlots();
            }
        });
    });
}

function setupMilkButtons() {
    milkButtons.forEach((button) => {
        button.addEventListener('click', () => {
            clearSelections(milkButtons);
            button.classList.add('active');
            selectedMilk = button.dataset.milk;
            hideConfirm();
            setVisibility({ showTemp: true, showMilk: true, showDetails: true, showConfirm: false });
            refreshSlots();
        });
    });
}

function setupDateButtons() {
    dateButtons.forEach((button) => {
        button.addEventListener('click', () => {
            dateButtons.forEach((btn) => btn.classList.remove('active'));
            button.classList.add('active');
            selectedDateKey = button.dataset.date;
            selectedSlot = null;
            hideConfirm();
            refreshSlots();
        });
    });
}

backButton.addEventListener('click', () => {
    hideConfirm();
    if (requiresTemp(selectedDrink)) {
        if (requiresMilk(selectedDrink)) {
            setVisibility({
                showTemp: true,
                showMilk: Boolean(selectedTemp),
                showDetails: false,
                showConfirm: false
            });
        } else {
            setVisibility({ showTemp: true, showMilk: false, showDetails: false, showConfirm: false });
        }
    } else {
        setVisibility({ showTemp: false, showMilk: false, showDetails: false, showConfirm: false });
    }
});

submitButton.addEventListener('click', placeOrder);
nameInput.addEventListener('input', hideConfirm);

setVisibility({ showTemp: false, showMilk: false, showDetails: false, showConfirm: false });
setupDrinkButtons();
setupTempButtons();
setupMilkButtons();
setupDateButtons();

const now = new Date();
const nowMinutes = now.getHours() * 60 + now.getMinutes();
isAfterWindow = nowMinutes > ORDER_WINDOW.endMinutes;
selectedDateKey = isAfterWindow ? 'tomorrow' : 'today';
dateButtons.forEach((button) => {
    if (isAfterWindow && button.dataset.date === 'today') {
        button.hidden = true;
        return;
    }
    if (button.dataset.date === selectedDateKey) {
        button.classList.add('active');
    }
    if (isAfterWindow && button.dataset.date === 'tomorrow') {
        button.textContent = 'tomorrow (preorder)';
    }
});
