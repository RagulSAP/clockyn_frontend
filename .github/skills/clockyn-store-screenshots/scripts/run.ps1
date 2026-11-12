<#
.SYNOPSIS
  Makes the store screenshots from the REAL app: build -> capture -> compose -> validate.
.EXAMPLE
  .\run.ps1 -Work C:\POC\clockyn_store_shots\v1
  .\run.ps1 -Work C:\POC\clockyn_store_shots\v1 -SkipBuild          # app code unchanged since the last build
  .\run.ps1 -Work C:\POC\clockyn_store_shots\v1 -ComposeOnly        # only the headlines / layout changed (config.json): takes a minute
  .\run.ps1 -Work C:\POC\clockyn_store_shots\v1 -SkipBuild -Only location,punch   # recapture just these screens (the other pictures are kept)
.NOTES
  The work folder must hold config.json (copy scripts\config.example.json). Output: <Work>\out\ . Nothing is written into the repo except the
  temporary capture spec e2e\specs\zz-store-shots.spec.ts, which is removed again at the end.
#>
param(
  [Parameter(Mandatory = $true)][string]$Work,
  [switch]$SkipBuild,
  [switch]$SkipCapture,
  [switch]$ComposeOnly,
  [string[]]$Only = @()     # e.g. -Only location,punch : recapture just these shot ids (the other pictures are kept)
)
# Not 'Stop': in Windows PowerShell 5.1 any text a program writes to stderr (the test servers do) would abort the script.
# Every step below checks its own exit code instead.
$ErrorActionPreference = 'Continue'
$Here = $PSScriptRoot
$Repo = if ($env:STORE_REPO_ROOT) { (Resolve-Path $env:STORE_REPO_ROOT).Path } else { (Resolve-Path (Join-Path $Here '..\..\..\..')).Path }
$Work = (New-Item -ItemType Directory -Force -Path $Work).FullName
if (-not (Test-Path (Join-Path $Work 'config.json'))) { Write-Error "No config.json in $Work. Copy $Here\config.example.json there and edit it."; exit 1 }
$cfg = Get-Content (Join-Path $Work 'config.json') -Raw | ConvertFrom-Json

# Own ports and output folder: never collides with your normal e2e runs
$env:E2E_ARTIFACTS = 'e2e/.artifacts-store'
$env:MOCK_PORT = '18887'
$env:E2E_WEB_PORT = '18888'
$env:E2E_WEB_PORTS = '2'
$env:E2E_WORKERS = '2'
$env:STORE_WORK_DIR = $Work
$env:STORE_ONLY = ($Only -join ',')
$env:VIDEO_ORG_NAME = if ($cfg.capture.orgName) { $cfg.capture.orgName } else { 'AuroCloud' }

Push-Location $Repo
$Spec = Join-Path $Repo 'e2e\specs\zz-store-shots.spec.ts'
try {
  if (-not $ComposeOnly -and -not $SkipCapture) {
    if (-not $SkipBuild) {
      Write-Host '== 1/4 building the web app (current code) ==' -ForegroundColor Cyan
      npm run e2e:build
      if ($LASTEXITCODE -ne 0) { Write-Error 'e2e:build failed'; exit 1 }
    } elseif (-not (Test-Path (Join-Path $Repo 'e2e\.artifacts-store\web-dist\index.html'))) {
      Write-Error 'No web build yet: run once without -SkipBuild.'; exit 1
    }

    Write-Host '== 2/4 capturing the real screens (phone + tablet size) ==' -ForegroundColor Cyan
    if (-not $Only) { Remove-Item -Recurse -Force (Join-Path $Work 'raw') -ErrorAction SilentlyContinue }
    Copy-Item (Join-Path $Here 'shots.spec.template.ts.txt') $Spec -Force
    npx playwright test -c e2e/playwright.config.ts zz-store-shots --project=phone --workers=2 --reporter=list
    $captureExit = $LASTEXITCODE
    if ($captureExit -ne 0) { Write-Warning 'Some shots could not be captured: see the list above and raw\report. The rest continue.' }
  }
} finally {
  if (Test-Path $Spec) { Remove-Item $Spec -Force }   # only OUR temporary spec; any other zz-* file is not touched
  Pop-Location
}

Write-Host '== 3/4 composing the store images ==' -ForegroundColor Cyan
Remove-Item -Recurse -Force (Join-Path $Work 'out') -ErrorAction SilentlyContinue
node (Join-Path $Here 'compose.mjs') $Work
if ($LASTEXITCODE -ne 0) { Write-Error 'compose failed'; exit 1 }

Write-Host '== 4/4 checking against the store rules ==' -ForegroundColor Cyan
python (Join-Path $Here 'validate.py') $Work
$v = $LASTEXITCODE
Write-Host "`nOpen: $Work\out\overview  (review the story)   |   $Work\out\manifest.json  (upload order)" -ForegroundColor Green
exit $v
