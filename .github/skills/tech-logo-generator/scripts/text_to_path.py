#!/usr/bin/env python3
"""Turns text into outlined SVG paths with a real font file, so a wordmark looks identical everywhere (no font needed on the viewer's machine).

    python text_to_path.py --list-fonts                                   find usable font files on this machine
    python text_to_path.py --font Outfit-Bold.ttf --text "Lumora" --size 120 --tracking 4 --fill "#111827"
    python text_to_path.py --font F.ttf --text "Lumora" --size 120 --kern "Lu:-3,or:-2" --x 40 --y 160 --json

Prints one <path d="..." fill="..."/> element on stdout (paste it into the SVG), and with --json the metrics as well:
width, ascent, cap_height, x_height, baseline y, so the lockup can be laid out exactly. --svg-file writes a standalone preview SVG.
Units are SVG user units: --size is the em size, --x is the left edge of the first letter's origin, --y the baseline.
--tracking adds space between every letter (1/1000 em units: 20 = 0.02 em; negative tightens). --kern adds a per-pair adjustment in the same units.
Kerning tables inside the font (GPOS) are NOT applied: judge the letter pairs by eye in the render and add --kern for the ones that look loose
(typical: A/V/T/Y/L pairs, "r" followed by round letters). Use fonts with a licence that allows outlining and embedding (SIL OFL, Apache): see references/typography.md.
Needs fontTools (pip install fonttools).
"""
import argparse
import glob
import json
import os
import sys
from pathlib import Path


def need_fonttools():
    try:
        from fontTools.ttLib import TTFont  # noqa: F401
    except ImportError:
        import subprocess
        print("[text_to_path] installing fonttools ...", file=sys.stderr)
        r = subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "fonttools"], capture_output=True, text=True)
        if r.returncode != 0:
            sys.exit("ERROR: fontTools is missing and pip install fonttools failed:\n" + (r.stderr or r.stdout)[-300:])


def font_dirs():
    dirs = []
    if os.name == "nt":
        dirs += [os.path.expandvars(r"%WINDIR%\Fonts"), os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Windows\Fonts")]
    dirs += ["/usr/share/fonts", "/usr/local/share/fonts", os.path.expanduser("~/.fonts"), "/Library/Fonts", "/System/Library/Fonts"]
    # fonts shipped by the project itself: search upward from the current folder AND from this skill (it lives inside the project)
    for start in (Path.cwd(), Path(__file__).resolve().parent):
        for p in [start, *start.parents][:8]:
            for sub in ("fonts", "assets/fonts", "node_modules/@expo-google-fonts"):
                if (p / sub).is_dir() and str(p / sub) not in dirs:
                    dirs.append(str(p / sub))
    return dirs


def list_fonts(pattern=None):
    found = []
    for d in font_dirs():
        for ext in ("ttf", "otf"):
            found += glob.glob(os.path.join(d, "**", f"*.{ext}"), recursive=True)
    found = sorted(set(found))
    if pattern:
        found = [f for f in found if pattern.lower() in os.path.basename(f).lower()]
    return found


def outline(font_path, text, size, tracking=0, kern=None, x=0.0, y=0.0):
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.ttLib import TTFont

    font = TTFont(font_path, fontNumber=0)
    upm = font["head"].unitsPerEm
    scale = size / upm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font["hmtx"]
    kern = kern or {}
    num = lambda v: f"{v:.2f}".rstrip("0").rstrip(".")                   # noqa: E731
    d_parts, cursor, prev = [], 0.0, None
    for ch in text:
        if ch == " ":
            name = cmap.get(0x20)
            cursor += (hmtx[name][0] if name else upm * 0.25) * scale + tracking / 1000 * size
            prev = None
            continue
        name = cmap.get(ord(ch))
        if name is None:
            sys.exit(f"ERROR: the font has no glyph for {ch!r}")
        if prev is not None:
            cursor += kern.get(prev + ch, 0) / 1000 * size
        pen = SVGPathPen(gs, ntos=num)
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x + cursor, y)))
        cmd = pen.getCommands()
        if cmd:
            d_parts.append(cmd)
        cursor += hmtx[name][0] * scale + tracking / 1000 * size
        prev = ch
    width = cursor - tracking / 1000 * size                               # no trailing tracking
    os2 = font["OS/2"] if "OS/2" in font else None
    cap = getattr(os2, "sCapHeight", 0) or int(upm * 0.7)
    xh = getattr(os2, "sxHeight", 0) or int(upm * 0.5)
    return {
        "d": "".join(d_parts), "width": round(width, 2), "baseline": y, "cap_height": round(cap * scale, 2), "x_height": round(xh * scale, 2),
        "ascent": round(font["hhea"].ascent * scale, 2), "descent": round(-font["hhea"].descent * scale, 2),
    }


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--font", help="path to a .ttf / .otf file (or part of a file name from --list-fonts)")
    ap.add_argument("--text")
    ap.add_argument("--size", type=float, default=100)
    ap.add_argument("--tracking", type=float, default=0)
    ap.add_argument("--kern", default="", help='pair adjustments, e.g. "Lu:-3,or:-2" (1/1000 em)')
    ap.add_argument("--x", type=float, default=0)
    ap.add_argument("--y", type=float, default=0, help="baseline (default 0: shapes then sit above y=0; set e.g. --y 100)")
    ap.add_argument("--fill", default="#000000")
    ap.add_argument("--json", action="store_true", help="print metrics as JSON (the path is in 'd')")
    ap.add_argument("--svg-file", help="also write a standalone preview SVG")
    ap.add_argument("--list-fonts", nargs="?", const="", metavar="FILTER", help="list font files, optionally filtered by name")
    a = ap.parse_args(argv)
    need_fonttools()
    if a.list_fonts is not None:
        for f in list_fonts(a.list_fonts or None):
            print(f)
        return 0
    if not a.font or a.text is None:
        ap.error("--font and --text are required (or use --list-fonts)")
    font = a.font
    if not os.path.isfile(font):
        hits = list_fonts(font)
        if not hits:
            sys.exit(f"ERROR: no font file matches {font!r}; try --list-fonts")
        font = hits[0]
    kern = {}
    for part in filter(None, a.kern.split(",")):
        pair, val = part.split(":")
        kern[pair] = float(val)
    m = outline(font, a.text, a.size, a.tracking, kern, a.x, a.y)
    el = f'<path d="{m["d"]}" fill="{a.fill}"/>'
    if a.svg_file:
        pad = a.size * 0.3
        w, h = m["width"] + 2 * pad, a.y + m["descent"] + pad if a.y else a.size * 1.6
        top = a.y - m["ascent"] - pad if a.y else -pad
        Path(a.svg_file).write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{a.x - pad:.2f} {top:.2f} {w:.2f} {h - top:.2f}">{el}</svg>\n', encoding="utf-8")
    if a.json:
        print(json.dumps({**m, "font": os.path.basename(font), "element": el}))
    else:
        print(el)
        print(f"<!-- font {os.path.basename(font)}  width {m['width']}  cap-height {m['cap_height']}  x-height {m['x_height']}  baseline {m['baseline']} -->", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
