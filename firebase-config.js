/* ==========================================================================
   구구단 어드벤처 (Multiplication Adventure) - Firebase Engine v9
   Firebase Auth (Google OAuth & Anonymous Login) & Auto Initialization
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
    console.log("✅ [Firebase] Firebase App initialized for project: dan-d1b45");
  } catch (err) {
    console.warn("⚠️ [Firebase] Init warning:", err);
  }
}

window.GugudanFirebase = {
  isConfigured: isFirebaseInitialized,
  config: firebaseConfig,

  // Direct Google OAuth Popup with account selection prompt
  async signInWithGoogle() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      console.warn("Firebase Auth SDK not loaded");
      return null;
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await firebase.auth().signInWithPopup(provider);
      return result.user;
    } catch (err) {
      console.error("Firebase Google Auth Error:", err);
      throw err;
    }
  },

  // Anonymous Auth Login
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
  }
};
