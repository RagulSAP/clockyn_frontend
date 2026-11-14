#!/usr/bin/env python3
"""Builds the wordmark and every lockup of the package from icon.svg and an outlined wordmark, so the geometry is exact and consistent.

    python compose_lockups.py logos/acme/v1/package --name Acme --descriptor Labs \
        --font-bold Outfit_700Bold.ttf --font-regular Outfit_400Regular.ttf \
        --ink "#0B1020" --on-dark-ink "#FFFFFF" \
        --on-dark-map "#4F46E5:#A5B4FC,#8B5CF6:#C4B5FD,#0B1020:#22D3EE"

Reads   <package>/icon.svg                    (your mark, viewBox 0 0 512 512, flat fills)
Writes  wordmark.svg, logo-horizontal.svg, logo-stacked.svg, logo-mono-black.svg, logo-mono-white.svg, logo-on-dark.svg, logo-stacked-on-dark.svg
        (favicon.svg is yours to draw: a simplified icon. With --favicon-from-icon it is copied from icon.svg.)

Rules built in (references/design-principles.md section 9): horizontal wordmark cap height = 0.55 x icon height, gap = 0.25 x icon height, wordmark
centred on the icon; stacked: gap 0.08 x icon canvas height (the canvas already holds ~10% padding), wordmark width 1.35 x icon width. Text is outlined (no font needed to view the files).
--name is set in the bold font, --descriptor (optional, e.g. Labs) in the regular font, same size, one baseline;
--descriptor-gap 0 joins them into one word (Auro + Cloud = AuroCloud, two weights).
--on-dark-map recolours the icon for dark backgrounds (old:new pairs); fills not listed stay as they are.
"""
import argparse
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import text_to_path as T  # noqa: E402


def read_icon(path):
    text = Path(path).read_text(encoding="utf-8")
    m = re.search(r"<svg[^>]*>(.*)</svg>", text, re.S)
    if not m:
        sys.exit(f"ERROR: {path} has no <svg> element")
    vb = re.search(r'viewBox="([^"]+)"', text)
    box = [float(x) for x in re.split(r"[\s,]+", vb.group(1).strip())] if vb else [0, 0, 512, 512]
    return m.group(1).strip(), box


def recolor(markup, mapping=None, single=None):
    """Replace fill / stroke colours: by a map (old:new) or all to one colour."""
    def swap(m):
        attr, val = m.group(1), m.group(2)
        if val.lower() in ("none", "currentcolor") or val.startswith("url("):
            return m.group(0)
        if single:
            return f'{attr}="{single}"'
        return f'{attr}="{(mapping or {}).get(val.upper(), (mapping or {}).get(val.lower(), val))}"'
    return re.sub(r'\b(fill|stroke)="([^"]*)"', swap, markup)


def parse_map(s):
    out = {}
    for part in filter(None, (s or "").split(",")):
        a, b = part.split(":")
        out[a.strip().upper()] = b.strip()
    return out


def wordmark_parts(a, size):
    """Outline name (bold) + descriptor (regular) on one baseline at y=0. Returns paths (list of (d, which)) and width, cap height."""
    bold = T.outline(a.font_bold, a.name, size, a.tracking, {}, 0, 0)
    parts = [(bold["d"], "name")]
    width, cap = bold["width"], bold["cap_height"]
    if a.descriptor:
        gap = size * a.descriptor_gap
        reg = T.outline(a.font_regular or a.font_bold, a.descriptor, size, a.tracking, {}, width + gap, 0)
        parts.append((reg["d"], "desc"))
        width = width + gap + reg["width"]
    return parts, width, cap, bold["ascent"], bold["descent"]


def svg_doc(w, h, body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}">\n{body}\n</svg>\n'


def paths(parts, y, x, ink, desc_ink):
    return "".join(f'<path transform="translate({x:.2f} {y:.2f})" d="{d}" fill="{desc_ink if which == "desc" else ink}"/>' for d, which in parts)


