/* ==========================================================================
   구구단 & 나눗셈 어드벤처 (Gugudan & Division Adventure) - Core Engine v36
   Dual Mode Architecture Engine
   Fixes & Refinements:
   1. Distinct Division Game Names:
      - Game 1: 나눗셈 스피드 레이스 (12 ÷ 3 = ?)
      - Game 2: 나눗셈 나누는 수 탐정 (12 ÷ ? = 4)
      - Game 3: 나눗셈 나누어지는 수 탐정 (? ÷ 3 = 4)
      Reflected dynamically in Teacher Admin Table headers!
   2. Mode Switcher for All User Roles: Student, Anon, and Teacher logins seamlessly toggle modes.
   3. Division Boss Dungeon Problem Fix: Guaranteed 10 division problems (12 ÷ 3 = ?) in Division Boss.
   4. Teacher Account Free Dungeon Entrance: Teacher logins enter Boss Dungeon with 0 gold deduction!
   ========================================================================== */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. Data Models & Constants
  // -------------------------------------------------------------------------

  let currentMode = 'gugudan'; // 'gugudan' | 'division'

  const TITLES_MAP = {
    gugudan: [
      { level: 0, emoji: '🐣', name: '구구단 수련생', reqDesc: '기본 부여', reqCount: 0 },
      { level: 1, emoji: '⚡', name: '구구단 도전사', reqDesc: '보스전 10회 도전', reqCount: 10 },
      { level: 2, emoji: '🔥', name: '구구단 탐험가', reqDesc: '보스전 30회 도전', reqCount: 30 },
      { level: 3, emoji: '🛡️', name: '구구단 수호자', reqDesc: '보스전 50회 도전', reqCount: 50 },
      { level: 4, emoji: '⚔️', name: '구구단 기사단', reqDesc: '보스전 80회 도전', reqCount: 80 },
      { level: 5, emoji: '👑', name: '구구단 정복자', reqDesc: '보스전 100회 도전', reqCount: 100 },
      { level: 6, emoji: '🏆', name: '구구단 영웅', reqDesc: '보스전 500회 도전', reqCount: 500 }
    ],
    division: [
      { level: 0, emoji: '🐣', name: '나눗셈 수련생', reqDesc: '기본 부여', reqCount: 0 },
      { level: 1, emoji: '⚡', name: '나눗셈 도전사', reqDesc: '보스전 10회 도전', reqCount: 10 },
      { level: 2, emoji: '🔥', name: '나눗셈 탐험가', reqDesc: '보스전 30회 도전', reqCount: 30 },
      { level: 3, emoji: '🛡️', name: '나눗셈 수호자', reqDesc: '보스전 50회 도전', reqCount: 50 },
      { level: 4, emoji: '➗', name: '나눗셈 기사단', reqDesc: '보스전 80회 도전', reqCount: 80 },
      { level: 5, emoji: '👑', name: '나눗셈 정복자', reqDesc: '보스전 100회 도전', reqCount: 100 },
      { level: 6, emoji: '🏆', name: '나눗셈 영웅', reqDesc: '보스전 500회 도전', reqCount: 500 }
    ]
  };

  const BOSS_ENTRY_GOLD = 100;
  const REWARD_GOLD_PER_PROBLEM = 1;

  let registeredClasses = {};
  let registeredTeachersMap = {};
  let allPlayersMap = {};
  let sampleClassStudents = [];
  let isLoggingInProgress = false;

  // Firebase Firestore Reference
  let db = null;
  if (typeof firebase !== 'undefined' && firebase.firestore) {
    try {
      db = firebase.firestore();
      console.log("🔥 [Firestore Engine v36 Dual-Mode] Cloud Database connected!");
    } catch (e) {
      console.warn("Firestore connection warning:", e);
    }
  }

  // Automatic Firebase Auth Helper to prevent permission-denied errors
  async function ensureFirebaseAuth() {
    if (typeof firebase === 'undefined' || !firebase.auth) return null;
    if (firebase.auth().currentUser) {
      return firebase.auth().currentUser;
    }
    try {
      const anonRes = await firebase.auth().signInAnonymously();
      console.log("🔥 [Firebase Auth] Signed in anonymously:", anonRes.user.uid);
      return anonRes.user;
    } catch (e) {
      console.warn("Firebase anon auth error:", e);
      return null;
    }
  }

  // Web Audio Synthesizer
  class SoundEngine {
    constructor() {
      this.enabled = true;
      this.audioCtx = null;
    }

    init() {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    playTone(freq, type = 'sine', duration = 0.08, gainVal = 0.08) {
      if (!this.enabled) return;
      this.init();
      if (!this.audioCtx) return;

      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        
        gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      } catch (e) {
        console.warn('Audio error:', e);
      }
    }

    playCorrect() {
      this.playTone(523.25, 'sine', 0.08, 0.08); // C5
      setTimeout(() => this.playTone(659.25, 'sine', 0.1, 0.08), 60); // E5
    }

    playWrong() {
      if (!this.enabled) return;
      this.init();
      if (!this.audioCtx) return;

      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sawtooth';
        
        osc.frequency.setValueAtTime(160, this.audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(65, this.audioCtx.currentTime + 0.25);

        gain.gain.setValueAtTime(0.18, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.25);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.25);
      } catch (e) {
        console.warn('Audio error:', e);
      }
    }

    playCombo(count) {
      const baseFreq = 450 + Math.min(count, 15) * 30;
      this.playTone(baseFreq, 'sine', 0.08, 0.08);
    }

    playHit() {
      this.playTone(120, 'sine', 0.12, 0.15);
    }

    playVictory() {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'sine', 0.2, 0.12), idx * 100);
      });
    }
  }

  const sound = new SoundEngine();

  // -------------------------------------------------------------------------
  // 2. Application State Management & Dual Mode Data Accessor
  // -------------------------------------------------------------------------
  
  let currentUser = null;
  let navigationHistory = ['lobbyView'];

  let gameState = {
    activeGame: null,
    timerId: null,
    timeRemaining: 25,
    elapsedTime: 0,
    solvedCount: 0,
    currentCombo: 0,
    maxCombo: 0,
    earnedGold: 0,
    
    bossProblemIndex: 0,
    bossProblems: [],
    bossStartTime: 0,
    bossHp: 10,
    
    currentQuestion: null,
    tileSelection: []
  };

  // Dual-Mode User Data Accessor Helper with 100% Backward Compatibility
  function getUserModeData(user, mode = currentMode) {
    if (!user) {
      return {
        currentGold: 0,
        totalGold: 0,
        totalSolved: 0,
        weeklySolved: 0,
        bossCount: 0,
        bossFastestTime: null,
        gameClears: [0, 0, 0],
        todayClears: [0, 0, 0],
        lastActiveDate: '',
        weakTableErrors: {},
        titleIndex: 0,
        lastWeeklyResetKey: ''
      };
    }

    if (!user.modeData) {
      user.modeData = {
        gugudan: {
          currentGold: user.currentGold !== undefined ? user.currentGold : 0,
          totalGold: user.totalGold !== undefined ? user.totalGold : 0,
          totalSolved: user.totalSolved !== undefined ? user.totalSolved : 0,
          weeklySolved: user.weeklySolved !== undefined ? user.weeklySolved : 0,
          bossCount: user.bossCount !== undefined ? user.bossCount : 0,
          bossFastestTime: user.bossFastestTime !== undefined ? user.bossFastestTime : null,
          gameClears: user.gameClears || [0, 0, 0],
          todayClears: user.todayClears || [0, 0, 0],
          lastActiveDate: user.lastActiveDate || '',
          weakTableErrors: user.weakTableErrors || {},
          titleIndex: user.titleIndex || 0,
          lastWeeklyResetKey: user.lastWeeklyResetKey || ''
        },
        division: {
          currentGold: 0,
          totalGold: 0,
          totalSolved: 0,
          weeklySolved: 0,
          bossCount: 0,
          bossFastestTime: null,
          gameClears: [0, 0, 0],
          todayClears: [0, 0, 0],
          lastActiveDate: '',
          weakTableErrors: {},
          titleIndex: 0,
          lastWeeklyResetKey: ''
        }
      };
    }

    if (!user.modeData.gugudan) {
      user.modeData.gugudan = {
        currentGold: user.currentGold !== undefined ? user.currentGold : 0,
        totalGold: user.totalGold !== undefined ? user.totalGold : 0,
        totalSolved: user.totalSolved !== undefined ? user.totalSolved : 0,
        weeklySolved: user.weeklySolved !== undefined ? user.weeklySolved : 0,
        bossCount: user.bossCount !== undefined ? user.bossCount : 0,
        bossFastestTime: user.bossFastestTime !== undefined ? user.bossFastestTime : null,
        gameClears: user.gameClears || [0, 0, 0],
        todayClears: user.todayClears || [0, 0, 0],
        lastActiveDate: user.lastActiveDate || '',
        weakTableErrors: user.weakTableErrors || {},
        titleIndex: user.titleIndex || 0,
        lastWeeklyResetKey: user.lastWeeklyResetKey || ''
      };
    }

    if (!user.modeData.division) {
      user.modeData.division = {
        currentGold: 0,
        totalGold: 0,
        totalSolved: 0,
        weeklySolved: 0,
        bossCount: 0,
        bossFastestTime: null,
        gameClears: [0, 0, 0],
        todayClears: [0, 0, 0],
        lastActiveDate: '',
        weakTableErrors: {},
        titleIndex: 0,
        lastWeeklyResetKey: ''
      };
    }

    const modeObj = user.modeData[mode];

    // Mirror active mode fields to root properties for backward compatibility
    user.currentGold = modeObj.currentGold;
    user.totalGold = modeObj.totalGold;
    user.totalSolved = modeObj.totalSolved;
    user.weeklySolved = modeObj.weeklySolved;
    user.bossCount = modeObj.bossCount;
    user.bossFastestTime = modeObj.bossFastestTime;
    user.gameClears = modeObj.gameClears;
    user.todayClears = modeObj.todayClears;
    user.lastActiveDate = modeObj.lastActiveDate;
    user.weakTableErrors = modeObj.weakTableErrors;
    user.titleIndex = modeObj.titleIndex;
    user.lastWeeklyResetKey = modeObj.lastWeeklyResetKey;

    return modeObj;
  }

  // KST Date Helpers
  function getTodayKSTDateString() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (9 * 3600000));
    const yyyy = kst.getFullYear();
    const mm = String(kst.getMonth() + 1).padStart(2, '0');
    const dd = String(kst.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function getWeeklyResetKeyKST() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kst = new Date(utc + (9 * 3600000));
    
    const day = kst.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    
    const monday = new Date(kst);
    monday.setDate(kst.getDate() + diffToMonday);
    
    const yyyy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function checkAndUpdateUserWeeklyReset(user, mode = currentMode) {
    if (!user) return;
    const mData = getUserModeData(user, mode);
    const currentWeeklyKey = getWeeklyResetKeyKST();
    if (mData.lastWeeklyResetKey !== currentWeeklyKey) {
      mData.weeklySolved = 0;
      mData.lastWeeklyResetKey = currentWeeklyKey;
    }
  }

  function generateRandomAnonCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = '';
    for (let i = 0; i < 4; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
  }

  function getStudentDisplayName(user) {
    if (!user) return '익명';
    if (user.role === 'anon') {
      return `${user.name}`;
    }
    if (user.role === 'student') {
      const classNameStr = user.className || '미설정';
      return `${user.name} (${classNameStr})`;
    }
    return user.name;
  }

  function getFullUserTitleString(user, mode = currentMode) {
    const mData = getUserModeData(user, mode);
    const titlesList = TITLES_MAP[mode] || TITLES_MAP.gugudan;
    const titleObj = titlesList[mData.titleIndex || 0] || titlesList[0];
    return `${titleObj.emoji} ${getStudentDisplayName(user)}`;
  }

  function saveSessionUser(user) {
    currentUser = user;
    if (user) {
      if (currentUser.role !== 'teacher' && currentUser.role !== 'superadmin') {
        getUserModeData(currentUser, currentMode);
      }
      localStorage.setItem('gugudan_logged_user_v34', JSON.stringify(user));
    } else {
      localStorage.removeItem('gugudan_logged_user_v34');
    }
  }

  function loadSessionUser() {
    const savedUser = localStorage.getItem('gugudan_logged_user_v34');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u && u.role !== 'teacher' && u.role !== 'superadmin') {
          getUserModeData(u, currentMode);
        }
        return u;
      } catch (e) {
        console.error('Session user parse error:', e);
      }
    }
    return null;
  }

  function loadStorageData() {
    const saved = localStorage.getItem('gugudan_adventure_data_v34');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        sampleClassStudents = parsed.students || [];
        if (parsed.classes) registeredClasses = parsed.classes;
        if (parsed.teachers) registeredTeachersMap = parsed.teachers;
        if (parsed.players) allPlayersMap = parsed.players;
      } catch (e) {
        console.error('Storage parse error:', e);
      }
    }

    if (!sampleClassStudents) sampleClassStudents = [];
    if (!allPlayersMap) allPlayersMap = {};
    if (!registeredClasses) registeredClasses = {};
    if (!registeredTeachersMap) registeredTeachersMap = {};

    // Initialize modeData for all loaded students
    sampleClassStudents.forEach(s => getUserModeData(s, currentMode));
    Object.values(allPlayersMap).forEach(p => getUserModeData(p, currentMode));

    applyDataCompensationForKimWooYoung();
  }

  function applyDataCompensationForKimWooYoung() {
    const listToCompensate = [...sampleClassStudents, ...Object.values(allPlayersMap)];
    let count = 0;

    listToCompensate.forEach(s => {
      if (!s) return;
      const isTarget = (s.name === '김우영' || (s.id && (s.id.includes('김우영') || s.id.includes('%EA%B9%80%EC%9A%B0%EC%98%81'))));
      if (isTarget && !s._kimWooYoungCompensated_v5) {
        s._kimWooYoungCompensated_v5 = true;
        if (!s.modeData) s.modeData = {};

        s.modeData.gugudan = {
          ...(s.modeData.gugudan || {}),
          currentGold: 75,
          totalGold: 1000
        };

        s.modeData.division = {
          ...(s.modeData.division || {}),
          currentGold: 0,
          totalGold: 0
        };

        const activeModeObj = s.modeData[currentMode] || s.modeData.gugudan;
        s.currentGold = activeModeObj.currentGold;
        s.totalGold = activeModeObj.totalGold;

        syncToFirestore('students', s.id, s);
        count++;
      }
    });

    if (currentUser && (currentUser.name === '김우영' || (currentUser.id && (currentUser.id.includes('김우영') || currentUser.id.includes('%EA%B9%80%EC%9A%B0%EC%98%81'))))) {
      if (!currentUser._kimWooYoungCompensated_v5) {
        currentUser._kimWooYoungCompensated_v5 = true;
        if (!currentUser.modeData) currentUser.modeData = {};

        currentUser.modeData.gugudan = {
          ...(currentUser.modeData.gugudan || {}),
          currentGold: 75,
          totalGold: 1000
        };

        currentUser.modeData.division = {
          ...(currentUser.modeData.division || {}),
          currentGold: 0,
          totalGold: 0
        };

        const activeModeObj = currentUser.modeData[currentMode] || currentUser.modeData.gugudan;
        currentUser.currentGold = activeModeObj.currentGold;
        currentUser.totalGold = activeModeObj.totalGold;

        saveSessionUser(currentUser);
        syncToFirestore('students', currentUser.id, currentUser);
        updateHeaderUI();
      }
    }

    if (count > 0) {
      saveStorageData();
      console.log(`💰 [Data Migration] Initialized 김우영 (111111) base Gold once: Gugudan (75/1000), Division (0/0)`);
    }
  }

  function saveStorageData() {
    const payload = {
      students: sampleClassStudents,
      classes: registeredClasses,
      teachers: registeredTeachersMap,
      players: allPlayersMap,
      lastUpdated: Date.now()
    };
    localStorage.setItem('gugudan_adventure_data_v34', JSON.stringify(payload));
    refreshAllLiveViews();
  }

  // Cloud Firestore Sync Writer
  async function syncToFirestore(collectionName, docId, dataObj) {
    if (!db) return;
    try {
      await ensureFirebaseAuth();
      await db.collection(collectionName).doc(docId).set(dataObj, { merge: true });
      console.log(`☁️ [Firestore Sync] ${collectionName}/${docId} updated`);
    } catch (e) {
      console.warn(`Firestore sync warning:`, e);
    }
  }

  // Global Realtime Firestore Cloud Listeners
  let unsubscribeStudentsListener = null;

  function initFirestoreRealtimeListeners() {
    if (!db) return;

    db.collection('classes').onSnapshot((snapshot) => {
      snapshot.forEach(doc => {
        const data = doc.data();
        registeredClasses[doc.id] = data;

        sampleClassStudents.forEach(s => {
          if (s.inviteCode === doc.id && data.className) {
            s.className = data.className;
          }
        });
        if (currentUser && currentUser.inviteCode === doc.id && data.className) {
          currentUser.className = data.className;
        }
      });
      saveStorageData();
    }, err => console.warn("Firestore classes listener err:", err));

    if (unsubscribeStudentsListener) unsubscribeStudentsListener();
    unsubscribeStudentsListener = db.collection('students').onSnapshot((snapshot) => {
      snapshot.forEach(doc => {
        const data = doc.data();
        getUserModeData(data, currentMode);
        allPlayersMap[data.id] = data;

        const idx = sampleClassStudents.findIndex(s => s.id === data.id || (s.name === data.name && s.inviteCode === data.inviteCode));
        if (idx >= 0) {
          sampleClassStudents[idx] = data;
        } else {
          sampleClassStudents.push(data);
        }
      });
      saveStorageData();
    }, err => console.warn("Firestore students listener err:", err));
  }

  async function saveUserDataInList(user) {
    if (!user || user.role === 'teacher' || user.role === 'superadmin') return;

    getUserModeData(user, currentMode);
    allPlayersMap[user.id] = user;

    if (user.role === 'student') {
      const idx = sampleClassStudents.findIndex(s => s.id === user.id || (s.name === user.name && s.inviteCode === user.inviteCode));
      if (idx >= 0) {
        sampleClassStudents[idx] = user;
      } else {
        sampleClassStudents.push(user);
      }
      await syncToFirestore('students', user.id, user);
    } else if (user.role === 'anon') {
      await syncToFirestore('students', user.id, user);
    }

    saveStorageData();
  }

  function refreshAllLiveViews() {
    updateHeaderUI();

    const adminView = document.getElementById('adminView');
    if (adminView && adminView.classList.contains('active')) {
      renderTeacherAdminPage();
    }

    const hallView = document.getElementById('hallView');
    if (hallView && hallView.classList.contains('active')) {
      const activeTabEl = document.querySelector('.hall-tab-btn.active');
      const activeTab = activeTabEl ? activeTabEl.dataset.tab : 'gold';
      renderHallOfHeroes(activeTab);
    }

    updateLobbyContentByMode();
  }

  function updateUserTitleIndex(user, mode = currentMode) {
    if (!user || user.role === 'teacher' || user.role === 'superadmin') return;
    const mData = getUserModeData(user, mode);
    const titlesList = TITLES_MAP[mode] || TITLES_MAP.gugudan;
    let newIndex = 0;
    const bCount = mData.bossCount || 0;
    for (let i = titlesList.length - 1; i >= 0; i--) {
      if (bCount >= titlesList[i].reqCount) {
        newIndex = i;
        break;
      }
    }
    mData.titleIndex = newIndex;
    user.titleIndex = newIndex;
  }

  function openModal(modalId) {
    if (isLoggingInProgress && modalId === 'loginModal') return;
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  // -------------------------------------------------------------------------
  // 3. Mode Switcher (구구단 vs 나눗셈) Implementation
  // -------------------------------------------------------------------------

  function setMode(mode) {
    currentMode = mode;

    document.querySelectorAll('.mode-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    document.body.classList.toggle('mode-division', mode === 'division');

    const logoIcon = document.getElementById('headerLogoIcon');
    const logoText = document.getElementById('headerLogoText');
    if (logoIcon) logoIcon.textContent = mode === 'division' ? '➗' : '⚔️';
    if (logoText) logoText.textContent = mode === 'division' ? '나눗셈 어드벤처' : '구구단 어드벤처';

    if (currentUser) {
      getUserModeData(currentUser, currentMode);
    }

    refreshAllLiveViews();
  }

  function updateLobbyContentByMode() {
    const isDiv = (currentMode === 'division');

    // Lobby Section Title
    const sectionTitle = document.querySelector('#lobbyView .section-title');
    if (sectionTitle) {
      sectionTitle.textContent = isDiv ? '🏋️‍♂️ 나눗셈 훈련하기' : '🏋️‍♂️ 구구단 훈련하기';
    }

    // Game Card 1
    const card1 = document.getElementById('cardGame1');
    if (card1) {
      card1.querySelector('.game-name').textContent = isDiv ? '나눗셈 스피드 레이스' : '구구단 스피드 레이스';
      card1.querySelector('.game-formula-example').innerHTML = isDiv ? '설명: <code>12 ÷ 3 = ?</code>' : '설명: <code>2 x 3 = ?</code>';
      card1.querySelector('.game-desc').textContent = isDiv ? '제시되는 나눗셈의 올바른 정답을 순발력 있게 클릭하세요!' : '제시되는 곱셈의 올바른 정답을 순발력 있게 클릭하세요!';
    }

    // Game Card 2
    const card2 = document.getElementById('cardGame2');
    if (card2) {
      card2.querySelector('.game-name').textContent = isDiv ? '나눗셈 나누는 수 탐정' : '구구단 숫자 탐정';
      card2.querySelector('.game-formula-example').innerHTML = isDiv ? '설명: <code>12 ÷ ? = 4</code>' : '설명: <code>? x 3 = 6</code>';
      card2.querySelector('.game-desc').textContent = isDiv ? '나누는 빈칸에 들어갈 숫자를 찾아내는 숫자 탐정이 되어보세요!' : '곱해지는 빈칸에 들어갈 숫자를 찾아내는 숫자 탐정이 되어보세요!';
    }

    // Game Card 3
    const card3 = document.getElementById('cardGame3');
    if (card3) {
      card3.querySelector('.game-name').textContent = isDiv ? '나눗셈 나누어지는 수 탐정' : '구구단 짝 맞추기';
      card3.querySelector('.game-formula-example').innerHTML = isDiv ? '설명: <code>? ÷ 3 = 4</code>' : '설명: <code>? x ? = 6</code>';
      card3.querySelector('.game-desc').textContent = isDiv ? '나누어지는 빈칸에 들어갈 숫자를 빠르게 맞혀보세요!' : '결과값 곱이 제시되면, 곱해서 해당 숫자가 되는 두 수 조각을 연속 클릭하세요!';
    }

    // Boss Dungeon Banner Card
    const bossTitle = document.querySelector('#bossBannerCard .boss-title');
    const bossDesc = document.querySelector('#bossBannerCard .boss-desc');
    const bossBtn = document.getElementById('enterBossBtn');

    if (bossTitle) bossTitle.textContent = isDiv ? '👾 나눗셈 마왕 보스전' : '👹 구구단 마왕 보스전';
    if (bossDesc) {
      bossDesc.innerHTML = isDiv 
        ? '마왕이 10개의 나눗셈 문제를 던집니다! 10문제를 연속으로 완파하여 마왕을 봉인하세요.<br><small>⚠️ 틀려도 시간은 흘러가며, 정답을 선택해야만 다음 문제로 넘어갈 수 있습니다.</small>'
        : '마왕이 10개의 구구단 문제를 던집니다! 10문제를 연속으로 완파하여 마왕을 봉인하세요.<br><small>⚠️ 틀려도 시간은 흘러가며, 정답을 선택해야만 다음 문제로 넘어갈 수 있습니다.</small>';
    }
    if (bossBtn) {
      bossBtn.textContent = isDiv ? '🔥 나눗셈 마왕 던전 입장하기 (100 Gold)' : '🔥 구구단 마왕 던전 입장하기 (100 Gold)';
    }

    // Hall of Heroes Triple Column Titles
    const col1 = document.querySelector('#miniRankBody1')?.closest('.mini-rank-column')?.querySelector('.column-title');
    const col2 = document.querySelector('#miniRankBody2')?.closest('.mini-rank-column')?.querySelector('.column-title');
    const col3 = document.querySelector('#miniRankBody3')?.closest('.mini-rank-column')?.querySelector('.column-title');

    if (col1) col1.textContent = isDiv ? '🎯 나눗셈 스피드 레이스' : '🎯 구구단 스피드 레이스';
    if (col2) col2.textContent = isDiv ? '🔍 나눗셈 나누는 수 탐정' : '🔍 구구단 숫자 탐정';
    if (col3) col3.textContent = isDiv ? '🧩 나눗셈 나누어지는 수 탐정' : '🧩 구구단 짝 맞추기';
  }

  // -------------------------------------------------------------------------
  // 4. View & Navigation Management
  // -------------------------------------------------------------------------

  function showView(viewId, pushHistory = true) {
    const views = ['lobbyView', 'gamePlayView', 'bossPlayView', 'hallView', 'adminView'];
    views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    });

    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
    }

    if (viewId === 'bossPlayView') {
      document.body.classList.add('in-dungeon');
    } else {
      document.body.classList.remove('in-dungeon');
    }

    if (pushHistory && navigationHistory[navigationHistory.length - 1] !== viewId) {
      navigationHistory.push(viewId);
    }

    refreshAllLiveViews();
  }

  function handleHomeNavigation() {
    if (gameState.timerId) {
      clearInterval(gameState.timerId);
      gameState.timerId = null;
    }

    if (!currentUser && !isLoggingInProgress) {
      openModal('loginModal');
      showView('lobbyView', false);
    } else {
      showView('lobbyView', false);
    }
  }

  function handleLogout() {
    if (gameState.timerId) {
      clearInterval(gameState.timerId);
      gameState.timerId = null;
    }
    if (window.firebase && window.firebase.auth) {
      window.firebase.auth().signOut().catch(() => {});
    }
    saveSessionUser(null);
    openModal('loginModal');
    showView('lobbyView', false);
  }

  function updateHeaderUI() {
    if (!currentUser) return;

    if (currentUser.role !== 'teacher' && currentUser.role !== 'superadmin') {
      const mData = getUserModeData(currentUser, currentMode);
      updateUserTitleIndex(currentUser, currentMode);
      const titlesList = TITLES_MAP[currentMode] || TITLES_MAP.gugudan;
      const titleObj = titlesList[mData.titleIndex || 0] || titlesList[0];

      document.getElementById('headerUserTitleEmoji').textContent = titleObj.emoji;
      document.getElementById('headerUserTitleName').textContent = titleObj.name;
      document.getElementById('userGoldVal').textContent = mData.currentGold || 0;
    } else {
      document.getElementById('headerUserTitleEmoji').textContent = '👩‍🏫';
      document.getElementById('headerUserTitleName').textContent = '교사';
      document.getElementById('userGoldVal').textContent = '999';
    }

    if (currentUser.role === 'student' && registeredClasses[currentUser.inviteCode]) {
      currentUser.className = registeredClasses[currentUser.inviteCode].className || currentUser.className;
    }

    document.getElementById('headerUserName').textContent = getStudentDisplayName(currentUser);

    const roleBadge = document.getElementById('headerUserRoleBadge');
    if (currentUser.role === 'superadmin') roleBadge.textContent = '최종관리자';
    else if (currentUser.role === 'teacher') roleBadge.textContent = '교사';
    else if (currentUser.role === 'anon') roleBadge.textContent = '익명';
    else roleBadge.textContent = '학생';

    const adminBtn = document.getElementById('openAdminBtn');
    if (currentUser.role === 'teacher' || currentUser.role === 'superadmin') {
      adminBtn.classList.remove('hidden');
    } else {
      adminBtn.classList.add('hidden');
    }
  }

  // -------------------------------------------------------------------------
  // 5. Question Generator Engine (Gugudan & Division)
  // -------------------------------------------------------------------------

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateGugudanQuestion(gameType) {
    const a = getRandomInt(2, 9);
    const b = getRandomInt(2, 9);
    const product = a * b;

    if (gameType === 1 || gameType === 'boss') {
      const options = new Set([product]);
      while (options.size < 4) {
        let fake = getRandomInt(2, 9) * getRandomInt(2, 9);
        if (fake !== product) options.add(fake);
      }
      return {
        type: 1,
        mode: 'gugudan',
        a, b, product,
        prompt: `${a} × ${b} = ?`,
        correctAnswer: product,
        options: Array.from(options).sort(() => Math.random() - 0.5)
      };
    } else if (gameType === 2) {
      const hideFirst = Math.random() < 0.5;
      const missing = hideFirst ? a : b;

      const options = new Set([missing]);
      while (options.size < 4) {
        let fake = getRandomInt(2, 9);
        if (fake !== missing) options.add(fake);
      }
      return {
        type: 2,
        mode: 'gugudan',
        a, b, product,
        missing, hideFirst,
        prompt: hideFirst ? `? × ${b} = ${product}` : `${a} × ? = ${product}`,
        correctAnswer: missing,
        options: Array.from(options).sort(() => Math.random() - 0.5)
      };
    } else if (gameType === 3) {
      const tileList = [
        { id: 1, val: a, isCorrect: true },
        { id: 2, val: b, isCorrect: true }
      ];
      while (tileList.length < 6) {
        const randVal = getRandomInt(2, 9);
        tileList.push({ id: tileList.length + 1, val: randVal, isCorrect: false });
      }
      return {
        type: 3,
        mode: 'gugudan',
        a, b, product,
        prompt: `? × ? = ${product}`,
        correctPair: [a, b],
        tiles: tileList.sort(() => Math.random() - 0.5)
      };
    }
  }

  function generateDivisionQuestion(gameType) {
    const b = getRandomInt(2, 9); // Divisor
    const c = getRandomInt(2, 9); // Quotient
    const a = b * c;              // Dividend (12)

    if (gameType === 1 || gameType === 'boss') {
      // 12 ÷ 3 = ? (Correct Answer: c = 4)
      const options = new Set([c]);
      while (options.size < 4) {
        let fake = getRandomInt(2, 9);
        if (fake !== c) options.add(fake);
      }
      return {
        type: 1,
        mode: 'division',
        a, b, c,
        prompt: `${a} ÷ ${b} = ?`,
        correctAnswer: c,
        options: Array.from(options).sort(() => Math.random() - 0.5)
      };
    } else if (gameType === 2) {
      // 12 ÷ ? = 4 (Correct Answer: b = 3)
      const options = new Set([b]);
      while (options.size < 4) {
        let fake = getRandomInt(2, 9);
        if (fake !== b) options.add(fake);
      }
      return {
        type: 2,
        mode: 'division',
        a, b, c,
        prompt: `${a} ÷ ? = ${c}`,
        correctAnswer: b,
        options: Array.from(options).sort(() => Math.random() - 0.5)
      };
    } else if (gameType === 3) {
      // ? ÷ 3 = 4 (Correct Answer: a = 12)
      const options = new Set([a]);
      while (options.size < 4) {
        let fakeFactorB = getRandomInt(2, 9);
        let fakeFactorC = getRandomInt(2, 9);
        let fakeA = fakeFactorB * fakeFactorC;
        if (fakeA !== a) options.add(fakeA);
      }
      return {
        type: 3,
        mode: 'division',
        a, b, c,
        prompt: `? ÷ ${b} = ${c}`,
        correctAnswer: a,
        options: Array.from(options).sort(() => Math.random() - 0.5)
      };
    }
  }

  function generateQuestion(gameType) {
    if (currentMode === 'division') {
      return generateDivisionQuestion(gameType);
    } else {
      return generateGugudanQuestion(gameType);
    }
  }

  // -------------------------------------------------------------------------
  // 6. Mini-Games Engine
  // -------------------------------------------------------------------------

  function getGameConfig(gameType, mode = currentMode) {
    if (mode === 'division') {
      return {
        1: { title: '나눗셈 스피드 레이스', icon: '🎯' },
        2: { title: '나눗셈 나누는 수 탐정', icon: '🔍' },
        3: { title: '나눗셈 나누어지는 수 탐정', icon: '🧩' }
      }[gameType];
    } else {
      return {
        1: { title: '구구단 스피드 레이스', icon: '🎯' },
        2: { title: '구구단 숫자 탐정', icon: '🔍' },
        3: { title: '구구단 짝 맞추기', icon: '🧩' }
      }[gameType];
    }
  }

  function startMiniGame(gameType) {
    gameState.activeGame = gameType;
    gameState.timeRemaining = 25;
    gameState.solvedCount = 0;
    gameState.currentCombo = 0;
    gameState.maxCombo = 0;
    gameState.earnedGold = 0;
    gameState.tileSelection = [];

    const cfg = getGameConfig(gameType, currentMode);
    document.getElementById('playGameTitle').textContent = cfg.title;
    document.getElementById('playGameIcon').textContent = cfg.icon;

    updateGameStatsBar();
    showView('gamePlayView');
    nextMiniGameQuestion();

    if (gameState.timerId) clearInterval(gameState.timerId);
    gameState.timerId = setInterval(() => {
      gameState.timeRemaining -= 0.1;
      if (gameState.timeRemaining <= 0) {
        gameState.timeRemaining = 0;
        clearInterval(gameState.timerId);
        gameState.timerId = null;
        updateGameStatsBar();
        finishMiniGame();
      } else {
        updateGameStatsBar();
      }
    }, 100);
  }

  function updateGameStatsBar() {
    const secStr = Math.max(0, gameState.timeRemaining).toFixed(1);
    document.getElementById('gameTimerText').textContent = `${secStr}초`;
    document.getElementById('gameScoreText').textContent = `${gameState.solvedCount}개`;
    document.getElementById('gameGoldText').textContent = `+${gameState.earnedGold} Gold`;

    const pct = Math.max(0, (gameState.timeRemaining / 25) * 100);
    const progBar = document.getElementById('gameTimerProgress');
    if (progBar) progBar.style.width = `${pct}%`;

    const comboBox = document.getElementById('comboBox');
    if (gameState.currentCombo >= 2) {
      document.getElementById('comboVal').textContent = gameState.currentCombo;
      comboBox.classList.remove('hidden');
    } else {
      comboBox.classList.add('hidden');
    }
  }

  function nextMiniGameQuestion() {
    gameState.tileSelection = [];
    const q = generateQuestion(gameState.activeGame);
    gameState.currentQuestion = q;

    document.getElementById('questionPrompt').textContent = q.prompt;

    const subtextEl = document.getElementById('questionSubtext');
    if (q.type === 3 && currentMode === 'gugudan') {
      subtextEl.textContent = '두 숫자를 차례대로 선택하세요 (재클릭 시 선택 해제)';
    } else {
      subtextEl.textContent = '올바른 정답을 선택하세요!';
    }

    const grid = document.getElementById('answerOptionsGrid');
    grid.innerHTML = '';

    if (q.type === 1 || q.type === 2 || (q.type === 3 && currentMode === 'division')) {
      grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => handleOptionClick(opt, q.correctAnswer));
        grid.appendChild(btn);
      });
    } else if (q.type === 3 && currentMode === 'gugudan') {
      grid.style.gridTemplateColumns = 'repeat(3, 1fr)';

      q.tiles.forEach((tile, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-btn tile-btn';
        btn.textContent = tile.val;
        btn.dataset.index = index;
        btn.addEventListener('click', () => handleTileClick(btn, tile, q));
        grid.appendChild(btn);
      });
    }
  }

  function handleOptionClick(selectedVal, correctVal) {
    if (selectedVal === correctVal) {
      sound.playCorrect();
      gameState.solvedCount++;
      gameState.earnedGold += REWARD_GOLD_PER_PROBLEM;
      gameState.currentCombo++;
      sound.playCombo(gameState.currentCombo);
      if (gameState.currentCombo > gameState.maxCombo) {
        gameState.maxCombo = gameState.currentCombo;
      }

      if (currentUser && gameState.currentQuestion) {
        const mData = getUserModeData(currentUser, currentMode);
        checkAndUpdateUserWeeklyReset(currentUser, currentMode);
        mData.weeklySolved = (mData.weeklySolved || 0) + 1;
        mData.totalSolved = (mData.totalSolved || 0) + 1;

        mData.currentGold = (mData.currentGold || 0) + REWARD_GOLD_PER_PROBLEM;
        mData.totalGold = (mData.totalGold || 0) + REWARD_GOLD_PER_PROBLEM;
        saveUserDataInList(currentUser);
        saveSessionUser(currentUser);
      }

      updateGameStatsBar();
      nextMiniGameQuestion();
    } else {
      sound.playWrong();
      gameState.currentCombo = 0;

      if (currentUser && gameState.currentQuestion) {
        const mData = getUserModeData(currentUser, currentMode);
        const table = gameState.currentQuestion.b || gameState.currentQuestion.a;
        if (!mData.weakTableErrors) mData.weakTableErrors = {};
        mData.weakTableErrors[table] = (mData.weakTableErrors[table] || 0) + 1;
        saveUserDataInList(currentUser);
      }

      updateGameStatsBar();
    }
  }

  function handleTileClick(btn, tile, question) {
    const existingIdx = gameState.tileSelection.findIndex(item => item.btn === btn);
    if (existingIdx >= 0) {
      btn.classList.remove('selected');
      gameState.tileSelection.splice(existingIdx, 1);
      sound.playTone(320, 'sine', 0.08, 0.08);
      return;
    }

    btn.classList.add('selected');
    gameState.tileSelection.push({ val: tile.val, btn: btn });

    if (gameState.tileSelection.length === 2) {
      const val1 = gameState.tileSelection[0].val;
      const val2 = gameState.tileSelection[1].val;

      if (val1 * val2 === question.product) {
        sound.playCorrect();
        gameState.solvedCount++;
        gameState.earnedGold += REWARD_GOLD_PER_PROBLEM;
        gameState.currentCombo++;
        sound.playCombo(gameState.currentCombo);
        if (gameState.currentCombo > gameState.maxCombo) {
          gameState.maxCombo = gameState.currentCombo;
        }

        if (currentUser) {
          const mData = getUserModeData(currentUser, currentMode);
          checkAndUpdateUserWeeklyReset(currentUser, currentMode);
          mData.weeklySolved = (mData.weeklySolved || 0) + 1;
          mData.totalSolved = (mData.totalSolved || 0) + 1;

          mData.currentGold = (mData.currentGold || 0) + REWARD_GOLD_PER_PROBLEM;
          mData.totalGold = (mData.totalGold || 0) + REWARD_GOLD_PER_PROBLEM;
          saveUserDataInList(currentUser);
          saveSessionUser(currentUser);
        }

        updateGameStatsBar();
        nextMiniGameQuestion();
      } else {
        sound.playWrong();
        gameState.currentCombo = 0;
        setTimeout(() => {
          gameState.tileSelection.forEach(item => item.btn.classList.remove('selected'));
          gameState.tileSelection = [];
        }, 300);

        if (currentUser && question) {
          const mData = getUserModeData(currentUser, currentMode);
          const table = question.a;
          if (!mData.weakTableErrors) mData.weakTableErrors = {};
          mData.weakTableErrors[table] = (mData.weakTableErrors[table] || 0) + 1;
          saveUserDataInList(currentUser);
        }

        updateGameStatsBar();
      }
    }
  }

  function finishMiniGame() {
    if (currentUser) {
      const mData = getUserModeData(currentUser, currentMode);

      const todayStr = getTodayKSTDateString();
      if (mData.lastActiveDate !== todayStr) {
        mData.lastActiveDate = todayStr;
        mData.todayClears = [0, 0, 0];
      }
      if (!mData.todayClears) mData.todayClears = [0, 0, 0];
      if (!mData.gameClears) mData.gameClears = [0, 0, 0];

      const gameIdx = gameState.activeGame - 1;
      mData.todayClears[gameIdx] = (mData.todayClears[gameIdx] || 0) + 1;
      mData.gameClears[gameIdx] = (mData.gameClears[gameIdx] || 0) + 1;

      saveUserDataInList(currentUser);
      saveSessionUser(currentUser);
    }

    updateHeaderUI();

    document.getElementById('resSolvedCount').textContent = `${gameState.solvedCount}개`;
    document.getElementById('resMaxCombo').textContent = `${gameState.maxCombo} Combo`;
    document.getElementById('resEarnedGold').textContent = `+${gameState.earnedGold} Gold`;

    openModal('resultModal');
  }

  // -------------------------------------------------------------------------
  // 7. Boss Dungeon Battle Engine
  // -------------------------------------------------------------------------

  let isBossEntering = false;

  function requestBossEntry() {
    if (!currentUser) return;
    if (isBossEntering) return;

    const isTeacher = (currentUser.role === 'teacher' || currentUser.role === 'superadmin');
    const mData = getUserModeData(currentUser, currentMode);
    const gold = mData.currentGold || 0;
    const body = document.getElementById('bossConfirmBody');
    const actions = document.getElementById('bossConfirmActions');
    const bossName = (currentMode === 'division') ? '나눗셈 마왕' : '구구단 마왕';

    if (!isTeacher && gold < BOSS_ENTRY_GOLD) {
      const diff = BOSS_ENTRY_GOLD - gold;
      body.innerHTML = `
        <div style="color: #EF4444; font-size: 1.15rem; font-weight: 800; margin-bottom: 12px;">
          ⛔ 골드가 부족합니다!
        </div>
        <p style="line-height: 1.6; color: var(--text-main); font-size: 1.05rem;">
          ${bossName} 던전에 입장하려면 <strong>${BOSS_ENTRY_GOLD} Gold</strong>가 필요합니다.<br>
          (현재 보유: <strong>${gold} Gold</strong> / <strong>${diff} Gold</strong> 부족)
        </p>
        <p style="margin-top: 12px; font-size: 0.95rem; color: var(--text-muted);">
          🏋️‍♂️ 훈련하기 미니게임을 플레이하여 골드를 모아보세요!
        </p>
      `;
      actions.innerHTML = `
        <button type="button" class="btn btn-primary btn-block" id="bossOkCloseBtn">확인</button>
      `;
      openModal('bossConfirmModal');

      const okBtn = document.getElementById('bossOkCloseBtn');
      if (okBtn) {
        okBtn.onclick = function() {
          closeModal('bossConfirmModal');
        };
      }
    } else {
      const conditionText = isTeacher ? '교사 무료 입장 (골드 소모 없음)' : `${BOSS_ENTRY_GOLD} 골드 소모`;
      const subNoticeText = isTeacher ? '(교사 계정은 골드가 차감되지 않습니다)' : `(확인 클릭 시 즉시 ${BOSS_ENTRY_GOLD} 골드가 소모되며 환불되지 않습니다)`;

      body.innerHTML = `
        <div style="background-color: var(--bg-elevated); padding: 16px; border-radius: var(--radius-md); text-align: left; margin-bottom: 16px; border: 1px solid var(--border-color);">
          <h3 style="color: var(--accent-purple); margin-bottom: 6px;">👹 ${bossName} 던전</h3>
          <p style="font-size: 0.95rem; line-height: 1.5; color: var(--text-main); margin-bottom: 10px;">
            <strong>설명:</strong> 10개의 ${currentMode === 'division' ? '나눗셈' : '구구단'} 문제를 해결하여 마왕을 봉인하고, 최단 신기록을 달성하세요.
          </p>
          <div style="font-size: 0.95rem; color: #DC2626; font-weight: 800; margin-bottom: 6px;">
            ⚔️ 도전조건: ${conditionText}
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            ✨ 10문제를 모두 풀면 마왕 봉인 완료! 봉인에 걸린 시간이 영웅의 전당 왕좌에 등록됩니다.
          </div>
        </div>
        <p style="font-size: 1.1rem; font-weight: 800; color: var(--accent-purple);">
          던전에 입장하시겠습니까?<br>
          <small style="font-weight: 400; color: #DC2626;">${subNoticeText}</small>
        </p>
      `;

      actions.innerHTML = `
        <button type="button" class="btn btn-outline" id="bossCancelBtn">취소</button>
        <button type="button" class="btn btn-boss-start" id="bossRealEnterBtn">네, 던전에 입장합니다</button>
      `;
      openModal('bossConfirmModal');

      const cancelBtn = document.getElementById('bossCancelBtn');
      if (cancelBtn) {
        cancelBtn.onclick = function() {
          closeModal('bossConfirmModal');
        };
      }

      const realEnterBtn = document.getElementById('bossRealEnterBtn');
      if (realEnterBtn) {
        realEnterBtn.onclick = async function () {
          if (isBossEntering) return;
          isBossEntering = true;
          realEnterBtn.disabled = true;

          closeModal('bossConfirmModal');

          if (!isTeacher) {
            mData.currentGold = Math.max(0, (mData.currentGold || 0) - BOSS_ENTRY_GOLD);
            mData.bossCount = (mData.bossCount || 0) + 1;
            await saveUserDataInList(currentUser);
            saveSessionUser(currentUser);
            updateHeaderUI();
          }

          startBossBattle();

          setTimeout(() => {
            isBossEntering = false;
          }, 1000);
        };
      }
    }
  }

  function startBossBattle() {
    gameState.activeGame = 'boss';
    gameState.bossHp = 10;
    gameState.bossProblemIndex = 0;
    gameState.currentCombo = 0;
    gameState.bossStartTime = Date.now();

    gameState.bossProblems = [];
    for (let i = 0; i < 10; i++) {
      if (currentMode === 'division') {
        gameState.bossProblems.push(generateDivisionQuestion('boss'));
      } else {
        gameState.bossProblems.push(generateGugudanQuestion('boss'));
      }
    }

    showView('bossPlayView');
    updateBossUI();

    if (gameState.timerId) clearInterval(gameState.timerId);
    gameState.timerId = setInterval(() => {
      const elapsed = ((Date.now() - gameState.bossStartTime) / 1000).toFixed(2);
      document.getElementById('bossTimerText').textContent = `${elapsed}초`;
    }, 50);
  }

  function updateBossUI() {
    const q = gameState.bossProblems[gameState.bossProblemIndex];
    const bossNameTag = (currentMode === 'division') ? '👾 나눗셈 마왕' : '👹 구구단 마왕';
    const bossAvatarEmoji = (currentMode === 'division') ? '👾' : '👹';

    const tagEl = document.querySelector('.boss-name-tag');
    if (tagEl) tagEl.innerHTML = `${bossNameTag} (남은 문제: <span id="bossRemainCount">${10 - gameState.bossProblemIndex}</span>/10)`;
    
    const avatarEl = document.getElementById('bossAvatar');
    if (avatarEl) avatarEl.textContent = bossAvatarEmoji;

    document.getElementById('bossQNum').textContent = `문제 ${gameState.bossProblemIndex + 1} / 10`;

    const hpPercent = ((10 - gameState.bossProblemIndex) / 10) * 100;
    document.getElementById('bossHpBar').style.width = `${hpPercent}%`;
    document.getElementById('bossHpText').textContent = `${10 - gameState.bossProblemIndex} / 10 HP`;

    document.getElementById('bossQPrompt').textContent = q.prompt;

    const grid = document.getElementById('bossAnswersGrid');
    grid.innerHTML = '';

    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'boss-option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleBossOptionClick(opt, q.correctAnswer));
      grid.appendChild(btn);
    });

    const comboBox = document.getElementById('bossComboBox');
    if (gameState.currentCombo >= 2) {
      document.getElementById('bossComboVal').textContent = gameState.currentCombo;
      comboBox.classList.remove('hidden');
    } else {
      comboBox.classList.add('hidden');
    }
  }

  function handleBossOptionClick(selectedVal, correctVal) {
    if (selectedVal === correctVal) {
      sound.playHit();
      sound.playCorrect();

      gameState.currentCombo++;
      sound.playCombo(gameState.currentCombo);

      triggerFloatingDamage(`💥 -1 HP`);

      if (currentUser) {
        const mData = getUserModeData(currentUser, currentMode);
        checkAndUpdateUserWeeklyReset(currentUser, currentMode);
        mData.weeklySolved = (mData.weeklySolved || 0) + 1;
        mData.totalSolved = (mData.totalSolved || 0) + 1;
      }

      gameState.bossProblemIndex++;

      if (gameState.bossProblemIndex >= 10) {
        clearInterval(gameState.timerId);
        gameState.timerId = null;
        finishBossBattle();
      } else {
        updateBossUI();
      }
    } else {
      sound.playWrong();
      gameState.currentCombo = 0;

      const comboBox = document.getElementById('bossComboBox');
      if (comboBox) comboBox.classList.add('hidden');

      if (currentUser && gameState.bossProblems[gameState.bossProblemIndex]) {
        const mData = getUserModeData(currentUser, currentMode);
        const table = gameState.bossProblems[gameState.bossProblemIndex].b || gameState.bossProblems[gameState.bossProblemIndex].a;
        if (!mData.weakTableErrors) mData.weakTableErrors = {};
        mData.weakTableErrors[table] = (mData.weakTableErrors[table] || 0) + 1;
      }
    }
  }

  function triggerFloatingDamage(text) {
    const layer = document.getElementById('damageFloatLayer');
    if (!layer) return;

    const dmgEl = document.createElement('div');
    dmgEl.className = 'floating-damage';
    dmgEl.textContent = text;
    dmgEl.style.left = `${40 + Math.random() * 20}%`;
    layer.appendChild(dmgEl);

    setTimeout(() => {
      if (dmgEl.parentNode) dmgEl.parentNode.removeChild(dmgEl);
    }, 800);
  }

  function finishBossBattle() {
    const totalTime = ((Date.now() - gameState.bossStartTime) / 1000).toFixed(2);
    sound.playVictory();

    if (currentUser) {
      const mData = getUserModeData(currentUser, currentMode);
      if (!mData.bossFastestTime || parseFloat(totalTime) < parseFloat(mData.bossFastestTime)) {
        mData.bossFastestTime = parseFloat(totalTime);
      }
      updateUserTitleIndex(currentUser, currentMode);
      saveUserDataInList(currentUser);
      saveSessionUser(currentUser);
    }

    updateHeaderUI();

    const bossNameStr = (currentMode === 'division') ? '나눗셈 마왕' : '구구단 마왕';
    alert(`🎉 ${bossNameStr} 봉인 완료!\n⏱️ 클리어 시간: ${totalTime}초\n보스를 물리치고 영웅의 전당에 이름을 올렸습니다!`);
    showView('lobbyView');
  }

  // -------------------------------------------------------------------------
  // 8. 영웅의 전당 (Hall of Heroes)
  // -------------------------------------------------------------------------

  function renderHallOfHeroes(activeTab = 'gold') {
    const tabs = document.querySelectorAll('.hall-tab-btn');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));

    const singleWrapper = document.getElementById('hallSingleWrapper');
    const tripleWrapper = document.getElementById('hallTripleWrapper');
    const noticeBox = document.getElementById('diligenceNoticeBox');

    if (activeTab === 'diligence') {
      if (noticeBox) noticeBox.classList.remove('hidden');
    } else {
      if (noticeBox) noticeBox.classList.add('hidden');
    }

    if (activeTab === 'minigames') {
      singleWrapper.classList.add('hidden');
      tripleWrapper.classList.remove('hidden');
      renderTripleMiniGameRanks();
    } else {
      tripleWrapper.classList.add('hidden');
      singleWrapper.classList.remove('hidden');
      renderSingleRankTable(activeTab);
    }
  }

  function getCombinedUserList() {
    let list = Object.values(allPlayersMap).filter(u => u && u.role !== 'teacher' && u.role !== 'superadmin');
    
    if (currentUser && currentUser.role !== 'teacher' && currentUser.role !== 'superadmin') {
      if (!list.some(u => u.id === currentUser.id)) {
        list.push(currentUser);
      }
    }

    list.forEach(u => {
      getUserModeData(u, currentMode);
      checkAndUpdateUserWeeklyReset(u, currentMode);
    });
    return list;
  }

  function calculateJointRanks(sortedList, getScoreVal) {
    const result = [];
    if (sortedList.length === 0) return result;

    let currentRank = 1;
    let prevScore = getScoreVal(sortedList[0]);
    let sameScoreCount = 0;

    sortedList.forEach((user, index) => {
      const score = getScoreVal(user);
      if (score === prevScore) {
        sameScoreCount++;
      } else {
        currentRank = index + 1;
        prevScore = score;
        sameScoreCount = 1;
      }

      const tiedWithOthers = sortedList.filter(u => getScoreVal(u) === score).length > 1;

      result.push({
        user,
        rankNum: currentRank,
        isJoint: tiedWithOthers,
        rankDisplay: tiedWithOthers ? `공동 ${currentRank}위` : `${currentRank}위`
      });
    });

    return result;
  }

  function renderSingleRankTable(category) {
    const tbody = document.getElementById('rankTableBody');
    const scoreHeader = document.getElementById('rankScoreHeader');
    tbody.innerHTML = '';

    let list = getCombinedUserList();
    let getScoreVal = u => 0;

    if (category === 'gold') {
      scoreHeader.textContent = '누적 골드';
      list = list.filter(u => (getUserModeData(u, currentMode).totalGold || 0) > 0);
      list.sort((a, b) => (getUserModeData(b, currentMode).totalGold || 0) - (getUserModeData(a, currentMode).totalGold || 0));
      getScoreVal = u => (getUserModeData(u, currentMode).totalGold || 0);
    } else if (category === 'boss') {
      scoreHeader.textContent = '최단 타임';
      list = list.filter(u => getUserModeData(u, currentMode).bossFastestTime !== null && getUserModeData(u, currentMode).bossFastestTime !== undefined);
      list.sort((a, b) => parseFloat(getUserModeData(a, currentMode).bossFastestTime) - parseFloat(getUserModeData(b, currentMode).bossFastestTime));
      getScoreVal = u => parseFloat(getUserModeData(u, currentMode).bossFastestTime || 9999);
    } else if (category === 'diligence') {
      scoreHeader.textContent = '주간 푼 문제';
      list = list.filter(u => (getUserModeData(u, currentMode).weeklySolved || 0) > 0);
      list.sort((a, b) => (getUserModeData(b, currentMode).weeklySolved || 0) - (getUserModeData(a, currentMode).weeklySolved || 0));
      getScoreVal = u => (getUserModeData(u, currentMode).weeklySolved || 0);
    }

    const rankedList = calculateJointRanks(list, getScoreVal);
    const top10Ranked = rankedList.filter(item => item.rankNum <= 10);

    if (top10Ranked.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">
            ✨ 아직 영웅의 전당에 등록된 도전자가 없습니다. 훈련을 마치고 첫 번째 영웅이 되어보세요!
          </td>
        </tr>
      `;
    } else {
      top10Ranked.forEach((item) => {
        const u = item.user;
        const uData = getUserModeData(u, currentMode);
        const tr = document.createElement('tr');
        const isMyRow = currentUser && (u.id === currentUser.id);
        if (isMyRow) {
          tr.className = 'my-row-highlight';
        }

        let rankStyle = '';
        if (item.rankNum === 1) rankStyle = 'rank-top1';
        else if (item.rankNum === 2) rankStyle = 'rank-top2';
        else if (item.rankNum === 3) rankStyle = 'rank-top3';

        let scoreStr = '';
        if (category === 'gold') scoreStr = `${uData.totalGold || 0} Gold`;
        else if (category === 'boss') scoreStr = `${uData.bossFastestTime}초`;
        else if (category === 'diligence') scoreStr = `${uData.weeklySolved || 0}문제`;

        tr.innerHTML = `
          <td class="${rankStyle}"><strong>${item.rankDisplay}</strong></td>
          <td>${getFullUserTitleString(u, currentMode)} ${isMyRow ? '📍 (나)' : ''}</td>
          <td class="col-role">${u.role === 'anon' ? '익명' : '학생'}</td>
          <td><strong>${scoreStr}</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Handle My Rank Banner for users outside Top 10
    const myRankBanner = document.getElementById('myRankBanner');
    if (currentUser && currentUser.role !== 'teacher' && currentUser.role !== 'superadmin') {
      const myItem = rankedList.find(item => item.user.id === currentUser.id);
      const curData = getUserModeData(currentUser, currentMode);

      if (myItem && myItem.rankNum > 10) {
        document.getElementById('myRankPos').textContent = myItem.rankDisplay;
        document.getElementById('myRankUser').textContent = getFullUserTitleString(currentUser, currentMode);

        let myScoreStr = '';
        if (category === 'gold') myScoreStr = `${curData.totalGold || 0} Gold`;
        else if (category === 'boss') myScoreStr = curData.bossFastestTime ? `${curData.bossFastestTime}초` : '기록 없음';
        else if (category === 'diligence') myScoreStr = `${curData.weeklySolved || 0}문제`;

        document.getElementById('myRankScore').textContent = myScoreStr;
        myRankBanner.classList.remove('hidden');
      } else {
        myRankBanner.classList.add('hidden');
      }
    } else {
      myRankBanner.classList.add('hidden');
    }
  }

  function renderTripleMiniGameRanks() {
    const list = getCombinedUserList();

    [1, 2, 3].forEach(gameId => {
      const tbody = document.getElementById(`miniRankBody${gameId}`);
      tbody.innerHTML = '';

      const gameIdx = gameId - 1;
      const activeList = [...list].filter(u => {
        const mData = getUserModeData(u, currentMode);
        return mData.gameClears && mData.gameClears[gameIdx] > 0;
      });
      
      activeList.sort((a, b) => {
        const aData = getUserModeData(a, currentMode);
        const bData = getUserModeData(b, currentMode);
        const aVal = (aData.gameClears && aData.gameClears[gameIdx]) || 0;
        const bVal = (bData.gameClears && bData.gameClears[gameIdx]) || 0;
        if (bVal !== aVal) return bVal - aVal;
        return (bData.totalGold || 0) - (aData.totalGold || 0);
      });

      const getClearVal = u => {
        const mData = getUserModeData(u, currentMode);
        return (mData.gameClears && mData.gameClears[gameIdx]) || 0;
      };

      const rankedList = calculateJointRanks(activeList, getClearVal);
      const top5Ranked = rankedList.filter(item => item.rankNum <= 5);

      if (top5Ranked.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--text-muted);">기록 없음</td></tr>`;
      } else {
        top5Ranked.forEach((item) => {
          const u = item.user;
          const count = getClearVal(u);
          const tr = document.createElement('tr');
          const isMyRow = currentUser && (u.id === currentUser.id);
          if (isMyRow) tr.className = 'my-row-highlight';

          tr.innerHTML = `
            <td><strong>${item.rankDisplay}</strong></td>
            <td style="font-size: 0.85rem;">${getFullUserTitleString(u, currentMode)} ${isMyRow ? '📍(나)' : ''}</td>
            <td><strong>${count}회</strong></td>
          `;
          tbody.appendChild(tr);
        });
      }

      if (currentUser && currentUser.role !== 'teacher' && currentUser.role !== 'superadmin') {
        const myCount = getClearVal(currentUser);
        const myRankValEl = document.getElementById(`myMiniRankVal${gameId}`);
        if (myCount > 0) {
          const myItem = rankedList.find(item => item.user.id === currentUser.id);
          const rankStr = myItem ? (myItem.rankNum <= 5 ? myItem.rankDisplay : '6위 이하') : '6위 이하';
          myRankValEl.textContent = `${rankStr} (${myCount}회)`;
        } else {
          myRankValEl.textContent = `기록 없음 (0회)`;
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // 9. 6-Digit Class Code Teacher Access Logic & Admin Page
  // -------------------------------------------------------------------------

  async function checkClassCodeExists(cleanCode) {
    if (registeredClasses[cleanCode]) return true;
    if (db) {
      try {
        const docSnap = await db.collection('classes').doc(cleanCode).get();
        if (docSnap.exists) {
          registeredClasses[cleanCode] = docSnap.data();
          return true;
        }
      } catch (e) {
        console.warn("Firestore class check error:", e);
      }
    }
    return false;
  }

  async function loginTeacherByClassCode(inviteCode) {
    const cleanCode = inviteCode.replace(/[^0-9]/g, '').trim();

    if (!cleanCode || cleanCode.length !== 6) {
      alert('올바른 6자리 숫자 학급 코드를 입력해 주세요.');
      return false;
    }

    isLoggingInProgress = true;
    await ensureFirebaseAuth();

    let teacherRecord = registeredClasses[cleanCode];

    if (!teacherRecord && db) {
      try {
        const docSnap = await db.collection('classes').doc(cleanCode).get();
        if (docSnap.exists) {
          teacherRecord = docSnap.data();
        }
      } catch (err) {
        console.warn("Firestore class fetch error:", err);
      }
    }

    if (!teacherRecord) {
      isLoggingInProgress = false;
      alert(`⛔ [${cleanCode}]는 등록되지 않은 학급 코드입니다.\n\n아래 [🏫 신규 학급 개설하기] 버튼을 눌러 먼저 학급을 개설해 주세요.`);
      return false;
    }

    registeredClasses[cleanCode] = teacherRecord;

    const teacherUser = {
      id: `teacher_${cleanCode}`,
      name: teacherRecord.teacherName || `선생님(${cleanCode})`,
      role: 'teacher',
      inviteCode: cleanCode,
      className: teacherRecord.className || '',
      titleIndex: 5,
      totalGold: 999,
      currentGold: 999
    };

    saveSessionUser(teacherUser);
    updateTeacherDashboardUI();

    closeModal('loginModal');
    isLoggingInProgress = false;
    updateHeaderUI();

    showView('adminView');
    return true;
  }

  function updateTeacherDashboardUI() {
    if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'superadmin')) return;

    document.getElementById('teacherAccountName').textContent = currentUser.name;

    const displayClassStr = currentUser.className ? currentUser.className : '학반 정보 미설정 (학반 정보 변경을 클릭하세요)';
    document.getElementById('teacherClassName').textContent = displayClassStr;
    document.getElementById('teacherInviteCode').textContent = currentUser.inviteCode;
  }

  async function removeStudentFromClass(studentId, studentName) {
    if (!confirm(`[${studentName}] 학생을 내 학반에서 제거하시겠습니까?\n\n(학생의 게임 학습 이력은 유지되며, 학반 연동만 해제됩니다.)`)) {
      return;
    }

    const std = sampleClassStudents.find(s => s.id === studentId);
    if (std) {
      std.inviteCode = '';
      std.className = '미설정';
      await syncToFirestore('students', std.id, std);
    }

    if (allPlayersMap[studentId]) {
      allPlayersMap[studentId].inviteCode = '';
      allPlayersMap[studentId].className = '미설정';
      await syncToFirestore('students', studentId, allPlayersMap[studentId]);
    }

    sampleClassStudents = sampleClassStudents.filter(s => s.id !== studentId);

    saveStorageData();
    renderTeacherAdminPage();
    alert(`✅ [${studentName}] 학생이 학반에서 제거되었습니다.`);
  }

  function renderTeacherAdminPage() {
    if (!currentUser) return;

    const roleText = document.getElementById('adminRoleText');
    const superPanel = document.getElementById('superAdminPanel');

    if (currentUser.role === 'superadmin') {
      roleText.textContent = '최종 관리자 (Super Admin)';
      superPanel.classList.remove('hidden');
      renderSuperAdminTable();
    } else {
      roleText.textContent = '교사 (승인됨)';
      superPanel.classList.add('hidden');
    }

    updateTeacherDashboardUI();

    // Update Table Headers dynamically based on active mode
    const thG1 = document.getElementById('thGame1');
    const thG2 = document.getElementById('thGame2');
    const thG3 = document.getElementById('thGame3');

    if (currentMode === 'division') {
      if (thG1) thG1.innerHTML = '🎯 스피드<br><small>오늘 (전체)</small>';
      if (thG2) thG2.innerHTML = '🔍 나누는수<br><small>오늘 (전체)</small>';
      if (thG3) thG3.innerHTML = '🧩 나누어지는수<br><small>오늘 (전체)</small>';
    } else {
      if (thG1) thG1.innerHTML = '🎯 스피드<br><small>오늘 (전체)</small>';
      if (thG2) thG2.innerHTML = '🔍 탐정<br><small>오늘 (전체)</small>';
      if (thG3) thG3.innerHTML = '🧩 짝맞추기<br><small>오늘 (전체)</small>';
    }

    let matchingStudents = sampleClassStudents;
    if (currentUser.role === 'teacher') {
      matchingStudents = sampleClassStudents.filter(
        std => std.inviteCode === currentUser.inviteCode
      );
    }

    const sortedStudents = [...matchingStudents].sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const tbody = document.getElementById('studentLogsTableBody');
    tbody.innerHTML = '';

    if (sortedStudents.length === 0) {
      const currentClassNameDisplay = currentUser.className || '미설정';
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">
            아직 내 학반(${currentClassNameDisplay}, 초대코드: ${currentUser.inviteCode})에 등록된 학생이 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    const todayStr = getTodayKSTDateString();

    sortedStudents.forEach(std => {
      const stdData = getUserModeData(std, currentMode);
      const todayClears = (stdData.lastActiveDate === todayStr && stdData.todayClears) ? stdData.todayClears : [0, 0, 0];
      const totalClears = stdData.gameClears || [0, 0, 0];

      const currentGoldVal = stdData.currentGold !== undefined ? stdData.currentGold : (stdData.totalGold || 0);
      const totalGoldVal = stdData.totalGold || 0;
      const goldDisplay = `🪙 ${currentGoldVal} (${totalGoldVal})`;

      const g1Str = `${todayClears[0] || 0} (${totalClears[0] || 0})`;
      const g2Str = `${todayClears[1] || 0} (${totalClears[1] || 0})`;
      const g3Str = `${todayClears[2] || 0} (${totalClears[2] || 0})`;

      const bossCount = stdData.bossCount || 0;
      const bossTimeStr = stdData.bossFastestTime ? `${stdData.bossFastestTime}초` : '-';
      const bossDisplay = `${bossCount}회 (${bossTimeStr})`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${std.name}</strong></td>
        <td><strong>${goldDisplay}</strong></td>
        <td><strong>${g1Str}</strong></td>
        <td><strong>${g2Str}</strong></td>
        <td><strong>${g3Str}</strong></td>
        <td>⚔️ ${bossDisplay}</td>
        <td>
          <button type="button" class="btn btn-outline btn-sm view-chart-btn" data-id="${std.id}">
            분석
          </button>
        </td>
        <td>
          <button type="button" class="btn btn-danger-soft btn-sm remove-student-btn" data-id="${std.id}" data-name="${std.name}">
            제거
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.view-chart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stdId = e.currentTarget.dataset.id;
        const student = sampleClassStudents.find(s => s.id === stdId);
        if (student) showWeakTableChartModal(student);
      });
    });

    document.querySelectorAll('.remove-student-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const stdId = e.currentTarget.dataset.id;
        const stdName = e.currentTarget.dataset.name;
        removeStudentFromClass(stdId, stdName);
      });
    });
  }

  function renderSuperAdminTable() {
    const tbody = document.getElementById('teacherApproveTableBody');
    tbody.innerHTML = `
      <tr>
        <td>박선생</td>
        <td>4학년 1반</td>
        <td>
          <button type="button" class="btn btn-primary btn-sm">승인</button>
          <button type="button" class="btn btn-danger-soft btn-sm">거절</button>
        </td>
      </tr>
    `;

    document.getElementById('classTagsList').innerHTML = `
      <span class="req-item">🏫 3-6</span>
      <span class="req-item">🏫 4학년 1반</span>
      <span class="req-item">🏫 꿈나무 5-3</span>
    `;
  }

  function showWeakTableChartModal(student) {
    document.getElementById('chartStudentName').textContent = `${student.name} (${currentMode === 'division' ? '나눗셈' : '구구단'})`;
    const container = document.getElementById('chartBarsContainer');
    container.innerHTML = '';

    const stdData = getUserModeData(student, currentMode);
    const errors = stdData.weakTableErrors || {};
    let maxError = 1;
    for (let t = 2; t <= 9; t++) {
      if ((errors[t] || 0) > maxError) maxError = errors[t];
    }

    let highestWeak = [];
    for (let t = 2; t <= 9; t++) {
      const count = errors[t] || 0;
      const pct = Math.round((count / maxError) * 100);

      const barItem = document.createElement('div');
      barItem.className = 'chart-bar-item';
      const labelText = (currentMode === 'division') ? `÷${t}` : `${t}단`;

      barItem.innerHTML = `
        <span class="bar-val">${count}회</span>
        <div class="bar-fill" style="height: ${Math.max(pct, 8)}%;"></div>
        <span class="bar-label">${labelText}</span>
      `;
      container.appendChild(barItem);

      if (count > 4) highestWeak.push(labelText);
    }

    const summaryBox = document.getElementById('chartSummaryBox');
    if (highestWeak.length > 0) {
      summaryBox.innerHTML = `
        💡 <strong>분석 결과:</strong> ${student.name} 학생은 <strong style="color: #DC2626;">${highestWeak.join(', ')}</strong>에서 오답률이 상대적으로 높습니다.<br>
        해당 구간의 집중적인 반복 훈련을 권장합니다.
      `;
    } else {
      summaryBox.innerHTML = `
        ✨ <strong>분석 결과:</strong> ${student.name} 학생은 ${currentMode === 'division' ? '나눗셈 2~9' : '2단~9단'} 전반적으로 높은 정답률을 유지하고 있습니다!
      `;
    }

    openModal('chartModal');
  }

  // -------------------------------------------------------------------------
  // 10. Title List Popup Render
  // -------------------------------------------------------------------------

  function showTitleModal() {
    const container = document.getElementById('titleListContainer');
    container.innerHTML = '';

    const gData = getUserModeData(currentUser, 'gugudan');
    const dData = getUserModeData(currentUser, 'division');

    const gBossCount = gData ? (gData.bossCount || 0) : 0;
    const dBossCount = dData ? (dData.bossCount || 0) : 0;

    // 1. My Boss Count Stats Box
    const countBox = document.createElement('div');
    countBox.className = 'my-boss-count-box';
    countBox.innerHTML = `
      <div class="boss-count-box-title">📊 나의 누적 보스전 도전 현황</div>
      <div class="boss-count-box-grid">
        <div class="boss-count-card ${currentMode === 'gugudan' ? 'active' : ''}">
          <div class="count-card-label">⚔️ 구구단 보스전</div>
          <div class="count-card-val">${gBossCount}회 도전</div>
        </div>
        <div class="boss-count-card ${currentMode === 'division' ? 'active' : ''}">
          <div class="count-card-label">➗ 나눗셈 보스전</div>
          <div class="count-card-val">${dBossCount}회 도전</div>
        </div>
      </div>
    `;
    container.appendChild(countBox);

    // 2. Title List Section Subhead
    const titleHeader = document.createElement('div');
    titleHeader.className = 'title-list-subhead';
    titleHeader.innerHTML = `🏆 ${currentMode === 'gugudan' ? '구구단' : '나눗셈'} 칭호 목록 & 획득 조건`;
    container.appendChild(titleHeader);

    const mData = getUserModeData(currentUser, currentMode);
    const currentLevel = mData ? (mData.titleIndex || 0) : 0;
    const titlesList = TITLES_MAP[currentMode] || TITLES_MAP.gugudan;

    titlesList.forEach(t => {
      const isUnlocked = t.level <= currentLevel;
      const card = document.createElement('div');
      card.className = `title-item-card ${isUnlocked ? 'unlocked' : ''}`;
      card.innerHTML = `
        <div class="title-item-left">
          <span>${t.emoji}</span>
          <span>${t.name}</span>
        </div>
        <div class="title-item-req">
          ${isUnlocked ? '✅ 획득 완료' : `🔒 조건: ${t.reqDesc}`}
        </div>
      `;
      container.appendChild(card);
    });

    openModal('titleModal');
  }

  // -------------------------------------------------------------------------
  // 11. Initializations & Persistent Session Startup
  // -------------------------------------------------------------------------

  function initApp() {
    loadStorageData();
    initFirestoreRealtimeListeners();
    ensureFirebaseAuth();

    window.addEventListener('storage', (e) => {
      if (e.key === 'gugudan_adventure_data_v34') {
        loadStorageData();
        refreshAllLiveViews();
      }
    });

    const activeSession = loadSessionUser();
    if (activeSession) {
      currentUser = activeSession;
      closeModal('loginModal');
      updateHeaderUI();
      showView('lobbyView');
    } else {
      openModal('loginModal');
      showView('lobbyView');
    }

    // Mode Switcher Tabs Event Listeners
    document.querySelectorAll('.mode-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        setMode(mode);
      });
    });

    const roleTabs = document.querySelectorAll('.role-tab-btn');
    roleTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        roleTabs.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');

        const role = btn.dataset.role;
        document.getElementById('studentLoginForm').classList.toggle('active', role === 'student');
        document.getElementById('teacherLoginForm').classList.toggle('active', role === 'teacher');
        document.getElementById('anonLoginForm').classList.toggle('active', role === 'anon');
      });
    });

    // Student Login Submit
    document.getElementById('studentLoginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('studentRealName').value.trim();
      const rawInvite = document.getElementById('studentInviteInput').value.trim();
      const invite = rawInvite.replace(/\s+/g, '');

      if (!name) {
        alert('학생 이름을 입력하세요.');
        return;
      }

      if (!invite) {
        alert('선생님께 안내받은 초대코드를 입력해주세요.');
        return;
      }

      await ensureFirebaseAuth();

      let classInfo = null;

      if (db) {
        try {
          const docSnap = await db.collection('classes').doc(invite).get();
          if (docSnap.exists) {
            classInfo = docSnap.data();
            registeredClasses[invite] = classInfo;
          }
        } catch (err) {
          console.warn("Firestore cloud class fetch err:", err);
        }
      }

      if (!classInfo) {
        classInfo = registeredClasses[invite];
      }

      if (!classInfo) {
        alert(`⛔ 생성되지 않았거나 없는 학급 코드입니다.\n선생님께서 먼저 학급 코드로 접속하여 학급을 개설하셨는지 확인 후 6자리 코드를 다시 입력해 주세요.`);
        return;
      }

      const displayClassName = classInfo.className ? classInfo.className : '미설정';
      const studentDocKey = `${invite}_${encodeURIComponent(name)}`;

      let studentUser = null;

      if (db) {
        try {
          const stdSnap = await db.collection('students').doc(studentDocKey).get();
          if (stdSnap.exists) {
            studentUser = stdSnap.data();
          }
        } catch (e) {
          console.warn("Firestore student doc fetch warning:", e);
        }
      }

      if (!studentUser) {
        studentUser = sampleClassStudents.find(
          s => s.name === name && s.inviteCode === invite
        );
      }

      if (!studentUser) {
        studentUser = {
          id: studentDocKey,
          name: name,
          role: 'student',
          className: displayClassName,
          inviteCode: invite
        };
      } else {
        studentUser.className = displayClassName;
      }

      getUserModeData(studentUser, currentMode);
      await saveUserDataInList(studentUser);
      saveSessionUser(studentUser);
      closeModal('loginModal');
      updateHeaderUI();
      showView('lobbyView');
    });

    // Dynamic Input Listener for Teacher Code Input
    const teacherCodeInput = document.getElementById('teacherCodeInput');
    const teacherCodeWarning = document.getElementById('teacherCodeWarning');

    if (teacherCodeInput) {
      teacherCodeInput.addEventListener('input', async (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');

        const val = e.target.value.trim();
        if (val.length === 6) {
          const exists = await checkClassCodeExists(val);
          if (exists) {
            teacherCodeWarning.textContent = 'ℹ️ 등록된 학급 코드입니다. 접속하기 버튼을 누르시면 바로 관리 페이지로 들어갑니다.';
            teacherCodeWarning.classList.remove('hidden');
          } else {
            teacherCodeWarning.textContent = '⛔ 아직 등록되지 않은 학급 코드입니다. 아래 [🏫 신규 학급 개설하기]를 누르세요.';
            teacherCodeWarning.classList.remove('hidden');
          }
        } else {
          teacherCodeWarning.classList.add('hidden');
        }
      });
    }

    // 6-Digit Class Code Teacher Login Handler
    const teacherLoginForm = document.getElementById('teacherLoginForm');
    if (teacherLoginForm) {
      teacherLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('teacherCodeInput').value.replace(/[^0-9]/g, '').trim();

        if (!code || code.length !== 6) {
          alert('6자리 숫자 학급 코드를 입력해 주세요.');
          return;
        }

        const exists = await checkClassCodeExists(code);
        if (!exists) {
          teacherCodeWarning.textContent = '⛔ 등록되지 않은 학급 코드입니다. 아래 [🏫 신규 학급 개설하기] 버튼을 누르세요.';
          teacherCodeWarning.classList.remove('hidden');
          alert(`⛔ [${code}]는 등록되지 않은 학급 코드입니다.\n\n아래 [🏫 신규 학급 개설하기] 버튼을 눌러 학급을 개설해 주세요.`);
          return;
        }

        await loginTeacherByClassCode(code);
      });
    }

    // Open New Class Creation Modal Handler
    const openCreateBtn = document.getElementById('openCreateClassModalBtn');
    if (openCreateBtn) {
      openCreateBtn.addEventListener('click', () => {
        const codeInMain = document.getElementById('teacherCodeInput').value.replace(/[^0-9]/g, '').trim();
        const createCodeInput = document.getElementById('createCodeInput');
        if (codeInMain.length === 6) {
          createCodeInput.value = codeInMain;
        } else {
          createCodeInput.value = '';
        }
        document.getElementById('createCodeWarning').classList.add('hidden');
        openModal('createClassModal');
      });
    }

    const closeCreateBtn = document.getElementById('closeCreateClassModalBtn');
    if (closeCreateBtn) {
      closeCreateBtn.addEventListener('click', () => {
        closeModal('createClassModal');
      });
    }

    // Input Listener for Create Class Code Field
    const createCodeInput = document.getElementById('createCodeInput');
    const createCodeWarning = document.getElementById('createCodeWarning');
    if (createCodeInput) {
      createCodeInput.addEventListener('input', async (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');

        const val = e.target.value.trim();
        if (val.length === 6) {
          const exists = await checkClassCodeExists(val);
          if (exists) {
            createCodeWarning.textContent = '⛔ 이미 사용 중인 학급 코드입니다. 다른 6자리 코드를 입력해 주세요.';
            createCodeWarning.classList.remove('hidden');
          } else {
            createCodeWarning.classList.add('hidden');
          }
        } else {
          createCodeWarning.classList.add('hidden');
        }
      });
    }

    // Submit New Class Creation Form
    const createClassForm = document.getElementById('createClassForm');
    if (createClassForm) {
      createClassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = document.getElementById('createCodeInput').value.replace(/[^0-9]/g, '').trim();
        const grade = document.getElementById('createGradeSelect').value;
        const classNum = document.getElementById('createClassNumSelect').value;
        const className = document.getElementById('createClassNameInput').value.trim();
        const teacherName = document.getElementById('createTeacherNameInput').value.trim();

        if (!code || code.length !== 6) {
          alert('올바른 6자리 숫자 학급 코드를 입력해 주세요.');
          return;
        }

        if (!className) {
          alert('클래스 이름을 입력해 주세요.');
          return;
        }

        if (!teacherName) {
          alert('선생님 닉네임을 입력해 주세요.');
          return;
        }

        const exists = await checkClassCodeExists(code);
        if (exists) {
          createCodeWarning.textContent = '⛔ 이미 사용 중인 학급 코드입니다. 다른 6자리 코드를 입력해 주세요.';
          createCodeWarning.classList.remove('hidden');
          alert(`⛔ [${code}] 학급 코드는 이미 사용 중입니다.\n\n다른 6자리 코드를 입력해 주세요.`);
          return;
        }

        createCodeWarning.classList.add('hidden');
        await ensureFirebaseAuth();

        const newClassRecord = {
          inviteCode: code,
          grade: grade,
          classNum: classNum,
          className: className,
          teacherName: teacherName,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        registeredClasses[code] = newClassRecord;
        await syncToFirestore('classes', code, newClassRecord);
        saveStorageData();

        const teacherUser = {
          id: `teacher_${code}`,
          name: teacherName,
          role: 'teacher',
          inviteCode: code,
          className: className,
          titleIndex: 5,
          totalGold: 999,
          currentGold: 999
        };

        saveSessionUser(teacherUser);
        updateTeacherDashboardUI();

        closeModal('createClassModal');
        closeModal('loginModal');
        updateHeaderUI();
        showView('adminView');

        alert(`🎉 신규 학급 [${className}] (코드: ${code}) 개설이 완료되었습니다!`);
      });
    }

    // Teacher Class Settings Modal Handlers
    const editClassBtn = document.getElementById('editClassSettingsBtn');
    if (editClassBtn) {
      editClassBtn.addEventListener('click', () => {
        if (!currentUser) return;
        document.getElementById('editClassCodeInput').value = currentUser.inviteCode || '';
        document.getElementById('editClassNameInput').value = currentUser.className || '';
        document.getElementById('editTeacherNameInput').value = currentUser.name || '';
        openModal('classConfigModal');
      });
    }

    document.getElementById('closeClassConfigModalBtn').addEventListener('click', () => {
      closeModal('classConfigModal');
    });

    // Submit Teacher Class Configuration Change
    document.getElementById('classConfigForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'superadmin')) return;

      const customClassName = document.getElementById('editClassNameInput').value.trim();
      const customTeacherName = document.getElementById('editTeacherNameInput').value.trim();
      const grade = document.getElementById('editGradeSelect').value;
      const classNum = document.getElementById('editClassNumSelect').value;

      if (!customClassName) {
        alert('클래스 이름을 입력해 주세요.');
        return;
      }

      if (!customTeacherName) {
        alert('선생님 닉네임을 입력해 주세요.');
        return;
      }

      await ensureFirebaseAuth();

      currentUser.className = customClassName;
      currentUser.name = customTeacherName;

      const code = currentUser.inviteCode; // Code is readonly & immutable!
      const classRecord = {
        ...(registeredClasses[code] || {}),
        className: customClassName,
        teacherName: customTeacherName,
        grade: grade,
        classNum: classNum,
        inviteCode: code,
        updatedAt: Date.now()
      };

      registeredClasses[code] = classRecord;

      await syncToFirestore('classes', code, classRecord);

      sampleClassStudents.forEach(async (s) => {
        if (s.inviteCode === code) {
          s.className = customClassName;
          await syncToFirestore('students', s.id, s);
        }
      });

      Object.values(allPlayersMap).forEach(async (p) => {
        if (p.inviteCode === code) {
          p.className = customClassName;
          await syncToFirestore('students', p.id, p);
        }
      });

      saveStorageData();
      saveSessionUser(currentUser);

      closeModal('classConfigModal');
      renderTeacherAdminPage();
      updateHeaderUI();

      alert(`✅ 학반 정보가 [${customClassName}], 선생님 닉네임이 [${customTeacherName}]로 저장되었습니다!`);
    });

    // Anon Login Click
    document.getElementById('anonLoginStartBtn').addEventListener('click', async () => {
      await ensureFirebaseAuth();
      const randomCode = generateRandomAnonCode();
      const anonUser = {
        id: `anon_${randomCode}`,
        name: `익명${randomCode}`,
        role: 'anon'
      };

      getUserModeData(anonUser, currentMode);
      await saveUserDataInList(anonUser);
      saveSessionUser(anonUser);
      closeModal('loginModal');
      updateHeaderUI();
      showView('lobbyView');
    });

    // Mini-Game Buttons
    document.querySelectorAll('.btn-game-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const gameType = parseInt(e.currentTarget.dataset.game);
        startMiniGame(gameType);
      });
    });

    // Boss Entry Button
    document.getElementById('enterBossBtn').addEventListener('click', () => {
      requestBossEntry();
    });

    // Navigation Buttons
    document.getElementById('logoBtn').addEventListener('click', () => showView('lobbyView'));
    document.getElementById('navHomeBtn').addEventListener('click', () => handleHomeNavigation());
    document.getElementById('logoutBtn').addEventListener('click', () => handleLogout());

    // Modal Close Buttons
    document.getElementById('closeResultModalBtn').addEventListener('click', () => {
      closeModal('resultModal');
      showView('lobbyView');
    });

    document.getElementById('closeTitleModalBtn').addEventListener('click', () => {
      closeModal('titleModal');
    });

    document.getElementById('closeChartModalBtn').addEventListener('click', () => {
      closeModal('chartModal');
    });

    // User Title Button Click
    document.getElementById('userTitleBtn').addEventListener('click', () => showTitleModal());
    document.getElementById('userBadgeContainer').addEventListener('click', (e) => {
      if (e.target.closest('#userTitleBtn')) {
        showTitleModal();
      }
    });

    // Hall of Heroes Views
    document.getElementById('openHallBtn').addEventListener('click', () => {
      renderHallOfHeroes('gold');
      showView('hallView');
    });

    document.querySelectorAll('.hall-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        renderHallOfHeroes(e.target.dataset.tab);
      });
    });

    // Admin Page View
    document.getElementById('openAdminBtn').addEventListener('click', () => {
      renderTeacherAdminPage();
      showView('adminView');
    });

    // Copy Invite Code Button
    document.getElementById('copyInviteBtn').addEventListener('click', () => {
      const code = document.getElementById('teacherInviteCode').textContent;
      navigator.clipboard.writeText(code).then(() => {
        alert(`초대코드 (${code})가 복사되었습니다!`);
      }).catch(() => {
        alert(`초대코드: ${code}`);
      });
    });

    // Sound Toggle
    document.getElementById('soundToggleBtn').addEventListener('click', () => {
      sound.enabled = !sound.enabled;
      document.getElementById('soundIcon').textContent = sound.enabled ? '🔊' : '🔇';
    });

    // Initial Mode Setup
    setMode('gugudan');
  }

  // Run App Initialization on DOM Load
  document.addEventListener('DOMContentLoaded', initApp);

})();
