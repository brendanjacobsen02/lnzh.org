// Firebase configuration and initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, increment, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = window.__FIREBASE_CONFIG__;

if (!firebaseConfig) {
    throw new Error('Missing Firebase config. Ensure assets/js/firebase-config.local.js or assets/js/firebase-config.public.js is loaded (see firebase-config.example.js).');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export functions for managing likes
export async function getAllLikes() {
    try {
        const likesRef = doc(db, 'thoughts', 'likes');
        const likesSnap = await getDoc(likesRef);

        if (likesSnap.exists()) {
            return likesSnap.data();
        } else {
            // Initialize if doesn't exist
            await setDoc(likesRef, {});
            return {};
        }
    } catch (error) {
        console.error('Error getting likes:', error);
        return {};
    }
}

export async function incrementLike(thoughtIndex, delta = 1) {
    try {
        const likesRef = doc(db, 'thoughts', 'likes');
        const field = `thought_${thoughtIndex}`;

        // Check if document exists first
        const likesSnap = await getDoc(likesRef);
        if (!likesSnap.exists()) {
            // Create document with initial like (only if delta is positive)
            if (delta > 0) {
                await setDoc(likesRef, { [field]: 1 });
                return 1;
            }
            return 0;
        } else {
            // Increment or decrement existing
            await updateDoc(likesRef, {
                [field]: increment(delta)
            });

            // Get updated value
            const updatedSnap = await getDoc(likesRef);
            const newValue = updatedSnap.data()[field] || 0;
            // Don't allow negative likes
            return Math.max(0, newValue);
        }
    } catch (error) {
        console.error('Error updating like:', error);
        return 0;
    }
}

export { app, db, firebaseConfig };
