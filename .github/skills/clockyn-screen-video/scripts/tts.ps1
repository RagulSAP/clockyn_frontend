param(
  [Parameter(Mandatory = $true)][string]$Work
)
# Narration -> scene1.wav .. sceneN.wav (one file per scene) with the Windows built-in voices (System.Speech / SAPI).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$cfg = Get-Content -Raw -Encoding UTF8 (Join-Path $Work 'config.json') | ConvertFrom-Json
$voice = if ($cfg.voice) { [string]$cfg.voice } else { 'Microsoft David Desktop' }
$rate = if ($null -ne $cfg.rate) { [int]$cfg.rate } else { 0 }   # -10 (slow) .. 10 (fast); 0 = normal speaking pace

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }
if ($installed -notcontains $voice) {
  Write-Warning "Voice '$voice' is not installed. Installed: $($installed -join ', '). Using the default voice."
} else {
  $synth.SelectVoice($voice)
}
$synth.Rate = $rate
$synth.Volume = 100
for ($i = 0; $i -lt $cfg.scenes.Count; $i++) {
  $path = Join-Path $Work ('scene{0}.wav' -f ($i + 1))
  $synth.SetOutputToWaveFile($path)
  $synth.Speak([string]$cfg.scenes[$i].narration)
  $synth.SetOutputToNull()
}
$synth.Dispose()
Write-Output "tts ok: $($cfg.scenes.Count) scenes, voice=$voice, rate=$rate"
