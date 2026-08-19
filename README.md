# GAINMUSCLE

헬스장에서 휴대전화로 빠르게 운동을 기록하고, 회복 상태와 성장 추이를 확인하는 모바일 우선 웹앱입니다. 저장소 폴더명은 이전 이름인 `gmymate`를 유지합니다.

## 주요 기능

- 회원가입, 로그인 유지, 로그아웃, 비밀번호 확인 후 계정 삭제
- 키·나이·몸무게·목표·운동 경력 온보딩
- 26개 운동 검색·다중 추가, 순서 변경, 같은 부위 운동으로 대체
- 이전 운동값 자동 불러오기, 세트별 무게·횟수·드롭세트·슈퍼세트 기록
- 사용자 설정 `k` 기반 무게 증감, 횟수 증감, 세트 추가·삭제
- 세트 완료 시 자동 휴식 타이머, 진동·소리 알림, 화면 꺼짐 방지
- 사용자 루틴 생성·삭제·불러오기와 루틴별 기본 세트 구성
- 수면·에너지·근육 뻐근함 기반 오늘의 회복 점수
- 최근 7일 운동량, 연속 운동일, 종목별 성장 분석
- 달력, 개인 기록(PR), 뱃지, 인바디 추이, 운동 알림
- 모든 운동의 동작 순서·주의점 가이드
- Gemini AI 코치: 운동·영양·회복·일반 질문, 답변 중지
- Spotify·Apple Music·YouTube 플레이리스트와 BPM 추천
- PWA 설치 및 오프라인 기록, 다크 모드, 큰 버튼 모드
- 서버가 없어도 바로 확인 가능한 샘플 데이터 체험

## 기술 구성

- 프런트엔드: HTML, CSS, 바닐라 JavaScript ES Modules
- 백엔드: PHP 8, PDO, MySQL 8
- 저장: localStorage 우선 저장 + `api/sync.php` 계정별 JSON 동기화
- AI: 서버 전용 Gemini API 키 + Interactions API
- 검증: Node test runner + Playwright 모바일 Chromium

브라우저는 민감한 DB/API 키를 직접 알지 못합니다. 모든 DB와 Gemini 요청은 PHP API를 거칩니다.

## 빠른 실행

```powershell
npm install
node scripts/static-server.mjs
```

`http://127.0.0.1:4173`에서 **샘플 데이터로 체험하기**를 누르면 PHP나 DB 없이 주요 화면을 확인할 수 있습니다. 실제 로그인·동기화·AI는 PHP가 실행되는 호스팅이 필요합니다.

## 서버 설정

1. `api/config.example.php`를 `api/config.php`로 복사합니다.
2. 서버의 DB 접속 정보를 `api/config.php`에 입력합니다.
3. phpMyAdmin에서 `api/schema.sql`을 실행합니다.
4. 사이트를 HTTPS로 엽니다.

실제 서버의 기존 `users.id`가 `BIGINT`이므로 새 외래키도 같은 타입을 사용합니다. `schema.sql`은 기존 `users` 테이블을 유지하면서 `user_data`와 음악 테이블을 추가할 수 있습니다.

## Gemini 설정

1. `api/config/gemini.example.php`를 `api/config/gemini.php`로 복사합니다.
2. `your_gemini_api_key`를 Google AI Studio에서 만든 키로 교체합니다.
3. 키가 브라우저 JS, Git, 스크린샷에 들어가지 않았는지 확인합니다.

AI는 로그인 사용자만 호출할 수 있고, 요청 길이와 분당 횟수가 제한됩니다. 진단을 대신하지 않지만 운동 외 일반 대화와 간단한 계산은 막지 않습니다.

음악 연동은 `api/music/*-config.example.php`를 참고합니다. Apple Music은 Apple Developer Program이 필요하며, 외부 음악 서비스의 오프라인 음원 저장은 지원하지 않습니다.

## 배포

```powershell
Copy-Item deploy/deploy.env.example deploy/deploy.env
powershell -ExecutionPolicy Bypass -File deploy/deploy.ps1 -DryRun -NoPause
powershell -ExecutionPolicy Bypass -File deploy/deploy.ps1
```

FTP 비밀번호는 파일이나 명령 인수에 넣지 않고 실행 시 보안 입력창에 입력합니다. 실제 비밀번호나 API 키를 채팅·코드에 노출했다면 해당 서비스에서 먼저 교체하세요.

## 테스트

```powershell
npm test
npm run test:e2e
powershell -ExecutionPolicy Bypass -File scripts/check.ps1
```

- 단위·계약 테스트: 분석, 회복, 루틴, 운동 가이드, PWA, API 보안 계약
- E2E: 샘플 로그인, 분석, 운동 가이드, AI 창, 계정 삭제, 회복 저장, 운동 대체, 오프라인 재실행
- 로컬에 PHP CLI가 없으면 `scripts/check.ps1`의 PHP 문법 검사는 건너뜁니다.

## 알려진 한계

- 운동 알림은 앱이 열려 있을 때 확인하는 로컬 알림이며 서버 푸시는 아닙니다.
- 동기화는 계정당 JSON 전체를 마지막 저장값으로 교체합니다. 동시에 여러 기기에서 편집하면 마지막 저장이 우선합니다.
- AI·로그인·서버 동기화는 오프라인에서 사용할 수 없지만 기존 기기 기록은 계속 작성할 수 있습니다.
