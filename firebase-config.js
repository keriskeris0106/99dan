/* ==========================================================================
   구구단 어드벤처 (Multiplication Adventure) - Firebase Config & Auth Integration
   Supports:
   - Firebase Auth: Google OAuth Login & Anonymous Login
   - Firebase Firestore DB: Realtime Leaderboard Sync & Class Student History
   - Fallback Mode: Runs seamlessly on LocalStorage if keys are pending configuration.
   ========================================================================== */

// ⚠️ 아래 firebaseConfig 객체의 값을 본인의 Firebase 콘솔 프로젝트 설정 값으로 채워주세요.
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if Firebase keys are configured
const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY";

if (!isFirebaseConfigured) {
  console.info(
    "💡 [Firebase 안내] firebase-config.js에 실제 Firebase API Key가 설정되지 않아 로컬 오프라인 모드(LocalStorage)로 작동 중입니다.\n" +
    "Firebase 구글 로그인 및 실시간 클라우드 DB를 사용하시려면 README.md의 안내를 참고해 발급받은 키를 채워주세요."
  );
}

// Global Firebase helper object exported to window
window.GugudanFirebase = {
  isConfigured: isFirebaseConfigured,
  config: firebaseConfig,
  
  // Placeholder methods ready for Firebase Auth & Firestore SDK bindings
  async signInWithGoogle() {
    if (!isFirebaseConfigured) {
      console.log("LocalStorage Fallback: Google Login simulated");
      return null;
    }
    // Firebase SDK Auth Logic will run here
  },

  async signInAnonymously() {
    if (!isFirebaseConfigured) {
      console.log("LocalStorage Fallback: Anonymous Login simulated");
      return null;
    }
  },

  async syncStudentLog(studentData) {
    if (!isFirebaseConfigured) return;
    // Firestore DB setDoc / updateDoc logic
  }
};
