/* ==========================================================================
   구구단 어드벤처 (Multiplication Adventure) - Firebase Engine v12
   Firebase Auth Engine with Clean Non-blocking Google OAuth & Popup Support
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBAAl1iHevPGrXx9D-9wt39HSh3cmgnips",
  authDomain: "dan-d1b45.firebaseapp.com",
  projectId: "dan-d1b45",
  storageBucket: "dan-d1b45.firebasestorage.app",
  messagingSenderId: "18091041366",
  appId: "1:18091041366:web:1862d5eb5d528e9a10d1f7"
};

let isFirebaseInitialized = false;

if (typeof firebase !== 'undefined' && firebase.initializeApp) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    isFirebaseInitialized = true;
    console.log("✅ [Firebase Engine v12] Initialized successfully for dan-d1b45");
  } catch (err) {
    console.warn("⚠️ [Firebase] Init warning:", err);
  }
}

window.GugudanFirebase = {
  isConfigured: isFirebaseInitialized,
  config: firebaseConfig,

  // Direct Google Auth Popup Support
  async signInWithGoogle() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      console.warn("Firebase Auth SDK not loaded");
      return null;
    }

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const result = await firebase.auth().signInWithPopup(provider);
      return result.user;
    } catch (err) {
      if (err.code === 'auth/popup-blocked') {
        console.warn("Popup blocked, trying redirect mode...", err);
        return await firebase.auth().signInWithRedirect(provider);
      }
      throw err;
    }
  },

  // Anonymous Login
  async signInAnonymously() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      return null;
    }
    try {
      const result = await firebase.auth().signInAnonymously();
      return result.user;
    } catch (err) {
      console.error("Firebase Anon Auth Error:", err);
      throw err;
    }
  },

  // AuthStateChanged Global Listener Setup
  onAuthStateChanged(callback) {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth().onAuthStateChanged(callback);
    }
  }
};
