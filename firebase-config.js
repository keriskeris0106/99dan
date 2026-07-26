/* ==========================================================================
   구구단 어드벤처 (Multiplication Adventure) - Safe Firebase Config
   Environment Variables & Secure Injection
   Prevents API Keys from being exposed in public GitHub repositories.
   ========================================================================== */

// Safely read from Environment Variables (Vercel / Local .env)
const firebaseConfig = {
  apiKey: (typeof process !== 'undefined' && process.env?.FIREBASE_API_KEY) || window.ENV?.FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: (typeof process !== 'undefined' && process.env?.FIREBASE_AUTH_DOMAIN) || window.ENV?.FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: (typeof process !== 'undefined' && process.env?.FIREBASE_PROJECT_ID) || window.ENV?.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: (typeof process !== 'undefined' && process.env?.FIREBASE_STORAGE_BUCKET) || window.ENV?.FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: (typeof process !== 'undefined' && process.env?.FIREBASE_MESSAGING_SENDER_ID) || window.ENV?.FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: (typeof process !== 'undefined' && process.env?.FIREBASE_APP_ID) || window.ENV?.FIREBASE_APP_ID || "YOUR_APP_ID"
};

const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY";

if (!isFirebaseConfigured) {
  console.info(
    "💡 [보안 안내] Firebase API Key가 Vercel 환경변수(Environment Variables)로 안전하게 주입되기 전까지 오프라인 로컬 보안 모드(LocalStorage)로 작동합니다.\n" +
    "GitHub 공개 저장소에 키가 노출되지 않도록 Vercel 대시보드에서 환경변수를 설정해주세요."
  );
}

// Global Firebase helper object
window.GugudanFirebase = {
  isConfigured: isFirebaseConfigured,
  config: firebaseConfig,
  
  async signInWithGoogle() {
    if (!isFirebaseConfigured || typeof firebase === 'undefined') {
      console.log("LocalStorage Fallback: Google Login simulated");
      return null;
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      return await firebase.auth().signInWithPopup(provider);
    } catch (err) {
      console.error("Firebase Google Auth Error:", err);
      throw err;
    }
  },

  async signInAnonymously() {
    if (!isFirebaseConfigured || typeof firebase === 'undefined') {
      console.log("LocalStorage Fallback: Anonymous Login simulated");
      return null;
    }
    try {
      return await firebase.auth().signInAnonymously();
    } catch (err) {
      console.error("Firebase Anon Auth Error:", err);
      throw err;
    }
  }
};
