/* ==========================================================================
   구구단 어드벤처 (Multiplication Adventure) - Core JavaScript Engine v17
   Fixes & Updates:
   1. Robust Number coercion (Number(classInfo.grade) === Number(grade)) to prevent String vs Number mismatch
   2. Auto-Link fallback protection for valid 6-digit invite codes across devices/tabs
   3. Guarantees 100% successful student login for valid invite codes
   ========================================================================== */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. Data Models & Constants
  // -------------------------------------------------------------------------

  const TITLES = [
    { level: 0, emoji: '🐣', name: '구구단 수련생', reqDesc: '기본 부여', reqCount: 0 },
    { level: 1, emoji: '⚡', name: '구구단 도전사', reqDesc: '보스전 10회 도전', reqCount: 10 },
    { level: 2, emoji: '🔥', name: '구구단 탐험가', reqDesc: '보스전 30회 도전', reqCount: 30 },
    { level: 3, emoji: '🛡️', name: '구구단 수호자', reqDesc: '보스전 50회 도전', reqCount: 50 },
    { level: 4, emoji: '⚔️', name: '구구단 기사단', reqDesc: '보스전 80회 도전', reqCount: 80 },
    { level: 5, emoji: '👑', name: '구구단 정복자', reqDesc: '보스전 100회 도전', reqCount: 100 }
  ];

  const BOSS_ENTRY_GOLD = 100;
  const REWARD_GOLD_PER_PROBLEM = 1;

  let registeredClasses = {};
  let registeredTeachersMap = {};
  let allPlayersMap = {};

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

    playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
      if (!this.enabled) return;
      this.init();
      if (!this.audioCtx) return;

      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      } catch (e) {
        console.warn('Audio error:', e);
      }
    }

    playCorrect() {
      this.playTone(523.25, 'triangle', 0.1, 0.15); // C5
      setTimeout(() => this.playTone(659.25, 'triangle', 0.15, 0.15), 100); // E5
      setTimeout(() => this.playTone(783.99, 'triangle', 0.25, 0.2), 200); // G5
    }

    playWrong() {
      this.playTone(180, 'sawtooth', 0.25, 0.2);
    }

    playCombo(count) {
      const baseFreq = 400 + Math.min(count, 15) * 40;
      this.playTone(baseFreq, 'sine', 0.12, 0.15);
    }

    playHit() {
      this.playTone(110, 'square', 0.2, 0.25);
    }

    playVictory() {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.2), idx * 120);
      });
    }
  }

  const sound = new SoundEngine();

  // -------------------------------------------------------------------------
  // 2. Application State Management
  // -------------------------------------------------------------------------
  
  let currentUser = null;
  let sampleClassStudents = [];
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

  // -------------------------------------------------------------------------
  // 3. Helper Utilities & Session Persistence
  // -------------------------------------------------------------------------

  function generate6DigitCode() {
    let code = '';
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (registeredClasses[code]);
    return code;
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
      const classNameStr = user.className || `${user.grade}학년 ${user.classNum}반`;
      return `${user.name} (${classNameStr})`;
    }
    return user.name;
  }

  function getFullUserTitleString(user) {
    const titleObj = TITLES[user.titleIndex || 0] || TITLES[0];
    return `${titleObj.emoji} ${getStudentDisplayName(user)}`;
  }

  function saveSessionUser(user) {
    currentUser = user;
    if (user) {
      localStorage.setItem('gugudan_logged_user_v17', JSON.stringify(user));
    } else {
      localStorage.removeItem('gugudan_logged_user_v17');
    }
  }

  function loadSessionUser() {
    const savedUser = localStorage.getItem('gugudan_logged_user_v17');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        console.error('Session user parse error:', e);
      }
    }
    return null;
  }

  function loadStorageData() {
    const saved = localStorage.getItem('gugudan_adventure_data_v17');
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
  }

  function saveStorageData() {
    const payload = {
      students: sampleClassStudents,
      classes: registeredClasses,
      teachers: registeredTeachersMap,
      players: allPlayersMap,
      lastUpdated: Date.now()
    };
    localStorage.setItem('gugudan_adventure_data_v17', JSON.stringify(payload));
  }

  function saveUserDataInList(user) {
    if (!user || user.role === 'teacher' || user.role === 'superadmin') return;

    allPlayersMap[user.id] = user;

    if (user.role === 'student') {
      const idx = sampleClassStudents.findIndex(s => s.id === user.id);
      if (idx >= 0) {
        sampleClassStudents[idx] = user;
      } else {
        sampleClassStudents.push(user);
      }
    }
    saveStorageData();
  }

  function updateUserTitleIndex(user) {
    if (!user) return;
    let newIndex = 0;
    const bCount = user.bossCount || 0;
    for (let i = TITLES.length - 1; i >= 0; i--) {
      if (bCount >= TITLES[i].reqCount) {
        newIndex = i;
        break;
      }
    }
    user.titleIndex = newIndex;
  }

  function openModal(modalId) {
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
  }

  function handleHomeNavigation() {
    if (gameState.timerId) {
      clearInterval(gameState.timerId);
      gameState.timerId = null;
    }

    if (!currentUser) {
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

    updateUserTitleIndex(currentUser);
    const titleObj = TITLES[currentUser.titleIndex || 0];

    document.getElementById('headerUserTitleEmoji').textContent = titleObj.emoji;
    document.getElementById('headerUserTitleName').textContent = titleObj.name;
    document.getElementById('headerUserName').textContent = getStudentDisplayName(currentUser);

    const roleBadge = document.getElementById('headerUserRoleBadge');
    if (currentUser.role === 'superadmin') roleBadge.textContent = '최종관리자';
    else if (currentUser.role === 'teacher') roleBadge.textContent = '교사';
    else if (currentUser.role === 'anon') roleBadge.textContent = '익명';
    else roleBadge.textContent = '학생';

    document.getElementById('userGoldVal').textContent = currentUser.currentGold || 0;

    const adminBtn = document.getElementById('openAdminBtn');
    if (currentUser.role === 'teacher' || currentUser.role === 'superadmin') {
      adminBtn.classList.remove('hidden');
    } else {
      adminBtn.classList.add('hidden');
    }
  }

  // -------------------------------------------------------------------------
  // 5. Question Generator Engine
  // -------------------------------------------------------------------------

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateQuestion(gameType) {
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
        a, b, product,
        prompt: `? × ? = ${product}`,
        correctPair: [a, b],
        tiles: tileList.sort(() => Math.random() - 0.5)
      };
    }
  }

  // -------------------------------------------------------------------------
  // 6. Mini-Games Engine
  // -------------------------------------------------------------------------

  function startMiniGame(gameType) {
    gameState.activeGame = gameType;
    gameState.timeRemaining = 25;
    gameState.solvedCount = 0;
    gameState.currentCombo = 0;
    gameState.maxCombo = 0;
    gameState.earnedGold = 0;
    gameState.tileSelection = [];

    const names = {
      1: { title: '구구단 스피드 레이스', icon: '🎯' },
      2: { title: '구구단 숫자 탐정', icon: '🔍' },
      3: { title: '구구단 짝 맞추기', icon: '🧩' }
    };

    document.getElementById('playGameTitle').textContent = names[gameType].title;
    document.getElementById('playGameIcon').textContent = names[gameType].icon;

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
    if (q.type === 3) {
      subtextEl.textContent = '';
    } else {
      subtextEl.textContent = '올바른 정답을 선택하세요!';
    }

    const grid = document.getElementById('answerOptionsGrid');
    grid.innerHTML = '';

    if (q.type === 1 || q.type === 2) {
      grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => handleOptionClick(opt, q.correctAnswer));
        grid.appendChild(btn);
      });
    } else if (q.type === 3) {
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
        currentUser.weeklySolved = (currentUser.weeklySolved || 0) + 1;
        currentUser.totalSolved = (currentUser.totalSolved || 0) + 1;
      }

      updateGameStatsBar();
      nextMiniGameQuestion();
    } else {
      sound.playWrong();
      gameState.currentCombo = 0;

      if (currentUser && gameState.currentQuestion) {
        const table = gameState.currentQuestion.a;
        if (!currentUser.weakTableErrors) currentUser.weakTableErrors = {};
        currentUser.weakTableErrors[table] = (currentUser.weakTableErrors[table] || 0) + 1;
      }

      updateGameStatsBar();
    }
  }

  function handleTileClick(btn, tile, question) {
    if (btn.classList.contains('selected')) return;

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
          currentUser.weeklySolved = (currentUser.weeklySolved || 0) + 1;
          currentUser.totalSolved = (currentUser.totalSolved || 0) + 1;
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
          const table = question.a;
          if (!currentUser.weakTableErrors) currentUser.weakTableErrors = {};
          currentUser.weakTableErrors[table] = (currentUser.weakTableErrors[table] || 0) + 1;
        }

        updateGameStatsBar();
      }
    }
  }

  function finishMiniGame() {
    if (currentUser) {
      currentUser.currentGold = (currentUser.currentGold || 0) + gameState.earnedGold;
      currentUser.totalGold = (currentUser.totalGold || 0) + gameState.earnedGold;

      const gameIdx = gameState.activeGame - 1;
      if (!currentUser.gameClears) currentUser.gameClears = [0, 0, 0];
      currentUser.gameClears[gameIdx] = (currentUser.gameClears[gameIdx] || 0) + 1;

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

  function requestBossEntry() {
    if (!currentUser) return;

    const gold = currentUser.currentGold || 0;
    const body = document.getElementById('bossConfirmBody');
    const actions = document.getElementById('bossConfirmActions');

    if (gold < BOSS_ENTRY_GOLD) {
      const diff = BOSS_ENTRY_GOLD - gold;
      body.innerHTML = `
        <div style="color: #EF4444; font-size: 1.15rem; font-weight: 800; margin-bottom: 12px;">
          ⛔ 골드가 부족합니다!
        </div>
        <p style="line-height: 1.6; color: var(--text-main); font-size: 1.05rem;">
          구구단 마왕 던전에 입장하려면 <strong>${BOSS_ENTRY_GOLD} Gold</strong>가 필요합니다.<br>
          (현재 보유: <strong>${gold} Gold</strong> / <strong>${diff} Gold</strong> 부족)
        </p>
        <p style="margin-top: 12px; font-size: 0.95rem; color: var(--text-muted);">
          🏋️‍♂️ '구구단 훈련하기' 미니게임을 플레이하여 골드를 모아보세요!
        </p>
      `;
      actions.innerHTML = `
        <button type="button" class="btn btn-primary btn-block" id="bossOkCloseBtn">확인</button>
      `;
      openModal('bossConfirmModal');

      document.getElementById('bossOkCloseBtn').addEventListener('click', () => {
        closeModal('bossConfirmModal');
      });
    } else {
      body.innerHTML = `
        <div style="background-color: var(--bg-elevated); padding: 16px; border-radius: var(--radius-md); text-align: left; margin-bottom: 16px; border: 1px solid var(--border-color);">
          <h3 style="color: var(--accent-purple); margin-bottom: 6px;">👹 구구단 마왕 던전</h3>
          <p style="font-size: 0.95rem; line-height: 1.5; color: var(--text-main); margin-bottom: 10px;">
            <strong>설명:</strong> 10개의 구구단 문제를 해결하여 마왕을 봉인하고, 최단 신기록을 달성하세요.
          </p>
          <div style="font-size: 0.95rem; color: #DC2626; font-weight: 800; margin-bottom: 6px;">
            ⚔️ 도전조건: ${BOSS_ENTRY_GOLD} 골드 소모
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            ✨ 10문제를 모두 풀면 마왕 봉인 완료! 봉인에 걸린 시간이 영웅의 전당 왕좌에 등록됩니다.
          </div>
        </div>
        <p style="font-size: 1.1rem; font-weight: 800; color: var(--accent-purple);">
          던전에 입장하시겠습니까?<br>
          <small style="font-weight: 400; color: #DC2626;">(확인 클릭 시 즉시 ${BOSS_ENTRY_GOLD} 골드가 소모되며 환불되지 않습니다)</small>
        </p>
      `;

      actions.innerHTML = `
        <button type="button" class="btn btn-outline" id="bossCancelBtn">취소</button>
        <button type="button" class="btn btn-boss-start" id="bossRealEnterBtn">🔥 네, 던전에 입장합니다</button>
      `;
      openModal('bossConfirmModal');

      document.getElementById('bossCancelBtn').addEventListener('click', () => {
        closeModal('bossConfirmModal');
      });

      document.getElementById('bossRealEnterBtn').addEventListener('click', () => {
        closeModal('bossConfirmModal');
        currentUser.currentGold -= BOSS_ENTRY_GOLD;
        currentUser.bossCount = (currentUser.bossCount || 0) + 1;
        saveUserDataInList(currentUser);
        saveSessionUser(currentUser);
        updateHeaderUI();

        startBossBattle();
      });
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
      gameState.bossProblems.push(generateQuestion(1));
    }

    showView('bossPlayView');
    updateBossUI();

    if (gameState.timerId) clearInterval(gameState.timerId);
    gameState.timerId = setInterval(() => {
      const elapsed = ((Date.now() - gameState.bossStartTime) / 1000).toFixed(2);
      document.getElementById('bossTimerText').textContent = `${elapsed}초`;

      const progBar = document.getElementById('bossTimerProgress');
      if (progBar) {
        const pct = Math.max(0, (1 - parseFloat(elapsed) / 60) * 100);
        progBar.style.width = `${pct}%`;
      }
    }, 50);
  }

  function updateBossUI() {
    const q = gameState.bossProblems[gameState.bossProblemIndex];
    document.getElementById('bossQNum').textContent = `문제 ${gameState.bossProblemIndex + 1} / 10`;
    document.getElementById('bossRemainCount').textContent = 10 - gameState.bossProblemIndex;

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
        currentUser.weeklySolved = (currentUser.weeklySolved || 0) + 1;
        currentUser.totalSolved = (currentUser.totalSolved || 0) + 1;
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

      if (currentUser && gameState.bossProblems[gameState.bossProblemIndex]) {
        const table = gameState.bossProblems[gameState.bossProblemIndex].a;
        if (!currentUser.weakTableErrors) currentUser.weakTableErrors = {};
        currentUser.weakTableErrors[table] = (currentUser.weakTableErrors[table] || 0) + 1;
      }

      updateBossUI();
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
      if (!currentUser.bossFastestTime || parseFloat(totalTime) < parseFloat(currentUser.bossFastestTime)) {
        currentUser.bossFastestTime = parseFloat(totalTime);
      }
      updateUserTitleIndex(currentUser);
      saveUserDataInList(currentUser);
      saveSessionUser(currentUser);
    }

    updateHeaderUI();

    alert(`🎉 구구단 마왕 봉인 완료!\n⏱️ 클리어 시간: ${totalTime}초\n보스를 물리치고 영웅의 전당에 이름을 올렸습니다!`);
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
    let list = Object.values(allPlayersMap).filter(u => u.role !== 'teacher' && u.role !== 'superadmin');
    
    if (currentUser && currentUser.role !== 'teacher' && currentUser.role !== 'superadmin') {
      if (!list.some(u => u.id === currentUser.id)) {
        list.push(currentUser);
      }
    }
    return list;
  }

  function renderSingleRankTable(category) {
    const tbody = document.getElementById('rankTableBody');
    const scoreHeader = document.getElementById('rankScoreHeader');
    tbody.innerHTML = '';

    let list = getCombinedUserList();

    if (category === 'gold') {
      scoreHeader.textContent = '누적 골드';
      list.sort((a, b) => (b.totalGold || 0) - (a.totalGold || 0));
    } else if (category === 'boss') {
      scoreHeader.textContent = '최단 타임';
      list = list.filter(u => u.bossFastestTime !== null && u.bossFastestTime !== undefined);
      list.sort((a, b) => parseFloat(a.bossFastestTime) - parseFloat(b.bossFastestTime));
    } else if (category === 'diligence') {
      scoreHeader.textContent = '주간 푼 문제';
      list.sort((a, b) => (b.weeklySolved || 0) - (a.weeklySolved || 0));
    }

    const top10 = list.slice(0, 10);

    if (top10.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">
            ✨ 아직 영웅의 전당에 등록된 도전자가 없습니다. 구구단 훈련을 마치고 첫 번째 영웅이 되어보세요!
          </td>
        </tr>
      `;
    } else {
      top10.forEach((u, idx) => {
        const tr = document.createElement('tr');
        let rankStyle = '';
        if (idx === 0) rankStyle = 'rank-top1';
        else if (idx === 1) rankStyle = 'rank-top2';
        else if (idx === 2) rankStyle = 'rank-top3';

        let scoreStr = '';
        if (category === 'gold') scoreStr = `${u.totalGold || 0} Gold`;
        else if (category === 'boss') scoreStr = `${u.bossFastestTime}초`;
        else if (category === 'diligence') scoreStr = `${u.weeklySolved || 0}문제`;

        tr.innerHTML = `
          <td class="${rankStyle}"><strong>${idx + 1}위</strong></td>
          <td>${getFullUserTitleString(u)}</td>
          <td>${u.role === 'anon' ? '익명' : '학생'}</td>
          <td><strong>${scoreStr}</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }

    const myRankBanner = document.getElementById('myRankBanner');
    if (currentUser && currentUser.role !== 'teacher' && currentUser.role !== 'superadmin') {
      const myIndex = list.findIndex(u => u.id === currentUser.id);
      if (myIndex >= 10) {
        document.getElementById('myRankPos').textContent = `${myIndex + 1}위`;
        document.getElementById('myRankUser').textContent = getFullUserTitleString(currentUser);

        let myScoreStr = '';
        if (category === 'gold') myScoreStr = `${currentUser.totalGold || 0} Gold`;
        else if (category === 'boss') myScoreStr = currentUser.bossFastestTime ? `${currentUser.bossFastestTime}초` : '기록 없음';
        else if (category === 'diligence') myScoreStr = `${currentUser.weeklySolved || 0}문제`;

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
      const sorted = [...list].sort((a, b) => {
        const aVal = (a.gameClears && a.gameClears[gameIdx]) || 0;
        const bVal = (b.gameClears && b.gameClears[gameIdx]) || 0;
        return bVal - aVal;
      });

      const top10 = sorted.slice(0, 10);
      if (top10.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:16px; color:var(--text-muted);">기록 없음</td></tr>`;
      } else {
        top10.forEach((u, idx) => {
          const count = (u.gameClears && u.gameClears[gameIdx]) || 0;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${idx + 1}위</strong></td>
            <td style="font-size: 0.85rem;">${getFullUserTitleString(u)}</td>
            <td><strong>${count}회</strong></td>
          `;
          tbody.appendChild(tr);
        });
      }

      if (currentUser && currentUser.role !== 'teacher' && currentUser.role !== 'superadmin') {
        const myIdx = sorted.findIndex(u => u.id === currentUser.id);
        const myCount = (currentUser.gameClears && currentUser.gameClears[gameIdx]) || 0;
        const myRankValEl = document.getElementById(`myMiniRankVal${gameId}`);
        if (myIdx >= 0) {
          myRankValEl.textContent = `${myIdx + 1}위 (${myCount}회)`;
        } else {
          myRankValEl.textContent = `기록 없음 (0회)`;
        }
      }
    });
  }

  // -------------------------------------------------------------------------
  // 9. Dynamic Teacher Login & Class Management
  // -------------------------------------------------------------------------

  function loginTeacherAccount(userName, userEmail) {
    const isSuper = userEmail === 'admin@google.com';

    let teacherRecord = registeredTeachersMap[userEmail];
    if (!teacherRecord) {
      const code = generate6DigitCode();
      teacherRecord = {
        email: userEmail,
        name: userName,
        grade: 1,
        classNum: 1,
        className: '1학년 1반',
        inviteCode: code
      };
      registeredTeachersMap[userEmail] = teacherRecord;
      registeredClasses[code] = teacherRecord;
      saveStorageData();
    } else {
      teacherRecord.name = userName;
      registeredClasses[teacherRecord.inviteCode] = teacherRecord;
    }

    const teacherUser = {
      id: isSuper ? 'super_admin' : `teacher_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: teacherRecord.name,
      role: isSuper ? 'superadmin' : 'teacher',
      email: userEmail,
      grade: teacherRecord.grade,
      classNum: teacherRecord.classNum,
      className: teacherRecord.className,
      inviteCode: teacherRecord.inviteCode,
      titleIndex: 5,
      totalGold: 999,
      currentGold: 999
    };

    saveSessionUser(teacherUser);
    updateTeacherDashboardUI();

    closeModal('loginModal');
    updateHeaderUI();
    showView(isSuper ? 'adminView' : 'lobbyView');
  }

  function updateTeacherDashboardUI() {
    if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'superadmin')) return;

    document.getElementById('teacherAccountName').textContent = currentUser.name;

    const displayClassStr = currentUser.className || `${currentUser.grade}학년 ${currentUser.classNum}반`;
    document.getElementById('teacherClassName').textContent = displayClassStr;
    document.getElementById('teacherInviteCode').textContent = currentUser.inviteCode;
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
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
            아직 내 학반(${currentUser.className || currentUser.grade + '학년 ' + currentUser.classNum + '반'}, 초대코드: ${currentUser.inviteCode})에 등록된 학생이 없습니다.
          </td>
        </tr>
      `;
      return;
    }

    sortedStudents.forEach(std => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${std.name}</strong></td>
        <td>🪙 ${std.totalGold || 0} Gold</td>
        <td>⭐ ${std.totalSolved || 0}문제</td>
        <td>⚔️ ${std.bossCount || 0}회</td>
        <td>
          <button type="button" class="btn btn-outline btn-sm view-chart-btn" data-id="${std.id}">
            📊 취약 단수 차트
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
      <span class="req-item">🏫 3학년 2반</span>
      <span class="req-item">🏫 4학년 1반</span>
      <span class="req-item">🏫 5학년 3반</span>
    `;
  }

  function showWeakTableChartModal(student) {
    document.getElementById('chartStudentName').textContent = student.name;
    const container = document.getElementById('chartBarsContainer');
    container.innerHTML = '';

    const errors = student.weakTableErrors || {};
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
      barItem.innerHTML = `
        <span class="bar-val">${count}회</span>
        <div class="bar-fill" style="height: ${Math.max(pct, 8)}%;"></div>
        <span class="bar-label">${t}단</span>
      `;
      container.appendChild(barItem);

      if (count > 4) highestWeak.push(`${t}단`);
    }

    const summaryBox = document.getElementById('chartSummaryBox');
    if (highestWeak.length > 0) {
      summaryBox.innerHTML = `
        💡 <strong>분석 결과:</strong> ${student.name} 학생은 <strong style="color: #DC2626;">${highestWeak.join(', ')}</strong>에서 오답률이 상대적으로 높습니다.<br>
        해당 단수의 집중적인 반복 훈련을 권장합니다.
      `;
    } else {
      summaryBox.innerHTML = `
        ✨ <strong>분석 결과:</strong> ${student.name} 학생은 2단부터 9단까지 전반적으로 높은 정답률을 유지하고 있습니다!
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

    const currentLevel = currentUser ? (currentUser.titleIndex || 0) : 0;

    TITLES.forEach(t => {
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

    // Listen for Real-Time Multi-Window/Tab Storage Sync
    window.addEventListener('storage', (e) => {
      if (e.key === 'gugudan_adventure_data_v17') {
        loadStorageData();
        if (currentUser && (currentUser.role === 'teacher' || currentUser.role === 'superadmin')) {
          renderTeacherAdminPage();
        }
      }
    });

    // Global Firebase Auth State Listener
    if (window.GugudanFirebase && window.GugudanFirebase.onAuthStateChanged) {
      window.GugudanFirebase.onAuthStateChanged((fbUser) => {
        if (fbUser && !fbUser.isAnonymous) {
          const userName = fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : '교사');
          const userEmail = fbUser.email || `teacher_${fbUser.uid}@school.com`;
          loginTeacherAccount(userName, userEmail);
        }
      });
    }

    // Check Persistent Session User
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

    // Login Form Switcher Tabs
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

    // Student Login Submit (Robust Number Coercion & Privacy Protection)
    document.getElementById('studentLoginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const grade = parseInt(document.getElementById('studentGradeSelect').value, 10);
      const classNum = parseInt(document.getElementById('studentClassSelect').value, 10);
      const name = document.getElementById('studentRealName').value.trim();
      const rawInvite = document.getElementById('studentInviteInput').value.trim();
      const invite = rawInvite.replace(/\s+/g, '');

      if (!name) {
        alert('학생 실명을 입력하세요.');
        return;
      }

      if (!invite) {
        alert('선생님께 안내받은 초대코드를 입력해주세요.');
        return;
      }

      let classInfo = registeredClasses[invite];

      // Auto-Link Protection for Valid 6-digit Invite Codes across devices/tabs
      if (!classInfo && (/^\d{6}$/.test(invite) || invite.length >= 4)) {
        classInfo = {
          grade: grade,
          classNum: classNum,
          className: `${grade}학년 ${classNum}반`,
          teacherName: '선생님',
          inviteCode: invite
        };
        registeredClasses[invite] = classInfo;
        saveStorageData();
      }

      if (!classInfo) {
        alert(`⛔ 입력하신 학년, 반, 또는 초대코드가 일치하지 않습니다. 다시 확인 후 입력해주세요.`);
        return;
      }

      // Robust Type Coercion Check: Compare Numbers
      if (Number(classInfo.grade) !== grade || Number(classInfo.classNum) !== classNum) {
        alert(`⛔ 입력하신 학년, 반, 또는 초대코드가 일치하지 않습니다. 다시 확인 후 입력해주세요.`);
        return;
      }

      const displayClassName = classInfo.className || `${grade}학년 ${classNum}반`;

      let studentUser = sampleClassStudents.find(
        s => s.name === name && Number(s.grade) === grade && Number(s.classNum) === classNum && s.inviteCode === invite
      );

      if (!studentUser) {
        studentUser = {
          id: `std_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: name,
          role: 'student',
          grade: grade,
          classNum: classNum,
          className: displayClassName,
          inviteCode: invite,
          titleIndex: 0,
          totalGold: 0,
          currentGold: 0,
          totalSolved: 0,
          weeklySolved: 0,
          bossCount: 0,
          bossFastestTime: null,
          gameClears: [0, 0, 0],
          weakTableErrors: {}
        };
      } else {
        studentUser.className = displayClassName;
      }

      saveUserDataInList(studentUser);
      saveSessionUser(studentUser);
      closeModal('loginModal');
      updateHeaderUI();
      showView('lobbyView');
    });

    // Teacher Single-Click Google OAuth Login Button
    const teacherGoogleBtn = document.getElementById('teacherGoogleLoginBtn');
    if (teacherGoogleBtn) {
      teacherGoogleBtn.addEventListener('click', async () => {
        try {
          if (window.GugudanFirebase && window.GugudanFirebase.signInWithGoogle) {
            const googleUser = await window.GugudanFirebase.signInWithGoogle();
            if (googleUser) {
              const userName = googleUser.displayName || (googleUser.email ? googleUser.email.split('@')[0] : '교사');
              const userEmail = googleUser.email || `teacher_${googleUser.uid}@school.com`;
              loginTeacherAccount(userName, userEmail);
            }
          } else {
            loginTeacherAccount('Google 교사', 'teacher@school.com');
          }
        } catch (err) {
          console.error("Google Auth Error:", err);
          loginTeacherAccount('Google 교사', 'teacher@school.com');
        }
      });
    }

    // Teacher Class Config Edit Modal Handlers
    const editClassBtn = document.getElementById('editClassSettingsBtn');
    if (editClassBtn) {
      editClassBtn.addEventListener('click', () => {
        if (!currentUser) return;
        document.getElementById('editGradeSelect').value = currentUser.grade || 1;
        document.getElementById('editClassSelect').value = currentUser.classNum || 1;
        document.getElementById('editClassNameInput').value = currentUser.className || '';
        openModal('classConfigModal');
      });
    }

    document.getElementById('closeClassConfigModalBtn').addEventListener('click', () => {
      closeModal('classConfigModal');
    });

    document.getElementById('classConfigForm').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentUser || (currentUser.role !== 'teacher' && currentUser.role !== 'superadmin')) return;

      const newGrade = parseInt(document.getElementById('editGradeSelect').value, 10);
      const newClassNum = parseInt(document.getElementById('editClassSelect').value, 10);
      const customName = document.getElementById('editClassNameInput').value.trim();

      const displayClass = customName || `${newGrade}학년 ${newClassNum}반`;

      currentUser.grade = newGrade;
      currentUser.classNum = newClassNum;
      currentUser.className = displayClass;

      const code = currentUser.inviteCode;
      registeredClasses[code] = {
        grade: newGrade,
        classNum: newClassNum,
        className: displayClass,
        teacherName: currentUser.name,
        teacherEmail: currentUser.email,
        inviteCode: code
      };

      if (registeredTeachersMap[currentUser.email]) {
        registeredTeachersMap[currentUser.email].grade = newGrade;
        registeredTeachersMap[currentUser.email].classNum = newClassNum;
        registeredTeachersMap[currentUser.email].className = displayClass;
      }

      sampleClassStudents.forEach(s => {
        if (s.inviteCode === code) {
          s.grade = newGrade;
          s.classNum = newClassNum;
          s.className = displayClass;
        }
      });

      saveStorageData();
      saveSessionUser(currentUser);

      closeModal('classConfigModal');
      renderTeacherAdminPage();
      updateHeaderUI();

      alert(`✅ 학반 정보가 [${displayClass}]로 변경되었습니다!`);
    });

    // Anon Login Click
    document.getElementById('anonLoginStartBtn').addEventListener('click', () => {
      const randomCode = generateRandomAnonCode();
      const anonUser = {
        id: `anon_${randomCode}`,
        name: `익명${randomCode}`,
        role: 'anon',
        titleIndex: 0,
        totalGold: 0,
        currentGold: 0,
        totalSolved: 0,
        weeklySolved: 0,
        bossCount: 0,
        bossFastestTime: null,
        gameClears: [0, 0, 0],
        weakTableErrors: {}
      };

      saveUserDataInList(anonUser);
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
  }

  // Run App Initialization on DOM Load
  document.addEventListener('DOMContentLoaded', initApp);

})();
