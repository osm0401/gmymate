[CmdletBinding()]
param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$exitCode = 0

try {
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $rootDir = Split-Path -Parent $scriptDir
    $envFile = Join-Path $scriptDir "deploy.env"

    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "deploy/deploy.env가 없습니다. deploy.env.example을 복사해 FTP 주소와 아이디를 입력하세요."
    }

    $settings = @{}
    $hasStoredPassword = $false
    Get-Content -LiteralPath $envFile -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2
            if ($parts.Count -eq 2) {
                $key = $parts[0].Trim()
                if ($key -eq "FTP_PASS") {
                    $hasStoredPassword = $true
                }
                else {
                    $settings[$key] = $parts[1].Trim()
                }
            }
        }
    }

    foreach ($key in @("FTP_HOST", "FTP_USER")) {
        if (-not $settings.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($settings[$key])) {
            throw "$key 값이 비어 있습니다."
        }
    }

    $ftpHost = $settings["FTP_HOST"]
    $ftpUser = $settings["FTP_USER"]
    $remoteDir = if ($settings.ContainsKey("FTP_REMOTE_DIR")) { $settings["FTP_REMOTE_DIR"].Trim("/") } else { "" }

    if ($ftpHost -notmatch '^[A-Za-z0-9.-]+(?::[0-9]{1,5})?$') {
        throw "FTP_HOST에는 ftp:// 없이 호스트명과 선택적 포트만 입력하세요."
    }
    if ($ftpUser -match "[`r`n:]") {
        throw "FTP_USER 값이 올바르지 않습니다."
    }
    if ($remoteDir -match '(^|/)\.\.(/|$)' -or $remoteDir -notmatch '^[A-Za-z0-9._/-]*$') {
        throw "FTP_REMOTE_DIR 값이 올바르지 않습니다."
    }

    if ($hasStoredPassword) {
        Write-Warning "deploy.env의 FTP_PASS는 사용하지 않습니다. 해당 줄을 지워도 됩니다."
    }

    $topFiles = @("index.html", "main.html", "onboarding.html", "privacy.html", ".htaccess", "ads.txt")
    $directories = @("src", "api")
    $deployFiles = @(
        foreach ($name in $topFiles) {
            $path = Join-Path $rootDir $name
            if (Test-Path -LiteralPath $path) { Get-Item -LiteralPath $path }
        }
        foreach ($name in $directories) {
            $path = Join-Path $rootDir $name
            if (Test-Path -LiteralPath $path) { Get-ChildItem -LiteralPath $path -Recurse -File }
        }
    )

    if ($DryRun) {
        $deployFiles | ForEach-Object {
            $relativePath = $_.FullName.Substring($rootDir.Length + 1) -replace "\\", "/"
            Write-Host "upload planned: $relativePath"
        }
        Write-Host "Total $($deployFiles.Count) files. Nothing was uploaded (DryRun)."
    }
    else {
        $ftpPassword = $env:FTP_PASS
        if ([string]::IsNullOrWhiteSpace($ftpPassword)) {
            $securePassword = Read-Host "FTP 비밀번호" -AsSecureString
            $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
            try {
                $ftpPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
            }
            finally {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
            }
        }

        if ([string]::IsNullOrWhiteSpace($ftpPassword) -or $ftpPassword -match "[`r`n]") {
            throw "FTP 비밀번호가 비어 있거나 올바르지 않습니다."
        }

        function Get-FtpUrl([string]$RelativePath) {
            $encoded = (($RelativePath -split "/") | ForEach-Object { [Uri]::EscapeDataString($_) }) -join "/"
            $base = "ftp://$ftpHost/"
            if ($remoteDir) { $base += "$remoteDir/" }
            return $base + $encoded
        }

        function New-FtpDirectory([string]$RelativeDir) {
            if (-not $RelativeDir) {
                return
            }

            $request = [System.Net.FtpWebRequest]::Create((Get-FtpUrl $RelativeDir))
            $request.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
            $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPassword)
            $request.UsePassive = $true
            try {
                $response = $request.GetResponse()
                $response.Close()
            }
            catch [System.Net.WebException] {
                # 550 usually means the directory already exists — fine to ignore.
            }
        }

        function Send-FtpFile([string]$LocalPath, [string]$RelativePath) {
            $request = [System.Net.FtpWebRequest]::Create((Get-FtpUrl $RelativePath))
            $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
            $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPassword)
            $request.UseBinary = $true
            $request.UsePassive = $true
            $request.KeepAlive = $false

            $fileBytes = [System.IO.File]::ReadAllBytes($LocalPath)
            $request.ContentLength = $fileBytes.Length

            $requestStream = $request.GetRequestStream()
            $requestStream.Write($fileBytes, 0, $fileBytes.Length)
            $requestStream.Close()

            $response = $request.GetResponse()
            $response.Close()

            return $fileBytes.Length
        }

        # Create every intermediate directory once, shallowest first, before
        # uploading files — FtpWebRequest has no "create parent dirs" flag
        # like curl's --ftp-create-dirs.
        $directorySet = New-Object System.Collections.Generic.HashSet[string]
        foreach ($file in $deployFiles) {
            $relativePath = $file.FullName.Substring($rootDir.Length + 1) -replace "\\", "/"
            $segments = $relativePath -split "/"
            for ($i = 0; $i -lt $segments.Length - 1; $i++) {
                $dir = ($segments[0..$i]) -join "/"
                [void]$directorySet.Add($dir)
            }
        }
        $directorySet | Sort-Object { ($_ -split "/").Count } | ForEach-Object {
            New-FtpDirectory $_
        }

        $failures = @()
        foreach ($file in $deployFiles) {
            $relativePath = $file.FullName.Substring($rootDir.Length + 1) -replace "\\", "/"
            try {
                $size = Send-FtpFile -LocalPath $file.FullName -RelativePath $relativePath
                Write-Host "[OK] $relativePath ($size byte)" -ForegroundColor Green
            }
            catch {
                Write-Host "[FAIL] $relativePath — $($_.Exception.Message)" -ForegroundColor Red
                $failures += $relativePath
            }
        }

        Write-Host ""
        if ($failures.Count -gt 0) {
            Write-Host "업로드 실패한 파일:" -ForegroundColor Red
            $failures | ForEach-Object { Write-Host "  - $_" }
            $exitCode = 1
        }
        else {
            Write-Host "FTP 업로드 완료. 실제로 반영됐는지 사이트에서 직접 확인할게요..." -ForegroundColor Green
        }

        # Ftp readback would just prove the FTP server accepted the write, not
        # that the public site is serving it — so verify over plain HTTPS instead.
        $checkFile = $topFiles | Where-Object { Test-Path (Join-Path $rootDir $_) } | Select-Object -First 1
        if ($checkFile) {
            try {
                $bust = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
                $liveUrl = "https://$ftpHost/$checkFile" + "?cachebust=$bust"
                $liveResponse = Invoke-WebRequest -Uri $liveUrl -UseBasicParsing -TimeoutSec 15
                $localBytes = [System.IO.File]::ReadAllBytes((Join-Path $rootDir $checkFile))
                $liveBytes = $liveResponse.Content
                if ($liveBytes -is [string]) {
                    $liveBytes = [System.Text.Encoding]::UTF8.GetBytes($liveBytes)
                }

                if ($liveBytes.Length -eq $localBytes.Length) {
                    Write-Host "[검증 OK] https://$ftpHost/$checkFile 크기가 로컬 파일과 일치해요 ($($localBytes.Length) byte)." -ForegroundColor Green
                }
                else {
                    Write-Host "[검증 실패] https://$ftpHost/$checkFile 이(가) 로컬 파일과 크기가 달라요 (로컬 $($localBytes.Length) byte / 서버 $($liveBytes.Length) byte). 반영이 안 된 것 같아요." -ForegroundColor Red
                    $exitCode = 1
                }
            }
            catch {
                Write-Host "[검증 실패] $checkFile 을(를) https로 확인하지 못했어요: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
}
catch {
    Write-Host ""
    Write-Host "오류: $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
}
finally {
    Write-Host ""
    Read-Host "Enter 키를 누르면 창이 닫혀요"
}

exit $exitCode
