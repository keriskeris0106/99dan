/* ==========================================================================
   구구단 어드벤처 (Multiplication Adventure) - Firebase Engine v7
   Firebase Auth (Google OAuth & Anonymous Login) & Auto Initialization
   ========================================================================== */

const firebaseConfig = {
  apiKey: window.ENV?.FIREBASE_API_KEY || "AIzaSyBAAl1iHevPGrXx9D-9wt39HSh3cmgnips",
  authDomain: window.ENV?.FIREBASE_AUTH_DOMAIN || "dan-d1b45.firebaseapp.com",
  projectId: window.ENV?.FIREBASE_PROJECT_ID || "dan-d1b45",
  storageBucket: window.ENV?.FIREBASE_STORAGE_BUCKET || "dan-d1b45.firebasestorage.app",
  messagingSenderId: window.ENV?.FIREBASE_MESSAGING_SENDER_ID || "18091041366",
  appId: window.ENV?.FIREBASE_APP_ID || "1:18091041366:web:1862d5eb5d528e9a10d1f7"
};

let isFirebaseInitialized = false;

if (typeof firebase !== 'undefined' && firebase.initializeApp) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    isFirebaseInitialized = true;
    console.log("✅ [Firebase] Firebase App initialized successfully for project: dan-d1b45");
  } catch (err) {
    console.warn("⚠️ [Firebase] Init warning:", err);
  }
}

window.GugudanFirebase = {
  isConfigured: isFirebaseInitialized,
  config: firebaseConfig,

  // Direct Google OAuth Popup
  async signInWithGoogle() {
    if (!typeof firebase === 'undefined' || !firebase.auth) {
      console.warn("Firebase Auth SDK not loaded");
      return null;
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      const result = await firebase.auth().signInWithPopup(provider);
      return result.user;
    } catch (err) {
      console.error("Firebase Google Auth Error:", err);
      throw err;
    }
  },

  // Anonymous Auth Login
  async signInAnonymously() {
    if (!typeof firebase === 'undefined' || !firebase.auth) {
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
