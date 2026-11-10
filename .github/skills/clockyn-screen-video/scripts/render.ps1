param(
  [Parameter(Mandatory = $true)][string]$Work,       # work folder: holds config.json and live\ (the recording); everything else is generated here
  [string]$Out,                                       # output MP4 (default: <Work>\<slug>.mp4)
  [string]$Preview,                                   # e.g. "1.5,7,12": only render those seconds to preview-*.png (fast), no video
  [switch]$SkipTts                                    # reuse the scene*.wav from a previous run (when only visuals changed)
)
# narration -> timing -> anchors -> music -> frames -> MP4. Run AFTER the recording exists at <Work>\live\live.json.
$ErrorActionPreference = 'Stop'
$Skill = Split-Path -Parent $MyInvocation.MyCommand.Path
$Work = (Resolve-Path $Work).Path
if (-not (Test-Path (Join-Path $Work 'config.json'))) { throw "No config.json in $Work (copy scripts\config.example.json there and edit it)." }
if (-not (Test-Path (Join-Path $Work 'live\live.json'))) { throw "No recording at $Work\live\live.json. Run the recording spec first (see SKILL.md step 4)." }
$cfg = Get-Content -Raw -Encoding UTF8 (Join-Path $Work 'config.json') | ConvertFrom-Json
if (-not $Out) { $Out = Join-Path $Work ("{0}.mp4" -f $cfg.slug) }

# python venv with imageio-ffmpeg (bundles ffmpeg, nothing to install system-wide)
$py = Join-Path $Work 'venv\Scripts\python.exe'
if (-not (Test-Path $py)) {
  Write-Output 'Creating the python venv (once)...'
  python -m venv (Join-Path $Work 'venv'); if ($LASTEXITCODE) { throw 'python -m venv failed (is Python 3 installed and on PATH?)' }
  & $py -m pip install --quiet imageio-ffmpeg numpy; if ($LASTEXITCODE) { throw 'pip install imageio-ffmpeg numpy failed' }
}
& $py -c "import numpy" 2>$null; if ($LASTEXITCODE) { & $py -m pip install --quiet numpy; if ($LASTEXITCODE) { throw 'pip install numpy failed' } }   # older venvs

if (-not $SkipTts) { & (Join-Path $Skill 'tts.ps1') -Work $Work }
& $py (Join-Path $Skill 'timing.py') $Work; if ($LASTEXITCODE) { throw 'timing.py failed' }
& $py (Join-Path $Skill 'build_src.py') $Work; if ($LASTEXITCODE) { throw 'build_src.py failed' }
& $py (Join-Path $Skill 'music.py') $Work; if ($LASTEXITCODE) { throw 'music.py failed' }
Copy-Item (Join-Path $Skill 'video.html') (Join-Path $Work 'video.html') -Force

if ($Preview) {
  node (Join-Path $Skill 'capture.mjs') $Work $Preview; if ($LASTEXITCODE) { throw 'capture failed' }
  Write-Output "Look at $Work\preview-*.png, adjust config.json / the recording, re-run. Run without -Preview for the real video."
  return
}
node (Join-Path $Skill 'capture.mjs') $Work; if ($LASTEXITCODE) { throw 'capture failed' }
& $py (Join-Path $Skill 'mux.py') $Work $Out; if ($LASTEXITCODE) { throw 'mux failed' }
Write-Output "DONE: $Out"
Write-Output "Next: $py $Skill\check.py `"$Out`" `"$Work\check`"   and look at the stills."
