# Habyt: napi utemezett feladat, ami minden este megnyitja az appot az esti check-inhez.
# Hasznalat (PowerShellben, a Habyt mappaban):
#   powershell -ExecutionPolicy Bypass -File .\install-reminder.ps1
#   powershell -ExecutionPolicy Bypass -File .\install-reminder.ps1 -Time 21:30 -Url "https://sajat-cim.vercel.app/?checkin=1"
param(
  [string]$Url = 'https://habyt-sooty.vercel.app/?checkin=1',
  [string]$Time = '20:00'
)

$taskName = 'Habyt esti check-in'

# Az explorer.exe az alapertelmezett bongeszoben nyitja meg a cimet.
$action = New-ScheduledTaskAction -Execute 'explorer.exe' -Argument "`"$Url`""
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
# StartWhenAvailable: ha 20:00-kor ki volt kapcsolva a gep, bekapcsolas utan potolja.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
  -Description 'Megnyitja a Habyt szokaskovetot az esti check-inhez.' -Force | Out-Null

Write-Host "Kesz: a '$taskName' feladat minden nap $Time-kor megnyitja: $Url"
Write-Host "Kiprobalas most:  Start-ScheduledTask -TaskName '$taskName'"
