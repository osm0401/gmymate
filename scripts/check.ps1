# scripts/check.ps1 — 협업 검증 스타터 (REVIEW-1에서 Gemini가 확장)
# api/**.php 문법 린트(php -l) + src/**.js 문법 검사(node --check)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$fail = 0

Write-Host '== PHP lint (api/) =='
if (Get-Command php -ErrorAction SilentlyContinue) {
  Get-ChildItem -Path (Join-Path $root 'api') -Recurse -Filter *.php | ForEach-Object {
    $out = & php -l $_.FullName 2>&1
    if ($LASTEXITCODE -ne 0) { $script:fail = 1; Write-Host "FAIL  $($_.FullName)"; Write-Host $out }
  }
} else {
  Write-Host 'php 미설치 — PHP 린트 건너뜀 (php 설치 후 재실행 권장)'
}

Write-Host '== JS syntax (src/) =='
Get-ChildItem -Path (Join-Path $root 'src') -Recurse -Filter *.js | ForEach-Object {
  & node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { $script:fail = 1; Write-Host "FAIL  $($_.FullName)" }
}

if ($fail -ne 0) { Write-Host 'CHECK: FAIL'; exit 1 } else { Write-Host 'CHECK: PASS'; exit 0 }
