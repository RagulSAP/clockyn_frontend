#!/usr/bin/env python
"""Checks the finished store images against the store rules, removes any alpha channel, and writes review sheets.

Usage: python validate.py <work-dir>

For every set in <work>/out/<store>/<size-id>/ it checks: exact pixel size (Apple: exact list, Google: 320-3840 px and at most 2:1),
RGB without alpha (a PNG with an alpha channel is flattened IN PLACE: both stores want no transparency), file size, and the number of
images the store takes. It writes <work>/out/overview/<store>-<size-id>.png (all images of a set side by side, to judge the story and
the flow) and <work>/out/manifest.json (the upload order). Exit code 1 when anything must be fixed.
"""
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
work = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
out = os.path.join(work, "out")
targets = json.load(open(os.path.join(HERE, "targets.json"), encoding="utf-8"))
cfg = json.load(open(os.path.join(work, "config.json"), encoding="utf-8"))

errors, warnings, manifest = [], [], {}


def flatten(path):
    """RGB, no alpha; returns True when the file had to be changed."""
    im = Image.open(path)
    if im.mode == "RGB":
        return False
    bg = Image.new("RGB", im.size, (255, 255, 255))
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im = im.convert("RGBA")
        bg.paste(im, mask=im.split()[3])
    else:
        bg = im.convert("RGB")
    bg.save(path, "PNG", optimize=True)
    return True


def size_ok(store_id, target, w, h):
    if store_id == "play":
        return 320 <= w <= 3840 and 320 <= h <= 3840 and max(w, h) <= 2 * min(w, h)
    allowed = [(target["width"], target["height"])] + [tuple(x) for x in target.get("alsoAccepted", [])]
    return (w, h) in allowed


def check_file(store_id, store, target, path):
    name = os.path.relpath(path, out)
    with Image.open(path) as im:
        w, h = im.size
    if not size_ok(store_id, target, w, h):
        errors.append(f"{name}: {w}x{h} is not an accepted size for {target.get('label', target['id'])} ({target['width']}x{target['height']})")
    if flatten(path):
        warnings.append(f"{name}: alpha channel removed (both stores want no transparency)")
    kb = os.path.getsize(path)
    if kb > store.get("maxBytes", 8 * 1024 * 1024):
        errors.append(f"{name}: {kb / 1048576:.1f} MB is over the limit of {store['maxBytes'] / 1048576:.0f} MB")
    return kb


def sheet(store_id, target, files):
    ims = [Image.open(f).convert("RGB") for f in files]
    th = 1000
    thumbs = [im.resize((max(1, round(im.width * th / im.height)), th), Image.LANCZOS) for im in ims]
    gap, pad = 36, 48
    wtot = sum(t.width for t in thumbs) + gap * (len(thumbs) - 1) + 2 * pad
    sheet_im = Image.new("RGB", (wtot, th + 2 * pad), (22, 24, 27))
    x = pad
    for t in thumbs:
        sheet_im.paste(t, (x, pad))
        x += t.width + gap
    os.makedirs(os.path.join(out, "overview"), exist_ok=True)
    p = os.path.join(out, "overview", f"{store_id}-{target['id']}.png")
    sheet_im.save(p, "PNG", optimize=True)
    return p


if not os.path.isdir(out):
    print("nothing to check: run compose.mjs first")
    sys.exit(1)

for store_id, store in targets["stores"].items():
    sdir = os.path.join(out, store_id)
    if not os.path.isdir(sdir):
        continue
    manifest[store_id] = {"uploadPath": store["uploadPath"], "sets": {}, "graphics": []}
    for target in store["targets"]:
        d = os.path.join(sdir, target["id"])
        files = sorted(os.path.join(d, f) for f in os.listdir(d) if f.lower().endswith(".png")) if os.path.isdir(d) else []
        if not files:
            if target.get("required") is True:
                errors.append(f"{store['label']}: no images for the REQUIRED set '{target['label']}' ({target['id']})")
            elif target.get("required"):
                warnings.append(f"{store['label']}: no images for '{target['label']}' ({target['required']})")
            continue
        for f in files:
            check_file(store_id, store, target, f)
        if len(files) < store["minCount"]:
            errors.append(f"{store['label']} / {target['label']}: {len(files)} image(s), the store needs at least {store['minCount']}")
        if len(files) > store["maxCount"]:
            errors.append(f"{store['label']} / {target['label']}: {len(files)} image(s), the store takes at most {store['maxCount']}")
        sheet_path = sheet(store_id, target, files)
        manifest[store_id]["sets"][target["id"]] = {
            "label": target["label"], "size": f"{target['width']}x{target['height']}", "note": target.get("note", ""),
            "uploadOrder": [os.path.relpath(f, out) for f in files], "overview": os.path.relpath(sheet_path, out),
        }
    for g in store.get("graphics", []):
        f = os.path.join(sdir, "graphics", g["id"] + ".png")
        if not os.path.isfile(f):
            if g.get("required"):
                errors.append(f"{store['label']}: missing {g['label']} ({g['width']}x{g['height']})")
            continue
        with Image.open(f) as im:
            if im.size != (g["width"], g["height"]):
                errors.append(f"{os.path.relpath(f, out)}: {im.size[0]}x{im.size[1]}, expected {g['width']}x{g['height']}")
        if flatten(f):
            warnings.append(f"{os.path.relpath(f, out)}: alpha channel removed")
        if g["id"] == "app-icon-512" and os.path.getsize(f) > 1024 * 1024:
            errors.append(f"{os.path.relpath(f, out)}: over 1024 KB")
        manifest[store_id]["graphics"].append({"id": g["id"], "label": g["label"], "file": os.path.relpath(f, out), "note": g.get("note", "")})

# capture failures recorded by the capture step
rep = os.path.join(work, "raw", "report")
if os.path.isdir(rep):
    for f in sorted(os.listdir(rep)):
        r = json.load(open(os.path.join(rep, f), encoding="utf-8"))
        if not r.get("ok"):
            warnings.append(f"capture {f[:-5]}: {r.get('error', 'failed')}")
        for w in r.get("warn", []):
            warnings.append(f"capture {f[:-5]}: {w}")

json.dump(manifest, open(os.path.join(out, "manifest.json"), "w", encoding="utf-8"), indent=2)

print("\nSTORE IMAGE CHECK")
for sid, m in manifest.items():
    print(f"\n{targets['stores'][sid]['label']}  ->  {m['uploadPath']}")
    for tid, s in m["sets"].items():
        print(f"  {s['label']:<18} {s['size']:<10} {len(s['uploadOrder'])} image(s)   overview: {s['overview']}")
    for g in m["graphics"]:
        print(f"  {g['label']:<18} {g['file']}")
for w in warnings:
    print("  note:", w)
if errors:
    print("\nFIX THESE:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("\nOK: every image has an accepted size, no transparency, and the counts are within the store limits.")
