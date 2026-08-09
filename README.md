# gmymate

헬스장에서 휴대전화로 빠르게 운동을 기록할 수 있도록 만든 초록·하양 테마의 모바일 웹앱입니다.

## 주요 기능

- 키, 나이, 몸무게, 목표 몸무게, 운동 경력 온보딩
- 최근 운동과 검색을 지원하는 운동 추가 목록
- 세트별 무게·횟수 기록과 빠른 증감 버튼
- 사용자 설정값 `k`를 이용한 무게 조절
- 세트 완료와 자동 휴식 타이머
- 오늘 운동량, 완료 세트, 연속 운동일 요약
- 운동 달력과 최근 운동 기록
- 큰 버튼 모드와 간단한 사용성 설정
- 브라우저에 운동 기록 자동 저장
- 인바디 기록과 몸무게/골격근량/체지방률 추이 그래프
- 음악 탭: Spotify/Apple Music/YouTube 계정별 연동, 플레이리스트 관리, BPM 기반 운동 추천 (오프라인 재생은 지원하지 않습니다 — 각 서비스 정책상 온라인 스트리밍만 가능)

## 실행 방법

별도의 설치나 빌드 없이 `index.html`을 열면 됩니다. 로컬 웹 서버나 일반 정적 웹호스팅에서도 실행할 수 있습니다.

## 호스팅 업로드

FTP의 `public_html` 안에 `index.html`, `main.html`, `onboarding.html`, `src`, `api` 폴더를 업로드합니다. 배포용 파일은 프로젝트 바깥의 `gmymate-upload` 폴더에도 정리되어 있습니다.

### 로그인 서버 설정 (최초 1회)

1. `api/config.example.php`를 `api/config.php`로 복사하고 dothome MySQL 접속정보(호스트/DB명/계정/비번)를 채웁니다. `config.php`는 깃에 커밋되지 않습니다.
2. dothome phpMyAdmin에서 `api/schema.sql`을 실행해 `users`, `music_connections`, `playlists`, `playlist_tracks` 테이블을 만듭니다.
3. `api/*.php` 파일을 서버에 업로드합니다.

### 음악 연동 설정 (선택, 안 하면 음악 탭의 연결 버튼이 에러만 보여줍니다)

**Spotify** — 실제 BPM 자동 태깅까지 되는 유일한 옵션. 듣는 사람은 Spotify Premium 계정이 있어야 앱 안에서 전곡 재생이 됩니다(무료 계정은 30초 미리듣기만).
1. https://developer.spotify.com/dashboard 에서 앱을 하나 만듭니다 (무료).
2. Redirect URI에 `https://내도메인/api/music/spotify-callback.php`를 정확히 등록합니다.
3. `api/music/spotify-config.example.php`를 `spotify-config.php`로 복사하고 Client ID/Secret/Redirect URI를 채웁니다.

**YouTube** — 무료, 듣는 사람 쪽 구독/로그인 필요 없음. BPM 자동 태깅은 안 되고 직접 태그해야 합니다.
1. https://console.cloud.google.com/apis/credentials 에서 프로젝트를 만들고 "YouTube Data API v3"를 사용 설정합니다.
2. API 키를 발급받아 `api/music/youtube-config.example.php`를 복사한 `youtube-config.php`에 채웁니다.

**Apple Music** — 운영자가 **Apple Developer Program(연 $99)**을 결제해야 합니다. 듣는 사람도 Apple Music 구독이 있어야 재생됩니다.
1. Apple Developer 계정에서 MusicKit 식별자를 만들고 개인 키(.p8)를 발급받습니다.
2. `api/music/apple-config.example.php`를 복사한 `apple-config.php`에 Team ID/Key ID/개인 키 내용을 채웁니다.

**YouTube 로그인** (선택) — 검색 자체는 API 키만 있으면 되지만, 사용자 본인의 "좋아요 표시한 동영상"을 가져오려면 구글 로그인이 추가로 필요합니다.
1. https://console.cloud.google.com/apis/credentials 에서 "OAuth 클라이언트 ID" 만들기 → 애플리케이션 유형 "웹 애플리케이션".
2. 승인된 리디렉션 URI에 `https://내도메인/api/music/google-callback.php`를 등록합니다.
3. `api/music/google-config.example.php`를 복사한 `google-config.php`에 Client ID/Secret을 채웁니다.

세 서비스 모두 실제 음원 파일은 저장하지 않고, 곡 제목/아티스트/BPM 같은 메타데이터만 계정별로 DB에 저장됩니다.

## 현재 저장 방식

로그인(아이디/비밀번호)과 음악 플레이리스트(메타데이터만)는 dothome MySQL DB에 계정별로 저장되고, PHP 세션으로 로그인 상태를 유지합니다. 운동 기록·설정·프로필은 아직 브라우저 로컬 저장소에만 보관됩니다 — 기기 간 동기화는 다음 단계입니다.
