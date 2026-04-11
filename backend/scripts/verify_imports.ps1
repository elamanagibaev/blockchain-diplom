# Проверка импортов бэкенда (PowerShell). Запуск из корня репозитория или из backend/:
#   .\backend\scripts\verify_imports.ps1
$ErrorActionPreference = "Stop"
if (Test-Path (Join-Path $PSScriptRoot "..\app")) {
  Set-Location (Join-Path $PSScriptRoot "..")
} else {
  Set-Location $PSScriptRoot
}

$py = $null
foreach ($c in @("python", "python3")) {
  try {
    $cmd = Get-Command $c -ErrorAction Stop
    if ($cmd.Source -notmatch "WindowsApps") { $py = $cmd.Source; break }
  } catch { }
}
if (-not $py) {
  Write-Host "Python не найден в PATH (или только заглушка Windows Store). Установите Python 3.11+ или используйте:"
  Write-Host '  docker compose run --rm --no-deps backend python -c "from app.api.routes import approval; print(\"ok\")"'
  exit 1
}

& $py -c @"
from app.api.routes import approval, admin, auth, files
from app.models.user import User
from app.models.university import University
from app.services.approval_workflow_service import ApprovalWorkflowService
print('imports ok')
"@
