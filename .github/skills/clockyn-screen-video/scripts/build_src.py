"""Recording (live/live.json) + scene timing -> src.js.

src.js holds the screencast frames, the tap positions and the *anchors*: pairs (video time, recording time) that make every tap
and screen land on the words that describe it. Between anchors the recording is played at a constant speed (piecewise linear).

Anchors come from config.json:
  scene.startMark            recording mark taken when that scene's screen starts          -> scene start
  scene.anchors[].mark       recording mark (tap, end of typing, ...)
  scene.anchors[].at         seconds after the scene starts that the narration describes it,
                             or "realtime" = as long after the scene start as it really took (capped to the scene end)
  endMark                    recording mark at the very end                                -> end of the video
Usage: python build_src.py <work-dir>
"""
import json
import sys
from pathlib import Path

work = Path(sys.argv[1]).resolve()
cfg = json.loads((work / "config.json").read_text(encoding="utf-8"))
timing = json.loads((work / "timing.json").read_text(encoding="utf-8"))
live = json.loads((work / "live" / "live.json").read_text(encoding="utf-8"))

S = timing["scenes"]
r0 = live["frames"][0]["ts"]
rel = lambda x: round(x - r0, 3)
marks = {k: rel(v) for k, v in live["marks"].items()}


def mark(name):
    if name not in marks:
        sys.exit(f"Mark '{name}' is in config.json but the recording never took it. Recorded marks: {sorted(marks)}")
    return marks[name]


anchors = []
for i, scene in enumerate(cfg["scenes"]):
    s = S[i]
    if scene.get("startMark"):
        anchors.append([s["start"], mark(scene["startMark"])])
    for a in scene.get("anchors", []):
        if a["at"] == "realtime":
            if not scene.get("startMark"):
                sys.exit(f"Scene {i + 1}: an anchor with at='realtime' needs the scene to have a startMark")
            v = min(s["start"] + (mark(a["mark"]) - mark(scene["startMark"])), s["end"] - 0.1)
        else:
            v = s["start"] + float(a["at"])
        anchors.append([round(v, 3), mark(a["mark"])])
anchors.append([timing["total"], mark(cfg["endMark"])])

speeds = []
for (o1, s1), (o2, s2) in zip(anchors, anchors[1:]):
    if not (o2 > o1 and s2 > s1):
        sys.exit(
            f"Anchors must move forward in both clocks, but got video {o1}->{o2}s and recording {s1}->{s2}s. "
            "Fix the 'at' values / marks order in config.json (or the order of mark() calls in the recording)."
        )
    speeds.append(round((s2 - s1) / (o2 - o1), 2))
print("playback speed per segment (1.0 = real time):", speeds)
if any(v > 2.5 or v < 0.4 for v in speeds):
    print("WARNING: a segment plays faster than 2.5x or slower than 0.4x. Re-pace the recording (waitForTimeout) or the narration so it looks natural.")

data = {
    "frames": [{"f": f["f"], "t": rel(f["ts"])} for f in live["frames"]],
    "taps": [{"t": rel(t["t"]), "x": t["x"], "y": t["y"]} for t in live["taps"]],
    "anchors": anchors,
    "vw": live["viewport"]["width"],
    "vh": live["viewport"]["height"],
}
(work / "src.js").write_text("window.SRC = " + json.dumps(data) + ";\n", encoding="utf-8")
print("frames", len(data["frames"]), "taps", len(data["taps"]), "marks", marks)
