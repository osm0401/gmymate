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
  echo "php 미설치 — PHP 린트 건너뜀 (php 설치 후 재실행 권장)"
fi

echo "== JS syntax (src/) =="
while IFS= read -r f; do
  if ! node --check "$f"; then fail=1; echo "FAIL  $f"; fi
done < <(find "$root/src" -name '*.js')

if [ "$fail" -ne 0 ]; then echo "CHECK: FAIL"; exit 1; else echo "CHECK: PASS"; exit 0; fi
