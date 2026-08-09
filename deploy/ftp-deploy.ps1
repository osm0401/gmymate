# Simple FTP deploy for kpgo.dothome.co.kr
# Usage: powershell -File deploy/ftp-deploy.ps1 -Password 'your_ftp_pw'
param(
  [Parameter(Mandatory = $true)][string]$Password
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

# Load host/user from deploy.env
$envFile = Join-Path $PSScriptRoot 'deploy.env'
$cfg = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#=]+)=(.*)$') { $cfg[$Matches[1].Trim()] = $Matches[2].Trim() }
}
$FtpHost   = $cfg['FTP_HOST']
$User      = $cfg['FTP_USER']
$RemoteDir = $cfg['FTP_REMOTE_DIR']  # '' if login lands in public_html

# Files not to upload (old/temp)
$exclude = @('cleanup-files.mjs', 'src/style.css', 'src/script.js', 'src/app.legacy.js')

# Build upload list: top-level pages + src/ + api/ (recursive)
$files = @()
foreach ($f in @('index.html', 'main.html', 'onboarding.html')) {
  $p = Join-Path $Root $f
  if (Test-Path $p) { $files += $p }
}
foreach ($d in @('src', 'api')) {
  $dp = Join-Path $Root $d
  if (Test-Path $dp) { $files += (Get-ChildItem -Path $dp -Recurse -File).FullName }
}

$ok = 0; $fail = 0
foreach ($local in $files) {
  $rel = $local.Substring($Root.Length + 1).Replace('\', '/')
  if ($exclude -contains $rel) { Write-Host "skip:   $rel"; continue }
  $url = "ftp://$FtpHost$RemoteDir/$rel"
  Write-Host "upload: $rel"
  curl.exe --fail --silent --show-error --ftp-create-dirs --user "${User}:${Password}" -T "$local" "$url"
  if ($LASTEXITCODE -eq 0) { $ok++ } else { $fail++; Write-Host "  FAILED ($LASTEXITCODE)" }
}

Write-Host ""
Write-Host "Done. uploaded=$ok failed=$fail"
if ($fail -gt 0) { exit 1 }
