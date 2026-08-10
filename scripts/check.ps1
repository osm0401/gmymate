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
  # 도구가 없는 건 코드 결함이 아니다. 건너뛰되 눈에는 띄게 남긴다.
  Write-Host 'SKIP  php not found - skipping PHP syntax check'
}

Write-Host '== JS syntax (src/) =='
if (Get-Command node -ErrorAction SilentlyContinue) {
  Get-ChildItem -Path (Join-Path $root 'src') -Recurse -Filter *.js | ForEach-Object {
    & node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { $script:fail = 1; Write-Host "FAIL  $($_.FullName)" }
  }
} else {
  Write-Host 'SKIP  node not found - skipping JS syntax check'
}

Write-Host '== Tests (tests/) =='
$tests = Join-Path $root 'tests'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'SKIP  node not found - skipping tests'
} elseif (Test-Path $tests) {
  # node --test에 디렉터리를 넘기면 그걸 테스트 파일로 로드하려다 MODULE_NOT_FOUND로 죽는다.
  # 파일을 직접 나열해서 넘긴다.
  $files = @(Get-ChildItem -Path $tests -Recurse -File |
             Where-Object { $_.Name -match '\.test\.(m|c)?js$' } |
             ForEach-Object { $_.FullName })
  if ($files.Count -eq 0) {
    Write-Host 'SKIP  no *.test.js files under tests/'
  } else {
    & node --test @files
    if ($LASTEXITCODE -ne 0) { $fail = 1; Write-Host 'FAIL  node --test' }
  }
} else {
  Write-Host 'SKIP  tests/ not found'
}

if ($fail -ne 0) { Write-Host 'CHECK: FAIL'; exit 1 } else { Write-Host 'CHECK: PASS'; exit 0 }
