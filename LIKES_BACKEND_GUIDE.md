# Backend Implementation Guide for Global Likes

The thoughts page is currently set up with **local-only likes** using `localStorage`. This means likes are stored in each user's browser and won't sync across devices or be shared globally.

## Current Implementation (Local Only)

The code uses `localStorage` to track likes:
- File: `assets/js/thoughts-filter.js`
- Functions: `getLikes()`, `saveLikes()`, `toggleLike()`

## To Add Global Likes Backend

You'll need to replace the localStorage calls with API calls to a backend. Here are your options:

### Option 1: Simple Node.js Backend (Recommended for learning)

**Setup:**
1. Create a simple Express.js server
2. Use a JSON file or SQLite database to store likes
3. Add endpoints:
   - `GET /api/likes` - Returns all likes
   - `POST /api/likes` - Increments likes for a thought

**Code changes needed in `thoughts-filter.js`:**
```javascript
async function getLikes() {
    const response = await fetch('/api/likes');
    return await response.json();
}

async function saveLikes(likes) {
    await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(likes)
    });
}
```

### Option 2: Firebase (Easiest, No Server Required)

**Setup:**
1. Create a Firebase project at https://firebase.google.com/
2. Enable Firestore Database
3. Add Firebase SDK to your HTML
4. Update the JavaScript functions

**Code changes:**
```javascript
import { getFirestore, doc, updateDoc, increment } from 'firebase/firestore';

async function toggleLike(index) {
    const db = getFirestore();
    const thoughtRef = doc(db, 'likes', `thought-${index}`);
    await updateDoc(thoughtRef, {
        count: increment(1)
    });
    // Then update UI...
}
```

### Option 3: Supabase (Similar to Firebase, More Control)

**Setup:**
1. Create a Supabase project at https://supabase.com/
2. Create a `likes` table with columns: `thought_id` (int), `count` (int)
3. Add the Supabase client library

**Code changes:**
```javascript
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('YOUR_URL', 'YOUR_KEY');

async function toggleLike(index) {
    const { data } = await supabase
        .from('likes')
        .update({ count: count + 1 })
        .eq('thought_id', index);
    // Then update UI...
}
```

### Option 4: Serverless Function (Vercel/Netlify)

If you're hosting on Vercel or Netlify, you can use serverless functions without setting up a full backend.

**Example for Vercel:**
Create `api/likes.js`:
```javascript
export default async function handler(req, res) {
    // Your like increment logic here
    // Store in a database like MongoDB or Postgres
}
```

## Security Considerations

- Add rate limiting to prevent spam
- Consider requiring authentication to prevent bot likes
- Use CORS properly to restrict which domains can call your API
- Sanitize all inputs

## Recommended Next Steps

1. Start with Firebase (easiest for static sites)
2. Or use a simple Node.js backend if you want more control
3. Consider adding user authentication so you can track who liked what
4. Add analytics to see which thoughts are most popular

The current code structure is **already backend-ready** - you just need to replace the localStorage calls in `getLikes()` and `saveLikes()` with your API calls!
