"""frames + narration -> MP4 (H.264 High, yuv420p limited-range bt709, AAC 44.1 kHz stereo, faststart: plays on every phone and browser).
Usage: python mux.py <work-dir> <out.mp4>
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

work = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
T = json.loads((work / "timing.json").read_text(encoding="utf-8"))

try:
    import imageio_ffmpeg

    ff = imageio_ffmpeg.get_ffmpeg_exe()
except ImportError:
    ff = shutil.which("ffmpeg")
    if not ff:
        sys.exit("No ffmpeg: run this with the venv python that has imageio-ffmpeg (render.ps1 sets that up) or put ffmpeg on PATH.")

cfg = json.loads((work / "config.json").read_text(encoding="utf-8"))
music = work / "music.wav"
use_music = music.exists() and str(cfg.get("music", "generated")).lower() != "none"
music_lufs = cfg.get("musicLufs", -28)   # loudness of the music bed when nobody is speaking (the voice is -16 LUFS)

inputs = ["-framerate", str(T["fps"]), "-i", str(work / "frames" / "f%04d.jpg")]
chains, labels = [], []
for i, s in enumerate(T["scenes"], start=1):
    inputs += ["-i", str(work / f"scene{i}.wav")]
    ms = int(round(s["start"] * 1000))
    chains.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
    labels.append(f"[a{i}]")
voice = "".join(labels) + f"amix=inputs={len(labels)}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100"
if use_music:
    inputs += ["-i", str(music)]
    m = len(T["scenes"]) + 1
    chains.append(voice + f",apad=whole_dur={T['total']},asplit=2[v1][v2]")   # pad the voice with silence to the video length so the music (sidechain) plays to the end
    # music bed at a fixed loudness, ducked under the voice (sidechain) so words stay clear, soft limiter on the sum
    chains.append(f"[{m}:a]aresample=44100,aformat=channel_layouts=stereo,loudnorm=I={music_lufs}:TP=-9:LRA=11,aresample=44100[mus]")
    chains.append("[mus][v1]sidechaincompress=threshold=0.05:ratio=3:attack=40:release=600[duck]")
    chains.append("[v2][duck]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.97[aout]")
else:
    chains.append(voice + ",apad[aout]")

cmd = [
    ff, "-y", *inputs, "-filter_complex", ";".join(chains), "-map", "0:v", "-map", "[aout]",
    # JPEG frames are full-range: convert to limited-range bt709 so colours match everywhere (no washed-out/yuvj420p)
    "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-r", str(T["fps"]),
    "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-t", str(T["total"]), "-movflags", "+faststart", str(out),
]
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode:
    print(r.stderr[-1500:])
    sys.exit(r.returncode)
print(f"muxed -> {out} ({out.stat().st_size / 1024 / 1024:.2f} MB)")
