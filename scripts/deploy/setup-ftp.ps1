[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$settingsPath = Join-Path $PSScriptRoot "ftp.settings.json"
$credentialPath = Join-Path $PSScriptRoot ".ftp-credential.xml"

if (-not (Test-Path -LiteralPath $settingsPath)) {
    throw "Missing FTP settings: $settingsPath"
}

$settings = Get-Content -Raw -Encoding UTF8 -LiteralPath $settingsPath | ConvertFrom-Json
$credential = Get-Credential `
    -UserName ([string] $settings.username) `
    -Message "Enter the Dothome FTP password for $($settings.host)."

if ($null -eq $credential) {
    throw "FTP credential setup was cancelled."
}

$credential | Export-Clixml -LiteralPath $credentialPath

Write-Host "FTP credentials saved for the current Windows account."
Write-Host "Run scripts/deploy/deploy-ftp.ps1 to upload changed files."
