# Firebase Setup - Step by Step

## 1. Create Firebase Account (2 minutes)

1. Go to: https://console.firebase.google.com/
2. Click "Add project"
3. Name it anything (e.g., "lnzh-website")
4. Disable Google Analytics (you don't need it)
5. Click "Create project"

## 2. Enable Firestore Database (1 minute)

1. In the left sidebar, click "Firestore Database"
2. Click "Create database"
3. Select "Start in **test mode**" (you can secure it later)
4. Choose a location (pick one close to you, like `us-west2`)
5. Click "Enable"

## 3. Get Your Config (1 minute)

1. Click the gear icon ⚙️ (top left) → "Project settings"
2. Scroll down to "Your apps"
3. Click the web icon `</>`
4. Name it (e.g., "lnzh-web")
5. **DON'T check "Firebase Hosting"**
6. Click "Register app"
7. You'll see something like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "lnzh-website.firebaseapp.com",
  projectId: "lnzh-website",
  storageBucket: "lnzh-website.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:xxxxxxxxxxxxx"
};
```

8. **Copy this whole config** and send it to me!

---

## That's it!

Once you have that config, just paste it here and I'll integrate it into your website. The whole thing takes about 5 minutes.

**Questions?**
- It's completely free (Firebase has generous free tier)
- No credit card required
- You can always change settings later
