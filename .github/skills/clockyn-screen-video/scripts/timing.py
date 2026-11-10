"""Scene windows from the real narration lengths.

Writes (into the work dir): timing.json (used by mux.py), timing.js + config.js (loaded by video.html).
Usage: python timing.py <work-dir>
"""
import json
import os
import sys
import wave
from pathlib import Path

work = Path(sys.argv[1]).resolve()
cfg = json.loads((work / "config.json").read_text(encoding="utf-8"))

# repo root = the app checkout that holds node_modules (fonts, @playwright/test) and assets (logo)
repo = Path(os.environ.get("VIDEO_REPO_ROOT") or Path(__file__).resolve().parents[4])
if not (repo / "package.json").exists():
    sys.exit(f"Repo root not found at {repo}. Set VIDEO_REPO_ROOT to the clockyn_frontend folder.")

LEAD = cfg.get("lead", 0.20)   # silence before the first sentence
GAP = cfg.get("gap", 0.15)     # pause between sentences
TAIL = cfg.get("tail", 1.20)   # hold the last frame after the last sentence
FPS = cfg.get("fps", 30)

scenes, t = [], LEAD
for i in range(1, len(cfg["scenes"]) + 1):
    with wave.open(str(work / f"scene{i}.wav")) as w:
        dur = w.getnframes() / w.getframerate()
    scenes.append({"start": round(t, 3), "end": round(t + dur, 3), "dur": round(dur, 3)})
    t += dur + GAP
total = round(scenes[-1]["end"] + TAIL, 3)

timing = {"scenes": scenes, "total": total, "fps": FPS}
(work / "timing.json").write_text(json.dumps(timing), encoding="utf-8")
(work / "timing.js").write_text("window.TIMING = " + json.dumps(timing) + ";\n", encoding="utf-8")

page_cfg = dict(cfg)
page_cfg["repoUrl"] = repo.as_uri()
(work / "config.js").write_text("window.CONFIG = " + json.dumps(page_cfg) + ";\n", encoding="utf-8")

print(f"total {total}s at {FPS}fps ({round(total * FPS)} frames); scenes:")
for i, s in enumerate(scenes, start=1):
    print(f"  {i}: {s['start']:.2f}s -> {s['end']:.2f}s ({s['dur']:.2f}s)")
if total > 30:
    print("WARNING: longer than 30 s. Shorten the narration or cut a scene.")
