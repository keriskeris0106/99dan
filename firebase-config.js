/* ==========================================================================
   구구단 어드벤처 (Multiplication Adventure) - Firebase Engine v10
   Firebase Auth (Google OAuth & Anonymous Login) with AuthState Listener
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
    console.log("✅ [Firebase Engine v10] Initialized successfully for dan-d1b45");
  } catch (err) {
    console.warn("⚠️ [Firebase] Init warning:", err);
  }
}

window.GugudanFirebase = {
  isConfigured: isFirebaseInitialized,
  config: firebaseConfig,

  // Direct Google Auth Popup & Redirect Support
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
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
        console.warn("Popup blocked or closed, trying redirect mode...", err);
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
