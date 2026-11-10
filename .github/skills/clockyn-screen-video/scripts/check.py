"""Quality check of a finished video: codec/size facts, loudness, and still frames to look at.
Usage: python check.py <video.mp4> <out-dir> [seconds,seconds,...]   (default: 5 evenly spaced stills)
"""
import re
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg

ff = imageio_ffmpeg.get_ffmpeg_exe()
video = Path(sys.argv[1]).resolve()
outdir = Path(sys.argv[2]).resolve()
outdir.mkdir(parents=True, exist_ok=True)

info = subprocess.run([ff, "-hide_banner", "-i", str(video)], capture_output=True, text=True).stderr
dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", info)
seconds = int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3]) if dur else 0
print("duration:", round(seconds, 2), "s;", f"size: {video.stat().st_size / 1024 / 1024:.2f} MB")
for line in info.splitlines():
    if "Stream #" in line:
        print(line.strip())

vol = subprocess.run([ff, "-hide_banner", "-i", str(video), "-af", "volumedetect", "-vn", "-f", "null", "-"], capture_output=True, text=True).stderr
m = re.search(r"mean_volume: (-?[\d.]+) dB", vol)
x = re.search(r"max_volume: (-?[\d.]+) dB", vol)
print("audio mean/max volume:", m[1] if m else "?", "/", x[1] if x else "?", "dB (silent video shows -91 dB or 'None'; speech should be about -25..-12 dB mean)")

times = [float(v) for v in sys.argv[3].split(",")] if len(sys.argv) > 3 else [seconds * k / 6 for k in range(1, 6)]
for t in times:
    p = outdir / f"still_{t:.1f}s.png".replace(".", "_", 1)
    subprocess.run([ff, "-y", "-hide_banner", "-loglevel", "error", "-ss", str(t), "-i", str(video), "-frames:v", "1", str(p)], check=True)
    print("still:", p)
