[CmdletBinding()]
param(
    [switch] $Full,
    [switch] $DryRun
)

$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$settingsPath = Join-Path $PSScriptRoot "ftp.settings.json"
$credentialPath = Join-Path $PSScriptRoot ".ftp-credential.xml"
$statePath = Join-Path $PSScriptRoot ".ftp-state.json"

function Escape-CurlConfigValue([string] $value) {
    return $value.Replace("\", "\\").Replace('"', '\"').Replace("`r", "").Replace("`n", "")
}

function ConvertTo-RemotePath([string] $remoteRoot, [string] $relativePath) {
    $combined = $remoteRoot.Trim("/") + "/" + $relativePath.Replace("\", "/").TrimStart("/")
    $segments = $combined.Split("/") | Where-Object { $_ -ne "" }
    $escaped = $segments | ForEach-Object { [Uri]::EscapeDataString($_) }
    return $escaped -join "/"
}

if (-not (Test-Path -LiteralPath $settingsPath)) {
    throw "Missing FTP settings: $settingsPath"
}

$settings = Get-Content -Raw -Encoding UTF8 -LiteralPath $settingsPath | ConvertFrom-Json
$curl = $null
$networkCredential = $null

if (-not $DryRun) {
    if (-not (Test-Path -LiteralPath $credentialPath)) {
        throw "FTP credentials are not configured. Run scripts/deploy/setup-ftp.ps1 once."
    }

    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue

    if ($null -eq $curl) {
        throw "curl.exe is required for FTP deployment."
    }

    $credential = Import-Clixml -LiteralPath $credentialPath

    if ($credential -isnot [System.Management.Automation.PSCredential]) {
        throw "The saved FTP credential is invalid. Run scripts/deploy/setup-ftp.ps1 again."
    }

    $networkCredential = $credential.GetNetworkCredential()
}
$localRootCandidate = Join-Path $appRoot ([string] $settings.localRoot)

if (-not (Test-Path -LiteralPath $localRootCandidate -PathType Container)) {
    throw "Upload folder not found: $localRootCandidate"
}

$localRoot = (Resolve-Path -LiteralPath $localRootCandidate).Path.TrimEnd([char[]] "\/")

$excludedPaths = @(
    ".gitignore",
    "README.md",
    "api/README.md",
    "api/config/database.example.php",
    "api/config/gemini.example.php"
)

$excludedPrefixes = @(
    ".git/",
    "docs/",
    "scripts/",
    "test/"
)

$files = Get-ChildItem -LiteralPath $localRoot -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($localRoot.Length).TrimStart("\").Replace("\", "/")

    $hasExcludedPrefix = $false

    foreach ($prefix in $excludedPrefixes) {
        if ($relative.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            $hasExcludedPrefix = $true
            break
        }
    }

    if ($excludedPaths -notcontains $relative -and -not $hasExcludedPrefix) {
        [PSCustomObject]@{
            File = $_
            Relative = $relative
            Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash
        }
    }
}

$protocol = "ftp"
$targetId = "${protocol}://$($settings.host):$($settings.port)$($settings.remoteRoot)"
$previousHashes = @{}

if (-not $Full -and (Test-Path -LiteralPath $statePath)) {
    try {
        $state = Get-Content -Raw -Encoding UTF8 -LiteralPath $statePath | ConvertFrom-Json

        if ([string] $state.target -eq $targetId) {
            $state.files.PSObject.Properties | ForEach-Object {
                $previousHashes[$_.Name] = [string] $_.Value
            }
        }
    } catch {
        Write-Warning "The previous deployment state is invalid. A full upload will run."
    }
}

$changedFiles = @($files | Where-Object {
    $Full -or -not $previousHashes.ContainsKey($_.Relative) -or $previousHashes[$_.Relative] -ne $_.Hash
})

if ($changedFiles.Count -eq 0) {
    Write-Host "No changed files to upload."
    exit 0
}

Write-Host "Target: $targetId"
Write-Host "Changed files: $($changedFiles.Count)"

if (-not [bool] $settings.requireTls) {
    Write-Warning "This host is configured for plain FTP because Dothome does not advertise FTPS for this plan. FTP credentials are not encrypted in transit."
}

$temporaryUploadFile = if ($DryRun) { $null } else { [System.IO.Path]::GetTempFileName() }

try {
    foreach ($item in $changedFiles) {
        Write-Host ("{0} {1}" -f ($(if ($DryRun) { "Would upload" } else { "Uploading" })), $item.Relative)

        if ($DryRun) {
            continue
        }

        Copy-Item -LiteralPath $item.File.FullName -Destination $temporaryUploadFile -Force

        $remotePath = ConvertTo-RemotePath ([string] $settings.remoteRoot) $item.Relative
        $remoteUrl = "ftp://$($settings.host):$($settings.port)/$remotePath"
        $userValue = Escape-CurlConfigValue ($networkCredential.UserName + ":" + $networkCredential.Password)
        $fileValue = Escape-CurlConfigValue $temporaryUploadFile
        $urlValue = Escape-CurlConfigValue $remoteUrl
        $curlConfig = @(
            "silent",
            "show-error",
            "fail",
            "ftp-create-dirs",
            "ftp-pasv",
            "connect-timeout = 15",
            "max-time = 120",
            "user = `"$userValue`"",
            "upload-file = `"$fileValue`"",
            "url = `"$urlValue`""
        )

        if ([bool] $settings.requireTls) {
            $curlConfig += "ssl-reqd"
        }

        $curlOutput = ($curlConfig -join [Environment]::NewLine) | & $curl.Source --config - 2>&1

        if ($LASTEXITCODE -ne 0) {
            $safeOutput = ([string] ($curlOutput -join " ")).Replace($networkCredential.Password, "[REDACTED]")
            throw "FTP upload failed for $($item.Relative): $safeOutput"
        }
    }
} finally {
    if ($temporaryUploadFile -and (Test-Path -LiteralPath $temporaryUploadFile)) {
        Remove-Item -LiteralPath $temporaryUploadFile -Force
    }
}

if ($DryRun) {
    Write-Host "Dry run complete. No files were uploaded."
    exit 0
}

$nextHashes = @{}
$files | ForEach-Object { $nextHashes[$_.Relative] = $_.Hash }
@{
    target = $targetId
    deployedAt = (Get-Date).ToString("o")
    files = $nextHashes
} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -LiteralPath $statePath

Write-Host "FTP deployment complete."

if ([string] $settings.verifyUrl -ne "") {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri ([string] $settings.verifyUrl) -TimeoutSec 20
        Write-Host "Website check: HTTP $([int] $response.StatusCode)"
    } catch {
        Write-Warning "Files uploaded, but the website verification request failed."
    }
}
