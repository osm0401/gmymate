# 운동 가이드에 폼 확인 이미지·GIF 추가

## 목표

- 단일 PR `fe/exercise-guide-media`에서 기존 운동 가이드 상세 다이얼로그에 폼 확인 미디어를 추가한다.
- 26개 운동 모두 정지 WebP 이미지를 제공하고, 대표 동작 `squat`, `chest-press`, `lat-pulldown`에는 5초 이하 animated WebP도 제공한다.
- “GIF”는 짧은 동작 애니메이션 요구로 해석한다. 실제 `.gif`는 용량과 모션 제어 문제로 사용하지 않는다.
- 기존 동작 순서·주의 문구를 유지하며 `api/**`, DB, 동기화 구조는 변경하지 않는다.
- 목록 썸네일, 사용자 업로드, AI 자세 분석, 카메라 인식, CMS, 외부 CDN, 전체 26개 애니메이션은 범위에서 제외한다.
- 구현은 `[FE]`, 테스트는 `[REVIEW]`가 담당한다. 현재 소유권이 정의되지 않은 `assets/**`는 착수 전 기획 담당자가 FE 작업 범위로 명시한다.

## 리서치 근거 (검색으로 확인한 사실 + 왜 이 방식을 택했는지)

- 저장소에는 26개 운동과 텍스트 가이드, 검색, 네이티브 `<dialog>`가 이미 구현돼 있다. 상세 내용은 사용자가 운동을 선택할 때만 생성되므로 별도 미디어 컴포넌트나 lazy-load 라이브러리가 필요 없다. 기존 97개 테스트도 통과한다.
- Fitbod는 운동 상세 상단에 사용자가 재생하는 영상과 글 설명을 함께 제공하며, 최근 GIF를 제거했다고 명시한다. Hevy와 Strong도 운동별 상세 화면에서 이미지·애니메이션과 단계별 설명을 함께 제공한다. 따라서 새 화면이 아니라 기존 상세 다이얼로그 상단에 미디어를 배치한다. [Fitbod](https://help.fitbod.me/hc/en-us/articles/30721437384215-How-to-Navigate-the-Exercise-Details-Screen), [Hevy](https://help.hevyapp.com/hc/en-us/articles/35688251991575-Hevy-Exercise-Library-400-Exercises-and-Custom-Exercises), [Strong](https://help.strongapp.io/article/237-about-exercise-detail)
- MDN은 WebP를 정지·애니메이션 이미지 모두에 적합한 형식으로 안내한다. `<picture>`와 `media` 조건을 사용하면 모션 감소 환경에서 정지 이미지를 선택할 수 있다. 원본 GIF 대신 animated WebP와 정지 대체본을 사용한다. [MDN 이미지 형식](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types), [MDN picture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture)
- 명시적인 `width`·`height`는 레이아웃 이동을 줄이며 `decoding="async"`는 디코딩이 다른 콘텐츠 표시를 막지 않도록 힌트를 준다. 미디어가 다이얼로그를 열 때 삽입되므로 `loading="lazy"`나 `IntersectionObserver`는 추가하지 않는다. [MDN img](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img)
- 자동 시작 모션이 5초를 넘으면 일시정지·정지 수단이 필요하다. 애니메이션을 5초 이하의 유한 재생으로 제한하고 `prefers-reduced-motion: reduce`에서는 정지 이미지만 표시한다. [W3C Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide), [W3C reduced motion](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)
- 정보성 폼 이미지는 핵심 정보를 전달하는 대체 텍스트가 필요하다. 기존 동작 순서·주의 문구도 시각 자료의 텍스트 대체 수단으로 유지한다. [W3C Images Tutorial](https://www.w3.org/WAI/tutorials/images/)
- 런타임 의존성은 없다. 설치된 `@playwright/test` 1.62.1은 2026-08-19 기준 최신 안정 버전이며, `<1.55.1`에 영향을 준 CVE-2025-59288의 패치 범위에 포함된다. 패키지 추가·업데이트는 하지 않는다. [Playwright 1.62.1](https://github.com/microsoft/playwright/releases/tag/v1.62.1), [보안 권고](https://github.com/advisories/GHSA-7mvr-c777-76hp)
- 선택한 `<picture>`, `<source media>`, `<img>`, `decoding`, `prefers-reduced-motion`에는 관련 deprecated API가 확인되지 않았다. GIF 자체는 deprecated가 아니지만 성능·접근성 때문에 채택하지 않는다.

## 세부 작업 체크리스트

- [ ] 기획 담당자가 `docs/collab/backlog.md`에 `[FE]` 작업을 등록하고 `assets/**` 쓰기 담당을 명시한다.
- [ ] `fe/exercise-guide-media` 브랜치를 만들고 다른 기능을 포함하지 않는다.
- [ ] `[REVIEW]` 담당자가 구현 전에 실패하는 테스트를 작성한다.
  - `tests/exercise-guides.test.mjs`: 26개 가이드의 미디어 계약, 파일 존재, 로컬 경로, 용량, 중첩 불변성을 검증한다.
  - `tests/e2e/portfolio-flow.spec.mjs`: 표시, 반응형 레이아웃, 모션 감소, 요청 지연, 오프라인 재열기를 검증한다.
- [ ] `assets/exercise-guides/`에 다음 자산을 추가한다.
  - 26개: `<exercise-id>-still.webp`
  - 3개: `squat-motion.webp`, `chest-press-motion.webp`, `lat-pulldown-motion.webp`
  - 정지 이미지: 720×900, 파일당 150KB 이하
  - 애니메이션: 같은 비율, 파일당 1MB 이하, 전체 5초 이하, 최대 2회 재생 후 정지
  - 전체 미디어 합계: 7MB 이하
  - 번쩍임, 빠른 화면 전환, 텍스트 삽입, 워터마크 금지
- [ ] `assets/exercise-guides/SOURCES.md`에 운동 ID, 출처, 재배포 라이선스, 촬영·제작 주체, 폼 검수자와 검수일을 기록한다. 경쟁사 미디어 복사와 외부 hotlink는 금지한다.
- [ ] `sasre`, `row-row` 및 특정 머신 운동은 자산 제작 전에 정확한 동작·기구 변형을 트레이너와 확인한다.
- [ ] `src/core/exercise-guides.js`의 기존 객체에만 다음 미디어 계약을 추가한다.
  - `stillSrc`, 선택적 `motionSrc`, `alt`, `caption`, `width`, `height`
  - 모든 경로는 `./assets/exercise-guides/` 아래 상대 경로만 허용한다.
  - 기존 패턴대로 `media` 객체까지 `Object.freeze()`한다.
  - 별도 레지스트리·클래스·팩토리는 만들지 않는다.
- [ ] `src/features/exercise-guides.js`에서 기존 상세 다이얼로그의 “동작 순서” 위에 미디어를 조건부 렌더링한다.
  - 애니메이션 운동은 `<picture>`의 첫 `<source media="(prefers-reduced-motion: reduce)">`로 정지 이미지를 제공한다.
  - `<img>`에 `alt`, `width`, `height`, `decoding="async"`를 지정한다.
  - 경로·대체 텍스트·캡션은 기존 `escapeHtml()`을 재사용한다.
  - 미디어 로드 실패 시에도 동작 순서와 주의 문구는 그대로 표시한다.
- [ ] `src/styles/portfolio.css`에 미디어·캡션 스타일만 추가한다.
  - 다이얼로그 폭 이내 `width: 100%`
  - `object-fit: contain`으로 관절이나 기구가 잘리지 않게 처리
  - 320px 화면에서도 가로 스크롤이 생기지 않게 한다.
- [ ] `scripts/static-server.mjs`에 `.webp: image/webp` MIME만 추가한다.
- [ ] 미디어는 `service-worker.js`의 `APP_SHELL`에 선캐시하지 않는다. 기존 동일 출처 런타임 캐시를 재사용한다.
- [ ] `main.html`, `src/app.js`, `package.json`, `api/**`는 변경하지 않는다.
- [ ] 다음 검증을 실행하고 결과를 PR에 기록한다.

```powershell
npm test
npm run test:e2e
node --test --experimental-test-coverage --test-isolation=none tests/*.test.mjs
powershell -ExecutionPolicy Bypass -File scripts/check.ps1
npm audit
```

- [ ] 변경 JS의 lines·branches·functions 커버리지를 각각 80% 이상 유지한다.
- [ ] 완료 후 backlog 상태를 `REVIEW`로 변경하고 `handoffs.md`를 통해 Gemini 검토로 넘긴다.

## 수용 기준 (Acceptance Criteria) — 검증 가능한 형태로

1. 운동 카탈로그 26개와 정지 이미지 26개가 ID 기준으로 정확히 일치하며 누락·중복·404가 없다.
2. 스쿼트·체스트프레스·렛풀다운은 기본 환경에서 animated WebP를, `reducedMotion: "reduce"` 환경에서는 정지 WebP를 표시한다.
3. 나머지 23개 운동은 정지 이미지만 요청하며 빈 미디어 영역이 생기지 않는다.
4. 루틴 탭이나 가이드 목록을 열기만 해서는 운동 미디어 요청이 발생하지 않고, 상세 다이얼로그를 연 운동의 자산만 요청된다.
5. 모든 이미지의 `naturalWidth`와 `naturalHeight`가 0보다 크고 HTML `width="720"`, `height="900"`이 지정된다.
6. 모든 이미지에 운동명과 확인할 자세를 설명하는 비어 있지 않은 `alt`가 있으며, 동작 순서와 주의 문구도 계속 노출된다.
7. 애니메이션은 5초 이내에 끝나고 무한 반복·번쩍임·빠른 컷이 없다.
8. 320px, 390px, 768px 뷰포트에서 이미지와 캡션이 다이얼로그 밖으로 넘치지 않고 닫기 버튼 및 본문 스크롤을 사용할 수 있다.
9. 미디어 요청을 실패시켜도 다이얼로그가 열리고 텍스트 가이드와 닫기 동작이 정상이며 uncaught error가 없다.
10. 온라인에서 한 번 본 미디어는 오프라인 재열기 시 기존 런타임 캐시에서 표시된다. 처음 보는 미디어가 오프라인에서 실패해도 텍스트 가이드는 정상 동작한다.
11. 미디어 경로에는 `http:`, `https:`, `data:`, `javascript:`, `..`가 포함되지 않는다.
12. 정지 이미지당 150KB, 애니메이션당 1MB, 전체 7MB의 예산을 테스트가 강제한다.
13. 새 npm 의존성이 없고 `api/**`, DB 스키마, 동기화 데이터 계약에 diff가 없다.
14. 자산별 사용 권한과 폼 검수 기록이 존재하며, 검수되지 않은 운동은 병합하지 않는다.
15. 전체 테스트, E2E, 프로젝트 검사와 `npm audit`가 모두 통과하고 변경 JS 커버리지가 80% 이상이다.

## 예상 리스크

- 잘못된 자세 이미지는 부상 위험을 높일 수 있다. 특히 `sasre`, `row-row`, 머신 변형은 명칭만 보고 자산을 연결하지 않는다.
- 미디어 라이선스나 초상권이 불명확하면 배포할 수 없다. AI 생성 자산도 트레이너의 실제 폼 검수 없이는 사용하지 않는다.
- animated WebP의 무한 반복이나 과도한 움직임은 접근성 문제를 만든다. 유한 재생과 정지 대체본을 병합 조건으로 둔다.
- 바이너리 자산은 일반 코드 diff로 정확성을 검토하기 어렵다. PR에 운동 ID별 미리보기와 검수 결과를 포함한다.
- 전체 미디어를 선캐시하면 PWA 설치 실패 범위와 저장 공간 사용량이 커진다. 이번 PR은 요청된 자산만 런타임 캐시한다.
- `assets/**` 소유자가 현재 협업 규약에 명시돼 있지 않다. 기획 담당자의 명시적 배정 전에는 구현을 시작하지 않는다.

## 참고 링크

- [Fitbod — Exercise Details Screen](https://help.fitbod.me/hc/en-us/articles/30721437384215-How-to-Navigate-the-Exercise-Details-Screen)
- [Hevy — Exercise Library](https://help.hevyapp.com/hc/en-us/articles/35688251991575-Hevy-Exercise-Library-400-Exercises-and-Custom-Exercises)
- [Strong — Exercise Detail Screen](https://help.strongapp.io/article/237-about-exercise-detail)
- [MDN — Image file type and format guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types)
- [MDN — `<picture>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture)
- [MDN — `<img>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img)
- [W3C WAI — Images Tutorial](https://www.w3.org/WAI/tutorials/images/)
- [W3C WCAG — Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
- [W3C WCAG — `prefers-reduced-motion`](https://www.w3.org/WAI/WCAG22/Techniques/css/C39)
- [Playwright 1.62.1](https://github.com/microsoft/playwright/releases/tag/v1.62.1)
- [GitHub Advisory — CVE-2025-59288](https://github.com/advisories/GHSA-7mvr-c777-76hp)
- [OWASP — File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
