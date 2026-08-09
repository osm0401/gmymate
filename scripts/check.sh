#!/usr/bin/env bash
# scripts/check.sh — 협업 검증 스타터 (REVIEW-1에서 Gemini가 확장)
# api/**.php 문법 린트(php -l) + src/**.js 문법 검사(node --check)
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

echo "== PHP lint (api/) =="
if command -v php >/dev/null 2>&1; then
  while IFS= read -r f; do
    if ! php -l "$f" >/dev/null 2>&1; then fail=1; echo "FAIL  $f"; php -l "$f"; fi
  done < <(find "$root/api" -name '*.php')
else
  # 도구가 없는 건 코드 결함이 아니다. 건너뛰되 눈에는 띄게 남긴다.
  echo "SKIP  php not found - skipping PHP syntax check"
fi

echo "== JS syntax (src/) =="
if command -v node >/dev/null 2>&1; then
  while IFS= read -r f; do
    if ! node --check "$f"; then fail=1; echo "FAIL  $f"; fi
  done < <(find "$root/src" -name '*.js')
else
  echo "SKIP  node not found - skipping JS syntax check"
fi

if [ "$fail" -ne 0 ]; then echo "CHECK: FAIL"; exit 1; else echo "CHECK: PASS"; exit 0; fi
