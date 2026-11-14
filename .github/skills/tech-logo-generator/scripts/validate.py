#!/usr/bin/env python3
"""Checks that a logo SVG is safe, portable and simple enough. Exit code 0 = pass, 1 = errors (or warnings with --strict), 2 = bad usage.

    python validate.py icon.svg
    python validate.py logos/acme/v1/package/*.svg --kind icon
    python validate.py wordmark.svg --kind wordmark --strict

ERRORS (the file must be fixed):
  not well-formed XML, root is not <svg>, no valid viewBox, an external reference (href / xlink:href / url() that is not '#id', @import),
  an embedded raster (<image>, data:image/...), <script>, <foreignObject>, <iframe>, any <filter> or filter="", file over --max-kb (150, emblem 400).
WARNINGS (judge them; --strict turns them into errors):
  fixed width/height on <svg> (the file should scale from the viewBox), <text> (depends on installed fonts: outline it with text_to_path.py),
  more than --max-shapes shapes (default 8 for --kind icon), more than 3 distinct colours, a gradient with more than 2 stops,
  strokes thinner than 1.5% of the viewBox (vanish at 16 px), opacity / blend modes (the colour changes with the background).
--kind icon | lockup | wordmark | any   (icon is held to the shape limit; lockups and wordmarks made of outlined text are not)
--style minimal | emblem | auto          (default auto). minimal = flat logos (<= 3 colours, 2-stop gradients, no opacity, 8 shapes).
    emblem = the illustrated emblem style of emblem.py: 3-stop gradient, clipPath, glyph texture in opacity tiers, up to 12 colours,
    no shape limit, files up to 400 KB. auto picks emblem when the file uses clip-path or a 3-stop gradient. The safety errors
    (external references, raster, scripts, filters) apply to both.
"""
import argparse
import glob
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SHAPES = {"path", "circle", "rect", "ellipse", "polygon", "polyline", "line"}
FORBIDDEN = {"image": "embedded image", "script": "script", "foreignobject": "foreignObject", "iframe": "iframe", "filter": "filter",
             "feimage": "feImage"}
NAMED = {"black": "#000000", "white": "#ffffff", "red": "#ff0000", "blue": "#0000ff", "green": "#008000", "gray": "#808080", "grey": "#808080"}


def local(tag):
    return tag.rsplit("}", 1)[-1].lower()


def norm_color(v):
    v = v.strip().lower()
    if v in ("", "none", "transparent", "inherit", "currentcolor") or v.startswith("url("):
        return None
    if v in NAMED:
        return NAMED[v]
    if re.fullmatch(r"#[0-9a-f]{3}", v):
        return "#" + "".join(c * 2 for c in v[1:])
    if re.fullmatch(r"#[0-9a-f]{6}([0-9a-f]{2})?", v):
        return v[:7]
    m = re.fullmatch(r"rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+).*\)", v)
    if m:
        return "#%02x%02x%02x" % tuple(min(255, int(x)) for x in m.groups())
    return v


def declarations(el):
    """attribute values plus declarations inside style=""."""
    d = {k.rsplit("}", 1)[-1]: v for k, v in el.attrib.items()}
    for part in d.get("style", "").split(";"):
        if ":" in part:
            k, v = part.split(":", 1)
            d[k.strip().lower()] = v.strip()
    return d


def detect_style(text):
    return "emblem" if ("clip-path" in text or text.count("<stop") >= 3) else "minimal"


