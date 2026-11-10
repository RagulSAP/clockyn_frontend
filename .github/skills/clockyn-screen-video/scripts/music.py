"""Background music bed -> <work>/music.wav, as long as the video.

config.json "music":
  "generated"  (default)  soft ambient pad + gentle bell arpeggio synthesised here (royalty-free: it is generated, not sampled)
  "<path>"                 your own royalty-free MP3/WAV: looped/trimmed to the video length, faded in/out
  "none"                   no music (any old music.wav is removed)
Loudness and ducking under the voice are applied by mux.py ("musicLufs", default -32).
Usage: python music.py <work-dir>
"""
import json
import subprocess
import sys
import wave
from pathlib import Path

work = Path(sys.argv[1]).resolve()
cfg = json.loads((work / "config.json").read_text(encoding="utf-8"))
total = json.loads((work / "timing.json").read_text(encoding="utf-8"))["total"]
mode = str(cfg.get("music", "generated"))
out = work / "music.wav"

if mode.lower() == "none":
    out.unlink(missing_ok=True)
    print("music: none")
    sys.exit(0)

if mode.lower() != "generated":
    src = Path(mode)
    if not src.is_absolute():
        src = (work / src).resolve()
    if not src.exists():
        sys.exit(f"music file not found: {src}")
    import imageio_ffmpeg

    fade = 1.5
    r = subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-hide_banner", "-loglevel", "error", "-stream_loop", "-1", "-i", str(src), "-t", str(total),
         "-af", f"afade=t=in:d=1,afade=t=out:st={max(0, total - fade):.2f}:d={fade}", "-ar", "44100", "-ac", "2", str(out)],
        capture_output=True, text=True)
    if r.returncode:
        sys.exit(r.stderr[-800:])
    print(f"music: {src.name} looped to {total}s")
    sys.exit(0)

import numpy as np

SR = 44100
n = int((total + 1.0) * SR)
t = np.arange(n) / SR
rng = np.random.default_rng(7)  # fixed seed: same music every render

BEAT = 60 / 72                  # 72 bpm, calm
CHORD = 4 * BEAT                # one chord per bar
# C major 7 -> A minor 7 -> F major 7 -> G6 (a warm, open loop). Frequencies in Hz.
CHORDS = [
    [130.81, 164.81, 196.00, 246.94],   # Cmaj7 (C3 E3 G3 B3)
    [110.00, 130.81, 164.81, 196.00],   # Am7   (A2 C3 E3 G3)
    [87.31, 110.00, 130.81, 164.81],    # Fmaj7 (F2 A2 C3 E3)
    [98.00, 123.47, 146.83, 164.81],    # G6    (G2 B2 D3 E3)
]


def smooth_env(t0, t1, attack=0.9, release=1.1):
    return np.clip((t - t0) / attack, 0, 1) * np.clip((t1 - t) / release, 0, 1)


pad = np.zeros(n)
arp = np.zeros(n)
bar = 0
while bar * CHORD < total + 1.0:
    t0 = bar * CHORD
    notes = CHORDS[bar % len(CHORDS)]
    env = smooth_env(t0 - 0.6, t0 + CHORD + 0.9)          # overlap neighbouring chords so changes are seamless
    for f in notes:
        for detune in (0.998, 1.002):                       # two slightly detuned voices = warmth
            pad += env * (np.sin(2 * np.pi * f * detune * t) + 0.25 * np.sin(2 * np.pi * 2 * f * detune * t))
    # gentle plucked bell notes, one per beat, walking up the chord an octave higher
    order = [0, 2, 1, 3]
    for b in range(4):
        tn = t0 + b * BEAT
        f = notes[order[b]] * 4
        local = np.clip(t - tn, 0, None)
        gate = (t >= tn).astype(float)
        arp += gate * np.exp(-local * 3.2) * (np.sin(2 * np.pi * f * t) + 0.2 * np.sin(2 * np.pi * 2 * f * t)) * 0.5
    bar += 1

pad /= max(1e-9, np.abs(pad).max())
arp /= max(1e-9, np.abs(arp).max())
dry = 0.8 * pad + 0.35 * arp

# small-room reverb (decaying noise impulse, different per channel = stereo width)
def reverb(x):
    L = int(1.8 * SR)
    ir = rng.standard_normal(L) * np.exp(-np.arange(L) / (0.45 * SR))
    size = 1 << (len(x) + L).bit_length()
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]

wet = np.stack([reverb(dry), reverb(dry)], axis=1)
wet /= max(1e-9, np.abs(wet).max())
mix = 0.55 * np.stack([dry, dry], axis=1) / max(1e-9, np.abs(dry).max()) + 0.45 * wet

mix = mix[: int(total * SR)]   # ends exactly with the video, fade-out included
k = np.arange(len(mix)) / SR
mix *= (np.clip(k / 1.0, 0, 1) * np.clip((k[-1] - k) / 1.5, 0, 1))[:, None]   # fade in 1 s, out 1.5 s
mix = 0.8 * mix / max(1e-9, np.abs(mix).max())

with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"music: generated {len(mix) / SR:.1f}s ambient bed")
