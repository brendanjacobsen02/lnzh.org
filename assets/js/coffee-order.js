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
const STEP_CARAMEL = document.getElementById('step-caramel');
const STEP_CUP = document.getElementById('step-cup');
const STEP_DETAILS = document.getElementById('step-details');

const drinkButtons = STEP_DRINK.querySelectorAll('[data-drink]');
const tempButtons = STEP_TEMP.querySelectorAll('[data-temp]');
const milkButtons = STEP_MILK.querySelectorAll('[data-milk]');
const caramelButtons = STEP_CARAMEL ? STEP_CARAMEL.querySelectorAll('[data-caramel]') : [];
const cupButtons = STEP_CUP ? STEP_CUP.querySelectorAll('[data-cup]') : [];
const nameInput = document.getElementById('customer-name');
const dateButtonsWrapper = document.getElementById('date-buttons');
const slotList = document.getElementById('slot-list');
const slotNote = document.getElementById('slot-note');
const backButton = document.getElementById('back-button');
const submitButton = document.getElementById('submit-button');

const DEFAULT_ORDER_WINDOW = {
    startMinutes: 7 * 60 + 45,
    endMinutes: 8 * 60 + 15,
    interval: 5
};

const WEDNESDAY_ORDER_WINDOW = {
    startMinutes: 8 * 60 + 5,
    endMinutes: 8 * 60 + 35,
    interval: 5
};

const BLACKOUT_DATES = [];
const MAX_RESERVATIONS_PER_SLOT = 5;

const DEFAULT_SOLD_OUT = {
    espresso: true,
    latte: true,
    americano: true
};

let selectedDrink = null;
let selectedTemp = null;
let selectedMilk = null;
let selectedCaramel = null;
let selectedCup = null;
let selectedSlot = null;
let selectedDateKey = null;
let hasAutoScrolled = false;

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isBlackoutDate(dateString) {
    return BLACKOUT_DATES.includes(dateString);
}