def build(a):
    pkg = Path(a.package)
    icon_markup, box = read_icon(pkg / "icon.svg")
    H = 240.0
    s = H / box[3]
    icon_w = box[2] * s
    ink, dark_ink = a.ink, a.on_dark_ink
    desc_ink, dark_desc = a.descriptor_color or ink, a.on_dark_descriptor_color or dark_ink
    dmap = parse_map(a.on_dark_map)

    def icon_g(x, y, markup):
        return f'<g transform="translate({x:g} {y:g}) scale({s:.5f})">{markup}</g>'

    # horizontal: wordmark cap height = 0.55 H
    probe, _, cap100, asc100, desc100 = wordmark_parts(a, 100)
    size_h = 0.55 * H / (cap100 / 100)
    parts_h, w_h, cap_h, asc_h, descent_h = wordmark_parts(a, size_h)
    gap = 0.25 * H
    base_y = H / 2 + cap_h / 2
    total_w = round(icon_w + gap + w_h, 2)
    top = min(0, base_y - asc_h * 0.9)
    bottom = max(H, base_y + descent_h * 0.55)
    vb_y, vb_h = round(top, 2), round(bottom - top, 2)

    def horizontal(i_markup, ink_c, desc_c):
        body = icon_g(0, 0, i_markup) + paths(parts_h, base_y, icon_w + gap, ink_c, desc_c)
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {vb_y:g} {total_w:g} {vb_h:g}">\n{body}\n</svg>\n'

    # stacked: wordmark width = 1.35 x icon width
    _, w100, _, _, _ = wordmark_parts(a, 100)
    size_s = 1.35 * icon_w / (w100 / 100)
    parts_s, w_s, cap_s, asc_s, desc_s = wordmark_parts(a, size_s)
    gap_s = 0.08 * H                       # measured from the icon canvas, which already holds ~10% safe-zone padding
    W_s = round(max(icon_w, w_s), 2)
    base_s = H + gap_s + cap_s
    H_s = round(base_s + desc_s * 0.5, 2)

    def stacked(i_markup, ink_c, desc_c):
        body = icon_g((W_s - icon_w) / 2, 0, i_markup) + paths(parts_s, base_s, (W_s - w_s) / 2, ink_c, desc_c)
        return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W_s:g} {H_s:g}">\n{body}\n</svg>\n'

    # wordmark alone (cap height 0.55 of 240 = 132 px tall caps)
    wm_h = round(cap_h + asc_h * 0.2 + descent_h * 0.55, 2)
    wm_base = round(cap_h + asc_h * 0.1, 2)
    wordmark = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w_h:g} {wm_h:g}">\n'
                f'{paths(parts_h, wm_base, 0, ink, desc_ink)}\n</svg>\n')

    out = {
        "wordmark.svg": wordmark,
        "logo-horizontal.svg": horizontal(icon_markup, ink, desc_ink),
        "logo-stacked.svg": stacked(icon_markup, ink, desc_ink),
        "logo-mono-black.svg": horizontal(recolor(icon_markup, single="#000000"), "#000000", "#000000"),
        "logo-mono-white.svg": horizontal(recolor(icon_markup, single="#FFFFFF"), "#FFFFFF", "#FFFFFF"),
        "logo-on-dark.svg": horizontal(recolor(icon_markup, dmap), dark_ink, dark_desc),
        "logo-stacked-on-dark.svg": stacked(recolor(icon_markup, dmap), dark_ink, dark_desc),
    }
    if a.favicon_from_icon:
        out["favicon.svg"] = (pkg / "icon.svg").read_text(encoding="utf-8")
    for name, text in out.items():
        (pkg / name).write_text(text, encoding="utf-8")
        print(f"wrote {pkg / name}")
    print(f"font sizes: horizontal {size_h:.1f}, stacked {size_s:.1f}; icon {icon_w:g} x {H:g} inside the lockups")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("package", help="the package folder holding icon.svg")
    ap.add_argument("--name", required=True)
    ap.add_argument("--descriptor", default="", help="optional second word, e.g. Labs, set in the regular weight")
    ap.add_argument("--font-bold", required=True, help="font file (or a file-name fragment from text_to_path.py --list-fonts)")
    ap.add_argument("--font-regular")
    ap.add_argument("--descriptor-gap", type=float, default=0.28, help="space between name and descriptor in em (default 0.28; use 0 for one compound word such as Auro+Cloud)")
    ap.add_argument("--tracking", type=float, default=6, help="letter spacing in 1/1000 em (default 6)")
    ap.add_argument("--ink", default="#0B1020")
    ap.add_argument("--descriptor-color")
    ap.add_argument("--on-dark-ink", default="#FFFFFF")
    ap.add_argument("--on-dark-descriptor-color")
    ap.add_argument("--on-dark-map", default="", help='icon colours for dark backgrounds, "old:new,old:new"')
    ap.add_argument("--favicon-from-icon", action="store_true")
    a = ap.parse_args(argv)
    T.need_fonttools()
    for k in ("font_bold", "font_regular"):
        v = getattr(a, k)
        if v and not Path(v).is_file():
            hits = T.list_fonts(v)
            if not hits:
                sys.exit(f"ERROR: no font file matches {v!r}; use text_to_path.py --list-fonts")
            setattr(a, k, hits[0])
    build(a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