def check(path, kind="any", max_kb=None, max_shapes=None, style="auto"):
    errors, warnings = [], []
    p = Path(path)
    if not p.is_file():
        return [f"file not found: {p}"], []
    raw = p.read_bytes()
    kb = len(raw) / 1024
    if style == "auto":
        style = detect_style(raw.decode("utf-8", errors="replace"))
    emblem = style == "emblem"
    if max_kb is None:
        max_kb = 400 if emblem else 150
    max_stops, max_colors = (3, 12) if emblem else (2, 3)
    if kb > max_kb:
        errors.append(f"file is {kb:.0f} KB (limit {max_kb} KB): simplify the geometry or round the path numbers")
    elif kb > max_kb / 3:
        warnings.append(f"file is {kb:.0f} KB: large for a logo; round coordinates to 1-2 decimals")
    text = raw.decode("utf-8", errors="replace")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        return [f"not well-formed XML: {e}"], []
    if local(root.tag) != "svg":
        return [f"root element is <{local(root.tag)}>, not <svg>"], []

    vb = root.attrib.get("viewBox", "")
    nums = re.split(r"[\s,]+", vb.strip()) if vb else []
    try:
        vbv = [float(x) for x in nums]
        if len(vbv) != 4 or vbv[2] <= 0 or vbv[3] <= 0:
            raise ValueError
    except ValueError:
        errors.append(f'missing or invalid viewBox ("{vb}"): use e.g. viewBox="0 0 512 512"')
        vbv = [0, 0, 512, 512]
    for attr in ("width", "height"):
        if attr in root.attrib and not root.attrib[attr].strip().endswith("%"):
            warnings.append(f'fixed {attr}="{root.attrib[attr]}" on <svg>: remove it so the logo scales from the viewBox')

    if re.search(r"data:image/", text, re.I):
        errors.append("contains a data:image/... embed (raster or encoded image): draw it as vector shapes")
    if re.search(r"@import|@font-face", text, re.I):
        errors.append("contains @import / @font-face: no external or embedded fonts, outline the text instead")
    for m in re.finditer(r"url\(\s*['\"]?([^)'\"]*)", text):
        if not m.group(1).startswith("#"):
            errors.append(f"external or non-local reference url({m.group(1)[:50]})")

    colors, shapes, texts, gradients, thin = set(), 0, 0, 0, 0
    min_stroke = 0.015 * min(vbv[2], vbv[3])
    for el in root.iter():
        t = local(el.tag)
        if t in FORBIDDEN:
            errors.append(f"<{t}> is not allowed ({FORBIDDEN[t]}): renders differently or not at all in common tools")
        for k, v in el.attrib.items():
            if k.rsplit("}", 1)[-1] == "href" and not v.startswith("#"):
                errors.append(f"external reference href=\"{v[:50]}\"")
        d = declarations(el)
        if "filter" in d and d["filter"].strip().lower() != "none":
            errors.append(f'filter="{d["filter"][:30]}" on <{t}>: filters break in common renderers')
        if t in SHAPES:
            shapes += 1
        if t == "text":
            texts += 1
        if t in ("lineargradient", "radialgradient"):
            gradients += 1
            stops = [c for c in el if local(c.tag) == "stop"]
            if len(stops) > max_stops:
                warnings.append(f"gradient #{el.attrib.get('id', '?')} has {len(stops)} stops (max {max_stops}" + ("" if emblem else ", subtle, with a flat fallback") + ")")
        for key in ("fill", "stroke", "stop-color"):
            if key in d:
                c = norm_color(d[key])
                if c:
                    colors.add(c)
        if "stroke-width" in d and t not in ("lineargradient", "radialgradient"):
            try:
                if d.get("stroke", "none") != "none" and float(re.match(r"[\d.]+", d["stroke-width"]).group()) < min_stroke:
                    thin += 1
            except (AttributeError, ValueError):
                pass
        if not emblem and any(k in d for k in ("opacity", "fill-opacity", "stroke-opacity", "mix-blend-mode")):
            try:
                vals = [float(d[k]) for k in ("opacity", "fill-opacity", "stroke-opacity") if k in d]
            except ValueError:
                vals = []
            if "mix-blend-mode" in d or any(v < 1 for v in vals):
                warnings.append(f"<{t}> uses opacity / blend: the colour shifts with the background (use a solid colour per shape)")
    if texts:
        warnings.append(f"{texts} <text> element(s): the logo depends on installed fonts; outline with text_to_path.py (or flag the font stack)")
    limit = max_shapes if max_shapes is not None else (8 if kind == "icon" and not emblem else None)
    if limit is not None and shapes > limit:
        warnings.append(f"{shapes} shapes (limit {limit} for a mark): one clear idea, fewer pieces")
    if shapes == 0:
        errors.append("no drawable shapes found")
    if len(colors) > max_colors:
        warnings.append(f"{len(colors)} distinct colours ({', '.join(sorted(colors))}): keep the primary version to {max_colors}" + ("" if emblem else " or fewer"))
    if thin and not emblem:
        warnings.append(f"{thin} stroke(s) thinner than 1.5% of the viewBox: they vanish at 16 px")
    return errors, sorted(set(warnings), key=warnings.index)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", help="SVG files (globs allowed)")
    ap.add_argument("--kind", default="any", choices=["icon", "lockup", "wordmark", "any"])
    ap.add_argument("--max-kb", type=float, help="size limit in KB (default 150 minimal, 400 emblem)")
    ap.add_argument("--style", default="auto", choices=["auto", "minimal", "emblem"])
    ap.add_argument("--max-shapes", type=int)
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    a = ap.parse_args(argv)
    files = []
    for f in a.files:
        files += sorted(glob.glob(f)) or [f]
    bad = 0
    for f in files:
        errors, warnings = check(f, a.kind, a.max_kb, a.max_shapes, a.style)
        status = "FAIL" if errors or (a.strict and warnings) else ("warn" if warnings else "ok")
        print(f"[{status}] {f}")
        for e in errors:
            print(f"    ERROR   {e}")
        for w in warnings:
            print(f"    warning {w}")
        bad += status == "FAIL"
    if bad:
        print(f"\n{bad} of {len(files)} file(s) failed.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
