# ⚔️ 구구단 어드벤처 (Multiplication Adventure)

> 초등학생과 교사를 위한 신나는 구구단 훈련 미니게임 3종, 구구단 마왕 보스전 타임어택, 6단계 칭호 시스템, 영웅의 전당, 교사용 취약 단수 시각적 분석 차트 통합 웹 애플리케이션입니다.

- **GitHub 저장소**: [https://github.com/keriskeris0106/99dan.git](https://github.com/keriskeris0106/99dan.git)

---

## 🌟 주요 기능

- 🏋️‍♂️ **구구단 훈련하기 (미니게임 3종 / 25초)**:
  - 🎯 **구구단 스피드 레이스** (`2 × 3 = ?`)
  - 🔍 **구구단 숫자 탐정** (`? × 3 = 6`)
  - 🧩 **구구단 짝 맞추기** (`? × ? = 6`)
- 👹 **구구단 마왕 던전 (보스전 타임어택)**:
  - 필요 골드: 100 Gold 소모
  - 10문제 연속 정답 시 마왕 봉인 완료 & 클리어 타임 기록! (오답 시 이동 차단)
- 👑 **6단계 유저 칭호 시스템**:
  - 🐣 구구단 수련생 ➔ ⚡ 구구단 도전사 ➔ 🔥 구구단 탐험가 ➔ 🛡️ 구구단 수호자 ➔ ⚔️ 구구단 기사단 ➔ 👑 구구단 정복자
- 🏆 **영웅의 전당 (Side-by-Side 3열 랭킹 & 내 순위 고정 핀)**:
  - 누적 골드 / 미니게임별 클리어 수 3열 병렬 / 보스 클리어 타임 / 주간 성실 랭킹
- 🏫 **교사 관리자 페이지 & 취약 단수 분석**:
  - 담당 학반 학생 필터링 (동일 학년/반 & 초대코드) 및 가나다(ㄱ-ㄴ-ㄷ) 순 정렬
  - 학생별 2단~9단 오답률 시각적 막대 차트 (Visual Bar Chart)

---

## 🚀 배포 및 실행 안내

### 1️⃣ GitHub 푸시 완료 (Pushed!)
본 프로젝트의 최신 코드는 저장소에 업로드되어 있습니다:
`https://github.com/keriskeris0106/99dan.git`

---

### 2️⃣ Firebase 연동 방법 (Google Auth & Firestore DB)

1. [Firebase Console](https://console.firebase.google.com/)에 접속하여 새 프로젝트를 생성합니다.
2. **Authentication(인증)** 메뉴 ➔ 로그인 방법 설정에서 **구글 로그인(Google)**과 **익명 로그인(Anonymous)**을 활성화합니다.
3. **Firestore Database** 메뉴 ➔ 데이터베이스 만들기를 클릭하고 규칙(Rules)을 `allow read, write: if true;`로 설정합니다.
4. 프로젝트 설정(Project Settings) ➔ 웹 앱 추가(`</>`) ➔ 발급된 `firebaseConfig` 객체를 복사합니다.
5. 본 프로젝트의 `firebase-config.js` 파일을 열고 복사한 키 값으로 채워 넣으세요.

---

### 3️⃣ Vercel로 무료 웹 배포하기 (Vercel Deployment)

1. [Vercel](https://vercel.com/)에 접속하여 GitHub 계정으로 로그인합니다.
2. **Add New...** ➔ **Project**를 클릭합니다.
3. GitHub 저장소 목록에서 `keriskeris0106/99dan`을 선택하고 **Import**합니다.
4. **Deploy** 버튼을 누르면 약 10초 후 배포가 완료되며, 생성된 라이브 URL(예: `https://99dan.vercel.app`)로 접속하여 사용할 수 있습니다!
