# 성장기 수면 가드
# 밤 11시 이후에 컴퓨터를 쓰고 있으면 확인 창을 띄운다. [끄기] 누르면 바로 종료.
#
# 설치:  powershell -ExecutionPolicy Bypass -File .\sleep-guard.ps1 -Install
# 테스트: powershell -ExecutionPolicy Bypass -File .\sleep-guard.ps1 -Test
# 제거:  Unregister-ScheduledTask -TaskName SleepGuard -Confirm:$false

param(
  [switch]$Install,
  [switch]$Test,
  [int]$StartHour = 23,      # 이 시각부터
  [int]$EndHour = 6,         # 이 시각까지 (다음날 새벽)
  [int]$IntervalMinutes = 10 # 계속 하겠다고 하면 이 간격으로 다시 물어봄
)

$ErrorActionPreference = "Stop"

if ($Install) {
  $exe = Join-Path $PSHOME "powershell.exe"

  # 작업 등록은 관리자 권한이 필요하다 -> 없으면 UAC 띄우고 다시 실행
  $me = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $me.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "관리자 권한이 필요해서 UAC 창을 띄웁니다. [예] 눌러줘."
    Start-Process $exe -Verb RunAs -ArgumentList @(
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$PSCommandPath`"",
      "-Install", "-StartHour", $StartHour, "-EndHour", $EndHour, "-IntervalMinutes", $IntervalMinutes
    )
    return
  }

  $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`" -StartHour $StartHour -EndHour $EndHour"
  $span = (24 - $StartHour + $EndHour)  # 23시~6시 = 7시간

  # 매일 23:00 에 시작해서 새벽까지 $IntervalMinutes 마다 다시 물어봄
  $daily = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($StartHour))
  $daily.Repetition = (New-ScheduledTaskTrigger -Once -At ([datetime]::Today.AddHours($StartHour)) `
      -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
      -RepetitionDuration (New-TimeSpan -Hours $span)).Repetition

  Register-ScheduledTask -TaskName "SleepGuard" -Force `
    -Description "밤 $StartHour 시 이후 PC 사용 확인" `
    -Action (New-ScheduledTaskAction -Execute $exe -Argument $arg) `
    -Trigger $daily, (New-ScheduledTaskTrigger -AtLogOn) `
    -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew)
  Write-Host "설치 완료: 매일 $StartHour 시부터 $IntervalMinutes 분마다, 그리고 로그인할 때마다."
  return
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 확인 창을 띄우고, 끄기를 골랐으면 $true 를 돌려준다.
function Show-SleepPrompt {
  $form = New-Object Windows.Forms.Form -Property @{
    Text            = "잠깐"
    FormBorderStyle = "None"     # 테두리 없이 화면 꽉 채움
    WindowState     = "Maximized"
    TopMost         = $true
    ControlBox      = $false     # X 버튼으로 도망 못 감
    BackColor       = [Drawing.Color]::FromArgb(12, 12, 18)
    ForeColor       = [Drawing.Color]::White
  }

  # 세로로 3등분: 시계 / 질문 / 버튼
  $rows = New-Object Windows.Forms.TableLayoutPanel -Property @{
    Dock        = "Fill"
    ColumnCount = 1
    RowCount    = 3
  }
  foreach ($p in 30, 35, 35) {
    $null = $rows.RowStyles.Add((New-Object Windows.Forms.RowStyle("Percent", $p)))
  }

  $clock = New-Object Windows.Forms.Label -Property @{
    Text      = (Get-Date -Format "HH:mm")
    Font      = New-Object Drawing.Font("Malgun Gothic", 96, [Drawing.FontStyle]::Bold)
    ForeColor = [Drawing.Color]::FromArgb(255, 96, 96)
    TextAlign = "BottomCenter"
    Dock      = "Fill"
  }

  $label = New-Object Windows.Forms.Label -Property @{
    Text      = "진짜 계속 할 거야?`r`n키 안 클 거야?"
    Font      = New-Object Drawing.Font("Malgun Gothic", 34)
    TextAlign = "MiddleCenter"
    Dock      = "Fill"
  }

  # 버튼 두 개를 가운데 나란히
  $buttons = New-Object Windows.Forms.FlowLayoutPanel -Property @{
    Dock          = "Fill"
    FlowDirection = "LeftToRight"
    Anchor        = "None"
    AutoSize      = $true
  }

  $keep = New-Object Windows.Forms.Button -Property @{
    Text         = "그래도 할래"
    Font         = New-Object Drawing.Font("Malgun Gothic", 18)
    Size         = New-Object Drawing.Size(280, 100)
    Margin       = New-Object Windows.Forms.Padding(20)
    FlatStyle    = "Flat"
    ForeColor    = [Drawing.Color]::Gainsboro
    DialogResult = "No"
  }

  $off = New-Object Windows.Forms.Button -Property @{
    Text         = "끄기"
    Font         = New-Object Drawing.Font("Malgun Gothic", 18, [Drawing.FontStyle]::Bold)
    Size         = New-Object Drawing.Size(280, 100)
    Margin       = New-Object Windows.Forms.Padding(20)
    FlatStyle    = "Flat"
    BackColor    = [Drawing.Color]::FromArgb(220, 60, 60)
    ForeColor    = [Drawing.Color]::White
    DialogResult = "Yes"
  }

  $buttons.Controls.AddRange(@($keep, $off))
  $rows.Controls.AddRange(@($clock, $label, $buttons))
  $form.Controls.Add($rows)
  $form.AcceptButton = $off      # Enter = 끄기
  $form.Add_Shown({
      $form.Activate()
      # 버튼 묶음을 가로 가운데로
      $buttons.Padding = New-Object Windows.Forms.Padding(
        [Math]::Max(0, [int](($buttons.Width - 640) / 2)), 20, 0, 0)
    })
  return ($form.ShowDialog() -eq [Windows.Forms.DialogResult]::Yes)
}

if ($Test) {
  $choice = Show-SleepPrompt
  Write-Host "선택: $(if ($choice) { '끄기' } else { '계속' })  (테스트 모드라 종료 안 함)"
  return
}

# 한 번만 검사한다. 반복은 작업 스케줄러가 담당.
$hour = (Get-Date).Hour
if (($hour -ge $StartHour -or $hour -lt $EndHour) -and (Show-SleepPrompt)) {
  Stop-Computer -Force
}
