# Project checks: PHP/JavaScript syntax plus Node tests.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$fail = 0

Write-Host '== PHP lint (api/) =='
if (Get-Command php -ErrorAction SilentlyContinue) {
  Get-ChildItem -Path (Join-Path $root 'api') -Recurse -Filter *.php | ForEach-Object {
    $out = & php -l $_.FullName 2>&1
    if ($LASTEXITCODE -ne 0) {
      $script:fail = 1
      Write-Host "FAIL  $($_.FullName)"
      Write-Host $out
    }
  }
} else {
  Write-Host 'SKIP  php not found - skipping PHP syntax check'
}

Write-Host '== JS syntax (src/) =='
if (Get-Command node -ErrorAction SilentlyContinue) {
  Get-ChildItem -Path (Join-Path $root 'src') -Recurse -Filter *.js | ForEach-Object {
    & node --check $_.FullName
    if ($LASTEXITCODE -ne 0) {
      $script:fail = 1
      Write-Host "FAIL  $($_.FullName)"
    }
  }
} else {
  Write-Host 'SKIP  node not found - skipping JS syntax check'
}

Write-Host '== Tests (tests/) =='
$tests = Join-Path $root 'tests'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host 'SKIP  node not found - skipping tests'
} elseif (Test-Path $tests) {
  $files = @(Get-ChildItem -Path $tests -Recurse -File |
             Where-Object { $_.Name -match '\.test\.(m|c)?js$' } |
             ForEach-Object { $_.FullName })
  if ($files.Count -eq 0) {
    Write-Host 'SKIP  no *.test.js files under tests/'
  } else {
    # One process also works in restricted Windows environments where worker spawning is blocked.
    & node --test --test-isolation=none @files
    if ($LASTEXITCODE -ne 0) {
      $fail = 1
      Write-Host 'FAIL  node --test'
    }
  }
} else {
  Write-Host 'SKIP  tests/ not found'
}

if ($fail -ne 0) {
  Write-Host 'CHECK: FAIL'
  exit 1
}

Write-Host 'CHECK: PASS'