function formatDateLabel(dateString, includeWeekday = true) {
    const parsed = new Date(`${dateString}T00:00:00`);
    const options = includeWeekday ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' };
    return parsed.toLocaleDateString(undefined, options);
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

function timeValueToMinutes(value) {
    if (!value) {
        return null;
    }
    const [hours, mins] = value.split(':').map((part) => Number(part));
    if (Number.isNaN(hours) || Number.isNaN(mins)) {
        return null;
    }
    return hours * 60 + mins;
}

function slugifyDrink(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
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

function getDrinkLabel(button) {
    if (!button) {
        return '';
    }
    if (button.dataset.drinkLabel) {
        return button.dataset.drinkLabel;
    }
    const label = button.dataset.drink || button.textContent.trim();
    button.dataset.drinkLabel = label;
    return label;
}

function setSoldOutVisual(button, soldOut) {
    if (!button) {
        return;
    }
    const tags = button.querySelector ? button.querySelector('.card-tags') : null;
    if (tags) {
        tags.textContent = soldOut ? 'sold out' : '';
    } else {
        const label = getDrinkLabel(button);
        button.textContent = soldOut ? `${label} (sold out)` : label;
    }
    button.disabled = soldOut;
    if (soldOut) {
        button.classList.add('sold-out');
        button.setAttribute('aria-disabled', 'true');
    } else {
        button.classList.remove('sold-out');
        button.removeAttribute('aria-disabled');
    }
}

function applySoldOutState(soldOutMap) {
    drinkButtons.forEach((button) => {
        const drinkKey = slugifyDrink(button.dataset.drink);
        const soldOut = Boolean(soldOutMap[drinkKey]);
        setSoldOutVisual(button, soldOut);
    });

    if (selectedDrink) {
        const selectedKey = slugifyDrink(selectedDrink);
        if (soldOutMap[selectedKey]) {
            selectedDrink = null;
            selectedTemp = null;
            selectedMilk = null;
            selectedCaramel = null;
            selectedCup = null;
            selectedSlot = null;
            clearSelections(drinkButtons);
            clearSelections(tempButtons);
            clearSelections(milkButtons);
            clearSelections(caramelButtons);
            clearSelections(cupButtons);
            slotList.innerHTML = '';
            slotNote.hidden = true;
            setVisibility({ showTemp: false, showMilk: false, showCaramel: false, showCup: false, showDetails: false });
        }
    }
}

async function loadSoldOutState() {
    applySoldOutState(DEFAULT_SOLD_OUT);
    try {
        const { db, firestore } = await getFirebase();
        const { doc, getDoc } = firestore;
        const menuRef = doc(db, 'menu', 'availability');
        const snap = await getDoc(menuRef);
        if (!snap.exists()) {
            applySoldOutState(DEFAULT_SOLD_OUT);
            return;
        }
        const data = snap.data() || {};
        const soldOut = data.soldOut && typeof data.soldOut === 'object' ? data.soldOut : data;
        applySoldOutState(normalizeSoldOutMap(soldOut));
    } catch (error) {
        console.error('Failed to load sold out status', error);
        applySoldOutState(DEFAULT_SOLD_OUT);
    }
}

function getPacificNowParts() {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const map = {};
    parts.forEach((part) => {
        map[part.type] = part.value;
    });
    return {
        year: map.year,
        month: map.month,
        day: map.day,
        hour: Number(map.hour),
        minute: Number(map.minute)
    };
}

function getPacificDateString() {
    const parts = getPacificNowParts();
    if (!parts || !parts.year) {
        return getLocalDateString();
    }
    return `${parts.year}-${parts.month}-${parts.day}`;
}

function getOrderWindow(dateKey) {
    if (!dateKey) {
        return DEFAULT_ORDER_WINDOW;
    }
    const day = new Date(`${dateKey}T00:00:00`).getDay();
    if (day === 3) {
        return WEDNESDAY_ORDER_WINDOW;
    }
    return DEFAULT_ORDER_WINDOW;
}

function getSlotMinutes(orderWindow) {
    const windowConfig = orderWindow || DEFAULT_ORDER_WINDOW;
    const slots = [];
    for (let time = windowConfig.startMinutes; time <= windowConfig.endMinutes; time += windowConfig.interval) {
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

function setVisibility({ showTemp, showMilk, showCaramel, showCup, showDetails }) {
    const wasTempHidden = STEP_TEMP.hidden;
    const wasMilkHidden = STEP_MILK.hidden;
    const wasCaramelHidden = STEP_CARAMEL ? STEP_CARAMEL.hidden : true;
    const wasCupHidden = STEP_CUP ? STEP_CUP.hidden : true;
    const wasDetailsHidden = STEP_DETAILS.hidden;

    STEP_TEMP.hidden = !showTemp;
    STEP_MILK.hidden = !showMilk;
    if (STEP_CARAMEL) {
        STEP_CARAMEL.hidden = !showCaramel;
    }
    if (STEP_CUP) {
        STEP_CUP.hidden = !showCup;
    }
    STEP_DETAILS.hidden = !showDetails;

    if (showTemp && wasTempHidden) {
        animateIn(STEP_TEMP);
    }
    if (showMilk && wasMilkHidden) {
        animateIn(STEP_MILK);
    }
    if (showCaramel && wasCaramelHidden && STEP_CARAMEL) {
        animateIn(STEP_CARAMEL);
    }
    if (showCup && wasCupHidden && STEP_CUP) {
        animateIn(STEP_CUP);
    }
    if (showDetails && wasDetailsHidden) {
        animateIn(STEP_DETAILS);
    }
}

function clearSelections(buttons) {
    buttons.forEach((btn) => btn.classList.remove('active'));
}

function getEarliestMinute(orderWindow) {
    const windowConfig = orderWindow || DEFAULT_ORDER_WINDOW;
    const pacificNow = getPacificNowParts();
    const nowMinutes = pacificNow.hour * 60 + pacificNow.minute;
    if (nowMinutes <= windowConfig.startMinutes) {
        return windowConfig.startMinutes;
    }
    return Math.ceil(nowMinutes / windowConfig.interval) * windowConfig.interval;
}

function renderSlots(dateKey, slotCounts = new Map()) {
    slotList.innerHTML = '';
    selectedSlot = null;

    if (isBlackoutDate(dateKey)) {
        slotNote.hidden = false;
        slotNote.textContent = 'No orders available for this day.';
        animateIn(slotNote);
        return;
    }

    const todayKey = getPacificDateString();
    const windowConfig = getOrderWindow(dateKey);
    const earliestMinute = dateKey === todayKey ? getEarliestMinute(windowConfig) : windowConfig.startMinutes;
    const slots = getSlotMinutes(windowConfig);

    if (earliestMinute > windowConfig.endMinutes) {
        slotNote.hidden = false;
        slotNote.textContent = 'The pickup window is closed for today.';
        animateIn(slotNote);
        return;
    }

    const availableSlots = slots.filter((slot) => {
        if (slot.minutes < earliestMinute) {
            return false;
        }
        const reservationCount = slotCounts.get(slot.value) || 0;
        return reservationCount < MAX_RESERVATIONS_PER_SLOT;
    });

    if (!availableSlots.length) {
        slotNote.hidden = false;
        slotNote.textContent = 'No pickup times are available for this day.';
        animateIn(slotNote);
        return;
    }

    slotNote.hidden = true;
    availableSlots.forEach((slot) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-btn';
        button.textContent = slot.label;
        button.dataset.time = slot.value;
        button.addEventListener('click', () => {
            slotList.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('active'));
            button.classList.add('active');
            selectedSlot = slot;
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

function requiresCaramel(drink) {
    return drink === 'Latte';
}

function requiresCup() {
    return true;
}

function getTempLabel() {
    return selectedTemp ? selectedTemp : 'No temp selection';
}

function getMilkLabel() {
    return selectedMilk ? selectedMilk : 'No milk selection';
}

function getDateLabel(dateString) {
    const today = getPacificDateString();
    const baseLabel = formatDateLabel(dateString);
    if (dateString !== today) {
        return `${baseLabel} (preorder)`;
    }
    return `${baseLabel} (today)`;
}

function selectedName() {
    return nameInput.value.trim();
}

async function getSlotCounts(dateKey) {
    if (!dateKey) {
        return new Map();
    }
    const { db, firestore } = await getFirebase();
    const { collection, getDocs, query, where } = firestore;
    const ordersRef = collection(db, 'orders');
    const snap = await getDocs(query(ordersRef, where('pickupDate', '==', dateKey)));
    const counts = new Map();
    snap.forEach((docSnap) => {
        const data = docSnap.data();
        const pickupTime = data ? data.pickupTime : null;
        if (!pickupTime) {
            return;
        }
        counts.set(pickupTime, (counts.get(pickupTime) || 0) + 1);
    });
    return counts;
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
        const slotCounts = await getSlotCounts(selectedDateKey);
        renderSlots(selectedDateKey, slotCounts);
    } catch (error) {
        console.error('Error loading slots', error);
        slotNote.hidden = false;
        slotNote.textContent = 'Unable to load pickup times right now. Please refresh.';
        animateIn(slotNote);
    }
}

async function purgeMorningOrdersIfNeeded() {
    const pacificParts = getPacificNowParts();
    if (!pacificParts || Number.isNaN(pacificParts.hour)) {
        return;
    }
    if (pacificParts.hour < 12) {
        return;
    }
    const dateString = getPacificDateString();
    const lastCleanup = localStorage.getItem('coffeeMorningCleanup');
    if (lastCleanup === dateString) {
        return;
    }
    try {
        const { db, firestore } = await getFirebase();
        const { collection, getDocs, query, where, writeBatch } = firestore;
        const ordersRef = collection(db, 'orders');
        const snap = await getDocs(query(ordersRef, where('pickupDate', '==', dateString)));
        if (snap.empty) {
            localStorage.setItem('coffeeMorningCleanup', dateString);
            return;
        }
        const batch = writeBatch(db);
        let deleteCount = 0;
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const minutes = timeValueToMinutes(data ? data.pickupTime : null);
            if (minutes === null) {
                return;
            }
            const windowConfig = getOrderWindow(dateString);
            if (minutes >= windowConfig.startMinutes && minutes <= windowConfig.endMinutes) {
                batch.delete(docSnap.ref);
                deleteCount += 1;
            }
        });
        if (deleteCount > 0) {
            await batch.commit();
        }
        localStorage.setItem('coffeeMorningCleanup', dateString);
    } catch (error) {
        console.error('Failed to purge morning orders', error);
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
    if (requiresCaramel(selectedDrink) && !selectedCaramel) {
        alert('Please choose whether to add caramel.');
        return;
    }
    if (requiresCup() && !selectedCup) {
        alert('Please choose yes or no for your own cup.');
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

    const pickupDate = selectedDateKey;
    try {
        const slotCounts = await getSlotCounts(pickupDate);
        const currentCount = slotCounts.get(selectedSlot.value) || 0;
        if (currentCount >= MAX_RESERVATIONS_PER_SLOT) {
            await refreshSlots();
            alert('That pickup time just filled up. Please choose another time.');
            return;
        }
        const { db, firestore } = await getFirebase();
        const { collection, addDoc, doc, runTransaction, serverTimestamp } = firestore;
        await addDoc(collection(db, 'orders'), {
            name: name,
            drink: selectedDrink,
            temp: requiresTemp(selectedDrink) ? selectedTemp : null,
            milk: requiresMilk(selectedDrink) ? selectedMilk : null,
            caramel: requiresCaramel(selectedDrink) ? selectedCaramel : null,
            ownCup: selectedCup || null,
            pickupDate: pickupDate,
            pickupTime: selectedSlot.value,
            status: 'incomplete',
            createdAt: serverTimestamp()
        });
        const countRef = doc(db, 'stats', 'orders');
        await runTransaction(db, async (tx) => {
            const snap = await tx.get(countRef);
            let current = 93;
            if (snap.exists()) {
                const data = snap.data();
                if (data && typeof data.totalOrders === 'number') {
                    current = Math.max(data.totalOrders, 93);
                }
            }
            tx.set(countRef, { totalOrders: current + 1 }, { merge: true });
        });

        const orderData = {
            name: name,
            drink: selectedDrink,
            temp: requiresTemp(selectedDrink) ? selectedTemp : null,
            milk: requiresMilk(selectedDrink) ? selectedMilk : null,
            caramel: requiresCaramel(selectedDrink) ? selectedCaramel : null,
            ownCup: selectedCup || null,
            pickupDate: pickupDate,
            pickupTime: selectedSlot.value,
            pickupLabel: selectedSlot.label
        };
        localStorage.setItem('coffeeLastOrder', JSON.stringify(orderData));
        window.location.href = './confirmed/';
    } catch (error) {
        console.error('Order failed', error);
        alert('Something went wrong placing your order. Please try again.');
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
            selectedCaramel = null;
            selectedCup = null;
            selectedSlot = null;
            clearSelections(tempButtons);
            clearSelections(milkButtons);
            clearSelections(caramelButtons);
            clearSelections(cupButtons);
            slotList.innerHTML = '';
            slotNote.hidden = true;
            if (requiresTemp(selectedDrink)) {
                setVisibility({ showTemp: true, showMilk: false, showCaramel: false, showCup: false, showDetails: false });
            } else {
                setVisibility({ showTemp: false, showMilk: false, showCaramel: false, showCup: true, showDetails: false });
            }
            if (!hasAutoScrolled) {
                window.scrollBy({ top: window.innerHeight * 0.2, behavior: 'smooth' });
                hasAutoScrolled = true;
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
            selectedCaramel = null;
            selectedCup = null;
            clearSelections(milkButtons);
            clearSelections(caramelButtons);
            clearSelections(cupButtons);
            if (requiresMilk(selectedDrink)) {
                setVisibility({ showTemp: true, showMilk: true, showCaramel: false, showCup: false, showDetails: false });
            } else {
                setVisibility({ showTemp: true, showMilk: false, showCaramel: false, showCup: true, showDetails: false });
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
            selectedCaramel = null;
            selectedCup = null;
            clearSelections(caramelButtons);
            clearSelections(cupButtons);
            if (requiresCaramel(selectedDrink)) {
                setVisibility({ showTemp: true, showMilk: true, showCaramel: true, showCup: false, showDetails: false });
            } else {
                setVisibility({ showTemp: true, showMilk: true, showCaramel: false, showCup: true, showDetails: false });
            }
        });
    });
}

function setupCaramelButtons() {
    caramelButtons.forEach((button) => {
        button.addEventListener('click', () => {
            clearSelections(caramelButtons);
            button.classList.add('active');
            selectedCaramel = button.dataset.caramel;
            selectedCup = null;
            clearSelections(cupButtons);
            setVisibility({ showTemp: true, showMilk: true, showCaramel: true, showCup: true, showDetails: false });
            window.scrollBy({ top: window.innerHeight * 0.12, behavior: 'smooth' });
        });
    });
}

function setupCupButtons() {
    cupButtons.forEach((button) => {
        button.addEventListener('click', () => {
            clearSelections(cupButtons);
            button.classList.add('active');
            selectedCup = button.dataset.cup;
            setVisibility({
                showTemp: requiresTemp(selectedDrink),
                showMilk: requiresMilk(selectedDrink),
                showCaramel: requiresCaramel(selectedDrink),
                showCup: true,
                showDetails: true
            });
            refreshSlots();
        });
    });
}

function isWeekday(date) {
    const day = date.getDay();
    return day >= 1 && day <= 5;
}

function getOrderDates() {
    const dates = [];
    const pacificNow = getPacificNowParts();
    const nowMinutes = pacificNow.hour * 60 + pacificNow.minute;
    const todayKey = getPacificDateString();
    const todayWindow = getOrderWindow(todayKey);
    const todayDate = new Date(`${todayKey}T00:00:00`);
    const includeToday = isWeekday(todayDate) && nowMinutes <= todayWindow.endMinutes && !isBlackoutDate(todayKey);
    const cursor = new Date(todayDate);

    if (includeToday) {
        dates.push(getLocalDateString(cursor));
    }

    while (dates.length < 3) {
        cursor.setDate(cursor.getDate() + 1);
        if (isWeekday(cursor)) {
            const dateKey = getLocalDateString(cursor);
            if (!isBlackoutDate(dateKey)) {
                dates.push(dateKey);
            }
        }
    }

    return dates;
}

function renderDateButtons() {
    dateButtonsWrapper.innerHTML = '';
    const dates = getOrderDates();
    const todayKey = getPacificDateString();
    dates.forEach((dateString) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'filter-btn';
        button.dataset.date = dateString;
        let label = formatDateLabel(dateString);
        if (dateString === todayKey) {
            label = `${label} (today)`;
        }
        button.textContent = label;
        button.addEventListener('click', () => {
            dateButtonsWrapper.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('active'));
            button.classList.add('active');
            selectedDateKey = dateString;
            selectedSlot = null;
            refreshSlots();
        });
        dateButtonsWrapper.appendChild(button);
    });

    if (dates.length) {
        const firstButton = dateButtonsWrapper.querySelector('.filter-btn');
        if (firstButton) {
            firstButton.classList.add('active');
            selectedDateKey = firstButton.dataset.date;
        }
    }
}

backButton.addEventListener('click', () => {
    if (requiresCup() && selectedCup) {
        setVisibility({
            showTemp: requiresTemp(selectedDrink),
            showMilk: requiresMilk(selectedDrink),
            showCaramel: requiresCaramel(selectedDrink),
            showCup: true,
            showDetails: false
        });
        return;
    }
    if (requiresCaramel(selectedDrink) && selectedCaramel) {
        setVisibility({ showTemp: true, showMilk: true, showCaramel: true, showCup: false, showDetails: false });
        return;
    }
    if (requiresMilk(selectedDrink) && selectedMilk) {
        setVisibility({ showTemp: true, showMilk: true, showCaramel: false, showCup: false, showDetails: false });
        return;
    }
    if (requiresTemp(selectedDrink)) {
        setVisibility({ showTemp: true, showMilk: false, showCaramel: false, showCup: false, showDetails: false });
        return;
    }
    setVisibility({ showTemp: false, showMilk: false, showCaramel: false, showCup: false, showDetails: false });
});

submitButton.addEventListener('click', placeOrder);

setVisibility({ showTemp: false, showMilk: false, showCaramel: false, showCup: false, showDetails: false });
setupDrinkButtons();
setupTempButtons();
setupMilkButtons();
setupCaramelButtons();
setupCupButtons();
renderDateButtons();
purgeMorningOrdersIfNeeded();
refreshSlots();
loadSoldOutState();
