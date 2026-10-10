# Habyt: az esti automatikus megnyitas kikapcsolasa.
$taskName = 'Habyt esti check-in'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Host "A '$taskName' feladat torolve."
} else {
  Write-Host "Nincs ilyen feladat: '$taskName'."
}
