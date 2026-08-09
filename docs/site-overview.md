# gmymate 전체 구조 정리 (상세판)

마지막 정리일: 2026-08-03 · 전체 JS 코드 약 3,100줄(공백 포함, api/*.php 포함)

헬스장에서 운동 기록 + 인바디 추이 + 운동용 음악 플레이리스트까지 관리하는 모바일 웹앱. 초록·하양 테마, 바닐라 JS(빌드 도구 없음), PHP+MySQL 백엔드(닷홈 호스팅).

---

## 1. 진입점 3개 페이지

### `index.html` — 로그인 화면
- 아이디/비밀번호 입력 폼(`#loginForm`)
- "자동 로그인" 토글 스위치(체크 시 세션 쿠키 30일 유지, `REMEMBER_SECONDS = 60*60*24*30`)
- 실패 시 `#loginNote`에 에러 메시지 표시
- 성공 시 `main.html`로 이동
- 하단에 "계정이 없으신가요? 회원가입" → `onboarding.html` 링크
- 담당 JS: `src/features/login.js`

### `onboarding.html` — 회원가입 + 프로필 마법사
- 단계별 진행(1/7 ~ 7/7), `onboardingRules` 배열 기준으로 자동 생성
- 각 단계: 키(100~230cm), 나이(10~100세), 몸무게(30~250kg), 목표 몸무게(30~250kg), 헬스 경력(선택), 목표(선택), 주 운동 횟수(선택)
- 마지막 단계에서 아이디(영문/숫자/밑줄 3~20자)/비밀번호(8자 이상) 입력 후 "회원가입하고 시작하기"
- 하단에 "이미 계정이 있으신가요? 로그인" → `index.html` 링크
- 담당 JS: `src/features/onboarding.js`

### `main.html` — 앱 본체
- 로그인 안 하면 `requireAuth()`가 즉시 `index.html`로 리다이렉트
- 상단 헤더(브랜드 로고 + 내 정보 아이콘), 하단 탭 네비게이션 6개
- 담당 JS: `src/features/main.js`, `workout-log.js`, `inbody.js`, `music.js` (전부 `src/app.js`에서 로그인 확인 후 순서대로 실행)

---

## 2. 하단 탭 6개 — 화면별 상세

### 2.1 홈 (`data-view="home"`)
- **오늘 운동 히어로**: "운동 시작" 버튼 → 기록 탭으로 이동 + 토스트
- **목표 요약 패널**: 현재 몸무게 / 목표 몸무게 / 주간 계획 횟수 (프로필 데이터 표시)
- **오늘 현황**: 완료 세트(`x/y`), 운동 볼륨(kg), 연속 운동일
- **오늘 할 일**: 추천 루틴 카드 1개(고정 텍스트: "상체 가볍게 시작")
- **빠른 기록**: 운동/몸무게/달력 바로가기 3버튼
- **작은 습관**: 단백질 챙기기 / 물 2L / 스트레칭 5분 체크박스 (localStorage `gmymateHabits`)

### 2.2 달력 (`data-view="calendar"`)
- 연속 운동일 / 이번 달 운동일 수 / 누적 세션 수
- 주간 스트립(일~토, 완료한 요일 초록 표시)
- 월간 캘린더 그리드(완료일 체크 표시)
- 최근 기록 리스트(최대 6개, 세션별 완료세트/볼륨)

### 2.3 기록 (`data-view="log"`)
- 오늘 진행률/볼륨/휴식 상태 요약 바
- "운동 추가" → 검색 가능한 선택 시트(최근 운동 상단 노출)
- 운동별 세트 목록: 세트 수 증감(±), 세트별 무게/횟수 입력 + 라벨("무게"/"횟수") + 빠른 증감 버튼(±k, ±1/±5회) + 완료 체크(원형 버튼, 맨 오른쪽 고정)
- 세트 완료 시 자동 휴식 타이머 시작(60초/90초/설정값/정지 버튼)
- 오늘 메모(텍스트), "오늘 운동 완료" 버튼 → 히스토리에 세션 저장

### 2.4 루틴 (`data-view="routine"`)
- 상체(가볍게 밀기) / 하체(무리 없는 하체) / 전신(처음 온 날 루틴) 카드 3개
- ⚠ 카드 클릭 시 기록 탭으로 이동 + 토스트만 뜨고, 실제로 그 운동들이 오늘 기록에 추가되지는 않음(장식용 상태, 미해결)

### 2.5 음악 (`data-view="music"`) — 3번 섹션 참고

### 2.6 내정보 (`data-view="profile"`)
- 기본 정보(키/나이/경력/목표) 표시 + "수정" → `onboarding.html`로 이동
- 설정: 쉬운 말로 보기 / 운동 시작 알림 / 초보자 모드 / 큰 버튼 모드 / 무게 조절 단위(k) / 휴식 시간(초)
- 데이터 복사(클립보드로 JSON 내보내기) / 데이터 붙여넣기(클립보드에서 JSON 가져와 복원) / 오늘 기록 초기화 / 로그아웃
- 인바디 기록: 날짜/몸무게/골격근량/체지방률 입력 폼 + 지표별 꺾은선 그래프(SVG 직접 구현, 라이브러리 없음)

---

## 3. 음악 탭 상세

### 3.1 서비스 연결
- Spotify, Apple Music, YouTube 각각 "연결하기" 버튼 → 연결되면 "연결 완료"로 바뀌고 비활성화
- Spotify/YouTube는 OAuth 리디렉션 방식(서버가 처리), Apple Music은 MusicKit JS로 브라우저에서 직접 인증

### 3.2 운동 추천
- BPM 프리셋 버튼 3개: 웜업(90~110), 중강도(110~130), 고강도(130+)
- 클릭 시 모든 플레이리스트를 통틀어 해당 BPM 범위에 태그된 곡만 필터링해서 보여줌

### 3.3 플레이리스트
- 목록에서 만들기(이름 + 운동 태그 선택: 웜업/중강도/고강도/없음), 삭제
- 클릭하면 상세 패널 열림: 곡 목록 + 검색 폼(제공사 선택: YouTube 검색 / 내 유튜브 좋아요 / Spotify)
- 검색 결과에서 "+"로 추가 → Spotify는 추가 시 Audio Features API로 BPM 자동 조회해서 저장
- 각 곡: 제목(자동 정리됨) / 아티스트·BPM / 볼륨 슬라이더(0~100, 재생 시 자동 적용) / 재생 버튼(항상 맨 오른쪽) / 삭제 버튼

### 3.4 재생
- 하단 고정 재생바(현재 곡 제목/아티스트, 재생/일시정지 토글)
- YouTube: IFrame Player API, 숨겨진 플레이어 마운트
- Spotify: Web Playback SDK, 브라우저를 하나의 재생 기기로 등록 후 재생(Premium 필요)
- Apple: MusicKit JS로 카탈로그 트랙 재생(Apple Music 구독 필요)
- **자동 이어재생**: 플레이리스트 안에서 재생 시작한 곡이 끝나면 같은 플레이리스트의 다음 곡 자동 재생 (YouTube `onStateChange` ENDED, Spotify `player_state_changed` 정지+position 0 감지, Apple `mediaPlaybackDidEnd` 이벤트로 각각 구현)

### 3.5 필터링/정리 로직
- **쇼츠 제외**: 유튜브 검색·좋아요 목록 둘 다 영상 길이(ISO 8601 duration → 초 변환) 60초 이하면 결과에서 제외
- **제목 정리**(`cleanTitle()`): 이모지 제거, 〔official/mv/lyrics/audio/hd/4k/가사/뮤직비디오/자막〕류 괄호 태그 제거, `|` 이후 텍스트 제거, 중복 공백 정리

### 3.6 한계
- 오프라인 재생 불가(3개 플랫폼 전부 정책상 금지)
- 유튜브 광고는 코드로 제거 불가 — 브라우저 자체가 유튜브 프리미엄 계정으로 로그인돼 있어야 무광고로 재생됨

---

## 4. 데이터 저장 위치

### 4.1 브라우저 localStorage (1차 저장소, 오프라인 폴백)

| 키 | 내용 |
|---|---|
| `gmymateProfile` | 키/나이/몸무게/목표몸무게/경력/목표/주간계획/username |
| `gmymateSettings` | weightStepKg, restSeconds, largeTouch, easyWords, workoutAlert, beginnerMode |
| `gmymateHabits` | 습관별 체크 상태(protein/water/stretch) |
| `gmymateWorkoutLogsV2` | 오늘 진행 중인 운동 세트 기록 |
| `gmymateWorkoutLogs` | (구버전, 첫 로드 시 V2로 자동 마이그레이션) |
| `gmymateWorkoutHistory` | 완료한 운동 세션 히스토리 |
| `gmymateWorkoutNote` | 오늘 메모 |
| `gmymateRecentExercises` | 최근 추가한 운동 id 목록(기본값: squat, lat-pulldown, chest-press) |
| `gmymateInBodyLogs` | 날짜별 몸무게/골격근량/체지방률 배열 |

### 4.2 서버 MySQL (계정별, 로그인 필요)

**로그인/음악 외에 위 4.1의 모든 키도 이미 서버에 동기화됩니다** (`api/sync.php` + `user_data` 테이블, 계정당 JSON 블롭 하나로 저장, `src/core/sync.js`가 로그인 시 `pullSync()`로 내려받고 `gmymate:data-changed` 이벤트마다 디바운스 후 업로드). 기기 간 동기화는 이미 완료된 기능이며 더 이상 미해결 항목이 아님 — 12번 섹션 참고.

---

## 5. 온보딩 입력 규칙 (`onboardingRules`, src/core/data.js)

| 필드 | 라벨 | 범위 |
|---|---|---|
| height | 키 | 100~230 |
| age | 나이 | 10~100 |
| weight | 몸무게 | 30~250 |
| targetWeight | 목표 몸무게 | 30~250 |
| experience | 헬스 경력 | 선택형(처음시작/6개월이하/2년이하/2년이상) |
| goal | 목표 | 선택형(체지방감량/근육증가/근력향상/운동습관만들기) |
| weeklyWorkout | 주 운동 횟수 | 선택형(2/3/4/5회+) |

## 6. 운동 목록 전체 (`exerciseCatalog`, 25종)

| id | 이름 | 부위 | 기본무게(kg) | 기본횟수 | 세트 |
|---|---|---|---|---|---|
| seated-row | 시티드 로우 | 등 | 40 | 10 | 3 |
| lat-pulldown | 렛풀다운 | 등 | 40 | 10 | 3 |
| wide-pulldown | 와이드풀다운 | 등 | 35 | 10 | 3 |
| seated-multi-high-row | 시티드 멀티 하이로우 | 등 | 35 | 10 | 3 |
| squat | 스쿼트 | 하체 | 40 | 8 | 4 |
| hack-squat | 핵스쿼트 | 하체 | 60 | 10 | 3 |
| leg-press | 레그프레스 | 하체 | 100 | 10 | 3 |
| seated-leg-press | 시티드 레그프레스 | 하체 | 80 | 10 | 3 |
| cycle | 사이클 | 유산소 | 0 | 20(분) | 1 |
| overhead-extension | 오버헤드 익스텐션 | 팔 | 15 | 12 | 3 |
| arm-curl | 암컬 | 팔 | 10 | 12 | 3 |
| shoulder-press | 숄더프레스 | 어깨 | 20 | 8 | 3 |
| dumbbell-front-raise | 덤벨 프론트 레이즈 | 어깨 | 5 | 12 | 3 |
| t-bar-row | 타바로우 | 등 | 30 | 10 | 3 |
| chest-press | 체스트프레스 | 가슴 | 30 | 10 | 3 |
| incline-chest-press | 인클라인 체스트프레스 | 가슴 | 25 | 10 | 3 |
| sasre | 사스레 | 기타 | 10 | 12 | 3 |
| pull-up | 풀업 | 등 | 0(맨몸) | 8 | 3 |
| pec-deck-fly | 펙덱플라이 | 가슴 | 25 | 12 | 3 |
| reverse-pec-deck-fly | 리버스 펙덱플라이 | 어깨 | 20 | 12 | 3 |
| hip-extension | 힙 익스텐션 | 하체 | 15 | 12 | 3 |
| incline-rotation | 인클라인 로테이션 | 코어 | 10 | 15 | 3 |
| row-row | 로우로우 | 등 | 30 | 10 | 3 |
| kneeling-crunch | 닐링 크런치 | 코어 | 0(맨몸) | 15 | 3 |
| high-row | 하이로우 | 등 | 35 | 10 | 3 |
| fly | 플라이 | 가슴 | 15 | 12 | 3 |

`cycle`은 횟수 단위가 "분"(분당 아님, 총 분), `plank` 같은 "초" 단위 운동은 현재 목록에 없음(과거 있었으나 제거됨).

---

## 7. 프론트엔드 JS 파일별 함수 목록

### `src/app.js`
진입점. `setupOnboarding()`, `setupLogin()`, `setupTapEffects()`는 항상 실행. `.main-screen`이 있으면(main.html) `requireAuth()` 통과 후 `setupMain()`, `setupWorkoutLog()`, `setupInBody()`, `setupMusic()` 순서로 실행.

### `src/core/auth.js`
- `requireAuth()` — `GET /api/me.php` 호출, 실패 시 `index.html`로 이동, 성공 시 유저 정보 반환
- `logout()` — `POST /api/logout.php` 호출 후 `index.html`로 이동

### `src/core/storage.js`
- `readJson(key, fallback)` / `writeJson(key, value)` — localStorage 읽기/쓰기(raw===null일 때만 fallback, falsy 값 보존)
- `getProfile()` — `gmymateProfile` 단축 조회
- `getDateKey(date)` — `YYYY-MM-DD` 문자열 변환
- `getWorkoutStats(workouts)` — 완료세트/전체세트/볼륨 합계 계산
- `setText(id, value)` — 엘리먼트 textContent 설정
- `showToast(message)` — 토스트 팝업(1.8초)
- `escapeHtml(value)` — XSS 방지용 HTML 이스케이프

### `src/core/data.js`
`profileLabels`, `weeklyLabels`, `onboardingRules`, `exerciseCatalog` 상수만 export(함수 없음)

### `src/core/music-player.js`
- `onTrackEnded(callback)` — 곡 종료 콜백 등록(자동 이어재생용)
- `playYouTube(videoId, mountId)` / `toggleYouTube()`
- `playSpotify(uri)` / `toggleSpotify()` (내부: `fetchSpotifyAccessToken()`)
- `connectAppleMusic()` / `playAppleMusic(trackId)` / `toggleAppleMusic()`
- `setProviderVolume(provider, percent)` — 0~100 값을 각 SDK의 볼륨 스케일로 변환해 적용

### `src/features/login.js`
- `setupLogin()` — 로그인 폼 submit 처리, `POST /api/login.php` 호출

### `src/features/onboarding.js`
- `setupOnboarding()` — 마법사 단계 진행, 유효성 검사, `POST /api/signup.php` 호출 후 프로필 localStorage 저장

### `src/features/main.js` (가장 큰 파일, 함수 19개)
`setupMain()`이 `setupProfile()`, `setupNavigation()`, `setupHabits()`, `setupSettings()`, `renderAppStats()`를 호출. 그 외 설정 저장(`getSettings`/`saveSettings`/`applySettings`/`bindSettingToggle`), 데이터 내보내기/가져오기(`exportData`/`importData`), 통계 계산(`getCompletedDateKeys`/`getStreak`/`getMonthCount`), 렌더링(`renderWeekStrip`/`renderMonthGrid`/`renderHistory`), 포맷팅(`formatHistoryDate`/`formatNumber`)

### `src/features/workout-log.js`
`setupWorkoutLog()` 하나가 세트 추가/삭제/수정, 운동 선택 시트, 휴식 타이머, 완료 처리를 전부 담당(클로저 내부 함수들)

### `src/features/inbody.js`
- `setupInBody()` — 폼 제출 처리, localStorage 저장/조회
- `renderMetricChart(logs, metric)` — 지표 하나당 SVG 꺾은선 그래프 생성

### `src/features/music.js` (음악 탭 전체 로직)
- `cleanTitle(title)` — 곡 제목 정리 정규식 함수
- `setupMusic()` — 나머지 전부(플레이리스트 CRUD, 검색, 추천, 재생 연결, 연결 상태 표시, 자동 이어재생 큐 관리)

### `src/features/tap-effects.js`
- `setupTapEffects()` — 버튼 탭 시 리플 효과(reduced-motion 존중)

---

## 8. 백엔드 API 전체 스펙

공통: 모든 엔드포인트는 `require __DIR__.'/session.php'` 후 `startAppSession()` 호출, 로그인 필요한 곳은 `requireUserId()`(음악 API) 또는 세션 직접 체크. **응답은 항상 HTTP 200, 본문이 `{ ok: boolean, status: number, ...데이터 또는 error }`** (닷홈 Apache가 4xx/5xx 본문을 자체 에러 페이지로 바꿔치기하는 문제 우회용).

### 인증 (`api/`)
| 엔드포인트 | 메서드 | 요청 | 응답 |
|---|---|---|---|
| `signup.php` | POST | `{username, password}` | 성공 시 `{username}`, 세션 생성 |
| `login.php` | POST | `{username, password, remember}` | 성공 시 `{username}`, remember=true면 30일 쿠키 |
| `logout.php` | POST | - | `{}`, 세션+remember 쿠키 파기 |
| `me.php` | GET | - | 로그인 상태면 `{username}`, 아니면 ok:false |

### 음악 (`api/music/`)
| 엔드포인트 | 메서드 | 요청 | 응답 |
|---|---|---|---|
| `connections.php` | GET | - | `{providers: ["spotify","youtube",...]}` |
| `spotify-connect.php` | GET | - | Spotify OAuth 페이지로 리디렉션 |
| `spotify-callback.php` | GET | `?code, state` | 토큰 저장 후 `main.html?spotify=connected` 리디렉션 |
| `spotify-token.php` | GET | - | `{accessToken}` (만료 임박 시 자동 갱신) |
| `spotify-search.php` | GET | `?q=검색어` | `{items: [{id, title, artist, uri}]}` (limit=10, 개발자 앱 제한) |
| `spotify-audio-features.php` | GET | `?id=트랙ID` | `{bpm, energy}` |
| `google-connect.php` | GET | - | Google OAuth 페이지로 리디렉션(`youtube.readonly` 스코프) |
| `google-callback.php` | GET | `?code, state` | 토큰 저장 후 `main.html?youtube=connected` 리디렉션 |
| `youtube-search.php` | GET | `?q=검색어` | `{items: [{videoId, title, channel, thumbnail}]}` (쇼츠 60초 이하 제외) |
| `youtube-liked-videos.php` | GET | - | `{items: [{videoId, title, channel}]}` (쇼츠 제외) |
| `apple-developer-token.php` | GET | - | `{developerToken}` (ES256 JWT, openssl로 직접 서명) |
| `playlists.php` | GET/POST/DELETE | GET: - / POST: `{name, workoutTag}` / DELETE: `{id}` | GET: `{playlists: [{id,name,workout_tag,created_at,tracks:[...]}]}` |
| `playlist-tracks.php` | POST/PATCH/DELETE | POST: `{playlistId,provider,trackRef,title,artist,bpm}` / PATCH: `{id,volume}` / DELETE: `{id}` | `{id}` 또는 `{}` |

---

## 9. 데이터베이스 스키마 상세 (`api/schema.sql`, MySQL/InnoDB)

### `users`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT | AUTO_INCREMENT PK |
| username | VARCHAR(20) | UNIQUE |
| password_hash | VARCHAR(255) | `password_hash()` 결과 |
| created_at | DATETIME | |

### `music_connections`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id, ON DELETE CASCADE |
| provider | ENUM('spotify','apple','youtube') | UNIQUE(user_id, provider) |
| access_token / refresh_token | TEXT | NULL 허용 |
| expires_at | DATETIME | NULL 허용 |
| created_at | DATETIME | |

### `playlists`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT | PK |
| user_id | BIGINT | FK → users.id |
| name | VARCHAR(80) | |
| workout_tag | VARCHAR(20) | NULL 허용(웜업/중강도/고강도) |
| created_at | DATETIME | |

### `playlist_tracks`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | BIGINT | PK |
| playlist_id | BIGINT | FK → playlists.id, ON DELETE CASCADE |
| provider | ENUM('spotify','apple','youtube') | |
| track_ref | VARCHAR(120) | 곡 고유 식별자(URI/videoId) |
| title / artist | VARCHAR(200) | artist NULL 허용 |
| bpm | SMALLINT UNSIGNED | NULL 허용 |
| genre | VARCHAR(60) | NULL 허용(현재 미사용) |
| position | SMALLINT UNSIGNED | 재생 순서 |
| volume | TINYINT UNSIGNED | 기본값 100 |

---

## 10. CSS 디자인 토큰 (`src/styles/base.css`)

```css
--app-bg: #f6fbf7;            /* 배경 */
--app-surface: #ffffff;       /* 카드 배경 */
--app-mint: #e9f8ed;          /* 연한 초록(뱃지/버튼 배경) */
--app-mint-strong: #d6f2de;
--app-green: #19a957;         /* 포인트 초록 */
--app-green-dark: #06723a;    /* 진한 초록(제목/텍스트) */
--app-text: #17351f;          /* 본문 텍스트 */
--app-muted: #65806d;         /* 보조 텍스트 */
--app-line: #d6eadb;          /* 테두리 */
--app-danger: #c94c43;        /* 위험/삭제 */
--app-shadow: 0 18px 46px rgba(28,112,61,.11);      /* 진한 그림자(재생바 등) */
--app-soft-shadow: 0 10px 28px rgba(28,112,61,.07); /* 기본 카드 그림자 */
```
표준 카드 모서리: `18px`(대부분), 큰 카드(루틴/운동패널): `24px`. 로그인 카드(28px)와 음악 탭 일부 카드(16px)는 아직 이 규칙에 안 맞음(미해결).

---

## 11. 배포 / 설정

- **배포 방법**: 파일질라 수동 업로드가 기본. `deploy/deploy.ps1`(.NET FtpWebRequest + 업로드 후 실제 HTTPS로 파일 크기 검증)도 있음. `deploy/deploy.env`에 FTP_HOST/FTP_USER/FTP_REMOTE_DIR 설정(비밀번호는 실행 시 매번 입력, 파일 저장 안 함).
- **필요한 설정 파일**(전부 `.gitignore`됨, `*.example.php` 복사해서 만들어야 함):
  - `api/config.php` — DB host/name/user/pass
  - `api/music/spotify-config.php` — client_id/client_secret/redirect_uri
  - `api/music/youtube-config.php` — api_key
  - `api/music/google-config.php` — client_id/client_secret/redirect_uri
  - `api/music/apple-config.php` — team_id/key_id/private_key (.p8 내용, 연 $99 Apple Developer Program 필요)

---

## 12. 알려진 미해결 항목 (우선순위순)

1. **"루틴" 카드가 장식용** — 눌러도 실제 운동이 오늘 기록에 추가 안 됨.
2. **디자인 토큰 불일치** — 로그인 카드(28px 모서리), 음악 탭 일부 카드(16px 모서리, 그림자 없음)가 앱 전체 표준(18px+그림자)과 안 맞음.
3. **유튜브 광고 제거 불가** — 플랫폼 구조상 코드로 해결 불가, 브라우저 자체가 유튜브 프리미엄으로 로그인돼 있어야 함.
4. **오프라인 재생 불가** — Spotify/Apple/YouTube 전부 정책상 제3자 웹앱의 오프라인 캐싱을 허용 안 함.
5. **PWA/오프라인 지원 없음** — 서비스워커/manifest 없음, 와이파이 끊기면 앱 자체가 안 뜰 수 있음.

> ~~운동 기록·설정·인바디가 서버 미동기화~~ — 완료됨. `api/sync.php` + `user_data` 테이블(계정당 JSON 블롭 1개)로 이미 동기화되고 있음. 4.2 참고.
