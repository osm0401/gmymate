# 리뷰 노트 (Gemini 담당)

리뷰어(Gemini)는 검토한 브랜치/변경마다 이 폴더에 노트 파일을 하나 남긴다.

- 파일명: `<브랜치명>.md` (예: `be-data-services.md`)
- 내용 형식:

```markdown
# 리뷰: <브랜치명>

- 대상: <파일/작업>
- 기준: docs/collab/decisions.md (D-x), roles.md 경계
- scripts/check.ps1 결과: PASS / FAIL (상세)

## 지적 사항
- [ ] (심각도) 파일:줄 — 문제 — 제안

## 결론
APPROVE / CHANGES_REQUESTED
```

리뷰어는 `src/`·`api/`를 **직접 수정하지 않는다.** 지적만 남기고, 담당 에이전트가 고친다.
