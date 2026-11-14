#!/usr/bin/env python3
"""Builds the concept preview sheet and the final logo package for one company.

    python build_package.py lumora-labs --round v1 --preview     # concepts/*.svg -> preview.png (side by side, with the 16 px and one-colour tests)
    python build_package.py lumora-labs --round v1 --final       # package/*.svg  -> png/, favicon.ico, brand-sheet.html (+ .png)
    python build_package.py lumora-labs --round v1               # whichever of the two has its inputs

Folder layout (root defaults to ./logos, never overwritten between rounds: iterate with --round v2):
    <root>/<slug>/<round>/concepts/concept-a-<idea>.svg ...     the concepts you drew
    <root>/<slug>/<round>/preview.png                           made by --preview
    <root>/<slug>/<round>/package/                              the finished set; you write the SVGs and brand.json, this script adds the rest:
        icon.svg  wordmark.svg  logo-horizontal.svg  logo-stacked.svg  logo-mono-black.svg  logo-mono-white.svg  logo-on-dark.svg  favicon.svg
        brand.json                                              name, colours, font, clear space, minimum sizes (see references/ or --example-brand)
        emblem.svg (emblem style only)                          the mark alone on a transparent square: invoices, stamps, slides; also exported to png/emblem-*.png
    The emblem style (written by emblem.py) uses the same file names, so --final works for both styles; validate.py detects the style.
        png/  favicon.ico  brand-sheet.html  brand-sheet.png

--final stops with a clear list when a required SVG is missing or fails validate.py.
"""
import argparse
import colorsys
import json
import re
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import render as R          # noqa: E402
import validate as V        # noqa: E402

REQUIRED = {
    "icon.svg": "icon", "wordmark.svg": "wordmark", "logo-horizontal.svg": "lockup", "logo-stacked.svg": "lockup",
    "logo-mono-black.svg": "lockup", "logo-mono-white.svg": "lockup", "logo-on-dark.svg": "lockup", "favicon.svg": "icon",
}
ICON_SIZES = [16, 32, 64, 128, 256, 512, 1024]
EXAMPLE_BRAND = {
    "name": "Acme Labs", "slug": "acme-labs", "tagline": "",
    "colors": {"primary": "#4F46E5", "accent": "#22D3EE", "ink": "#0B1020", "paper": "#FFFFFF", "dark_bg": "#0B0F1A"},
    "font": {"family": "Outfit Bold (outlined)", "license": "SIL Open Font License", "outlined": True},
    "clear_space": 0.25, "min_size": {"icon_px": 16, "horizontal_px": 120, "stacked_px": 64},
    "concept": "one line on the idea behind the mark",
}


# ------------------------------------------------------------------------------------------------------ colour maths
def hex_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def luminance(h):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = hex_rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def verdict(ratio):
    return "AA text (4.5+)" if ratio >= 4.5 else "graphics only (3+)" if ratio >= 3 else "LOW (under 3)"


# ------------------------------------------------------------------------------------------------------ preview sheet
def load_font(size, bold=False):
    from PIL import ImageFont
    for name in (["segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold else ["segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"]):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def build_preview(base, backend):
    from PIL import Image, ImageDraw
    concepts = sorted((base / "concepts").glob("*.svg"))
    if not concepts:
        sys.exit(f"ERROR: no concepts in {base / 'concepts'} (write concept-a-<idea>.svg, concept-b-..., concept-c-...)")
    bad = False
    for c in concepts:
        errors, warnings = V.check(c)
        for e in errors:
            print(f"  {c.name}: ERROR {e}")
            bad = True
        for w in warnings:
            print(f"  {c.name}: warning {w}")
    if bad:
        sys.exit("Fix the validation errors above, then run --preview again.")
    tmp = Path(tempfile.mkdtemp(prefix="logo-preview-"))
    jobs = []
    for c in concepts:
        mono = c.parent / "mono" / c.name                   # emblem style: a real one-colour drawing instead of a silhouette
        for tag, size, bg in [("light", 360, "light"), ("dark", 360, "dark"), ("alpha", 360, None)] + [(f"s{n}", n, "light") for n in (16, 32, 64)]:
            src = mono if (tag == "alpha" and mono.is_file()) else c
            w, h = R.size_for(src, size)
            jobs.append({"svg": src, "out": tmp / f"{c.stem}-{tag}.png", "width": w, "height": h,
                         "bg": R.bg_value("light" if src is mono else bg)})
    R.render_many(jobs, backend)

    T = 360
    colw, pad, head = T + 60, 40, 70
    rows = [("on light", T), ("on dark", T), ("one colour (black on white)", T), ("small: 16 / 32 / 64 px as shipped, 16 px enlarged 8x", 150)]
    h_total = head + sum(r[1] + 52 for r in rows) + pad
    sheet = Image.new("RGB", (pad + len(concepts) * colw, h_total), (244, 245, 247))
    d = ImageDraw.Draw(sheet)
    fb, fm, fs = load_font(26, True), load_font(18), load_font(15)
    for i, c in enumerate(concepts):
        x0 = pad + i * colw
        d.text((x0, 24), c.stem, fill=(20, 24, 33), font=fb)
        y = head
        for label, hgt in rows:
            d.text((x0, y), label, fill=(95, 103, 118), font=fm)
            y += 28
            if label == "on light":
                im = Image.open(tmp / f"{c.stem}-light.png").convert("RGB")
                sheet.paste(im, (x0 + (T - im.width) // 2, y + (T - im.height) // 2))
            elif label == "on dark":
                im = Image.open(tmp / f"{c.stem}-dark.png").convert("RGB")
                sheet.paste(im, (x0 + (T - im.width) // 2, y + (T - im.height) // 2))
            elif label.startswith("one colour"):
                a = Image.open(tmp / f"{c.stem}-alpha.png").convert("RGBA")
                if (c.parent / "mono" / c.name).is_file():          # emblem style: the drawn one-colour version, already on white
                    tile = a.convert("RGB")
                else:
                    mask = a.split()[3].point(lambda v: 255 if v > 24 else 0)
                    tile = Image.new("RGB", a.size, (255, 255, 255))
                    tile.paste((0, 0, 0), mask=mask)
                sheet.paste(tile, (x0 + (T - tile.width) // 2, y + (T - tile.height) // 2))
            else:
                x = x0
                for n in (16, 32, 64):
                    im = Image.open(tmp / f"{c.stem}-s{n}.png").convert("RGB")
                    sheet.paste(im, (x, y + 8))
                    x += im.width + 18
                z = Image.open(tmp / f"{c.stem}-s16.png").convert("RGB")
                z = z.resize((z.width * 8, z.height * 8), Image.NEAREST)
                sheet.paste(z, (x + 10, y + 8))
            y += hgt + 24
        if i:
            d.line([(x0 - 24, 20), (x0 - 24, h_total - 20)], fill=(214, 218, 225), width=2)
    out = base / "preview.png"
    sheet.save(out)
    print(f"wrote {out}  ({len(concepts)} concepts)")
    return out


# ------------------------------------------------------------------------------------------------------ final package
def strip_prolog(svg_text):
    return re.sub(r"<\?xml[^>]*\?>|<!DOCTYPE[^>]*>", "", svg_text).strip()


def build_sheet_html(pkg, brand):
    colors = brand["colors"]
    paper, dark = colors.get("paper", "#FFFFFF"), colors.get("dark_bg", "#0B0F1A")
    svg = lambda n: strip_prolog((pkg / n).read_text(encoding="utf-8"))     # noqa: E731
    clear = float(brand.get("clear_space", 0.25))
    ms = brand.get("min_size", {})
    # second dark card: a dark-background stacked lockup when the package has one (logo-stacked-on-dark.svg), else the colour icon itself (an honest contrast test)
    dark_stacked = svg("logo-stacked-on-dark.svg") if (pkg / "logo-stacked-on-dark.svg").is_file() else svg("icon.svg")
    rows = ""
    for key, hexv in colors.items():
        cl, cd = contrast(hexv, paper), contrast(hexv, dark)
        if key in ("paper", "dark_bg"):                       # backgrounds: a contrast against themselves means nothing
            cells = '<td colspan="2"><small>background colour</small></td>'
        elif key == "ink":                                    # text colour for light backgrounds
            cells = f'<td>{cl:.1f}:1 on light<br><small>{verdict(cl)}</small></td><td><small>not used on dark</small></td>'
        else:
            cells = (f'<td>{cl:.1f}:1 on light<br><small>{verdict(cl)}</small></td>'
                     f'<td>{cd:.1f}:1 on dark<br><small>{verdict(cd)}</small></td>')
        rows += (f'<tr><td><span class="sw" style="background:{hexv}"></span></td><td><b>{key}</b></td><td>{hexv.upper()}</td>'
                 f'<td>{"rgb(%d, %d, %d)" % hex_rgb(hexv)}</td>{cells}</tr>')
    tiles = "".join(f'<div class="ic"><div class="icbox" style="width:{n}px;height:{n}px">{svg("icon.svg")}</div><small>{n}px</small></div>' for n in (16, 32, 48, 64, 96, 128))
    note = "Not trademark-cleared: run a trademark and image search before commercial use."
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{brand['name']} brand sheet</title>
<style>
body{{margin:0;font-family:'Segoe UI',Inter,Arial,sans-serif;background:#F4F5F7;color:#141821}}
.wrap{{max-width:1100px;margin:0 auto;padding:40px 28px 60px}} h1{{margin:0 0 4px;font-size:30px}} h2{{margin:42px 0 14px;font-size:16px;letter-spacing:.08em;text-transform:uppercase;color:#5F6776}}
.sub{{color:#5F6776;margin:0}} .grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}} .card{{border-radius:14px;padding:36px;display:flex;align-items:center;justify-content:center;min-height:150px}}
.light{{background:{paper};border:1px solid #DDE1E7}} .dark{{background:{dark}}} .card svg{{height:auto}}
.hz svg{{width:340px}} .st svg{{width:170px}} .ic{{display:inline-block;margin:0 22px 8px 0;text-align:center;vertical-align:bottom}} .icbox svg{{width:100%;height:100%;display:block}}
.ic small{{display:block;color:#5F6776;margin-top:6px}} table{{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}} td{{padding:10px 14px;border-bottom:1px solid #ECEFF3;font-size:14px}}
.sw{{display:inline-block;width:34px;height:34px;border-radius:8px;border:1px solid rgba(0,0,0,.12)}} small{{color:#5F6776}}
.cs{{position:relative;display:inline-block;padding:{clear * 100:.0f}px;border:2px dashed #7C8AA5;border-radius:6px;background:{paper}}} .cs svg{{width:300px;height:auto;display:block}}
.cs i{{position:absolute;font-style:normal;font-size:13px;color:#4B5568;background:#E8ECF4;border-radius:4px;padding:1px 6px}}
.box{{background:#fff;border:1px solid #DDE1E7;border-radius:12px;padding:20px 24px}} .mono svg{{width:230px}} .row3{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}}
</style></head><body><div class="wrap">
<h1>{brand['name']}</h1><p class="sub">Brand sheet. {brand.get('concept', '')}</p>
<h2>Logo on light and dark</h2>
<div class="grid"><div class="card light hz">{svg('logo-horizontal.svg')}</div><div class="card dark hz">{svg('logo-on-dark.svg')}</div>
<div class="card light st">{svg('logo-stacked.svg')}</div><div class="card dark st">{dark_stacked}</div></div>
<h2>Colours (hex, RGB and contrast)</h2><table>{rows}</table>
<p><small>WCAG: 3:1 is the minimum for graphics and large shapes, 4.5:1 for small text. A logo mark is a graphic.</small></p>
<h2>Icon sizes (as the SVG scales)</h2><div class="box">{tiles}</div>
<h2>Clear space and minimum size</h2>
<div class="grid"><div class="box"><div class="cs">{svg('logo-horizontal.svg')}<i style="top:6px;left:50%">x</i><i style="left:6px;top:50%">x</i></div>
<p>Keep a margin of <b>x = {clear * 100:.0f}% of the logo height</b> free on all sides: no text, edges or other logos inside the dashed line.</p></div>
<div class="box"><p><b>Minimum size</b></p><p>Icon: <b>{ms.get('icon_px', 16)} px</b> wide (screen)<br>Horizontal logo: <b>{ms.get('horizontal_px', 120)} px</b> wide<br>Stacked logo: <b>{ms.get('stacked_px', 64)} px</b> wide</p>
<p><small>Below these sizes use the icon alone.</small></p></div></div>
<h2>One-colour versions</h2><div class="row3"><div class="card light mono">{svg('logo-mono-black.svg')}</div><div class="card dark mono">{svg('logo-mono-white.svg')}</div>
<div class="box"><b>Typeface</b><br>{brand.get('font', {}).get('family', '')}<br><small>{brand.get('font', {}).get('license', '')}</small></div></div>
<p style="margin-top:34px"><small>{note}</small></p></div></body></html>"""


def build_final(base, backend, want_png_sheet=True):
    pkg = base / "package"
    brand_file = pkg / "brand.json"
    missing = [n for n in REQUIRED if not (pkg / n).is_file()]
    if not brand_file.is_file():
        missing.append("brand.json")
    if missing:
        print("Missing in", pkg)
        for m in missing:
            print("  -", m)
        print('brand.json example:\n' + json.dumps(EXAMPLE_BRAND, indent=2))
        sys.exit(1)
    brand = json.loads(brand_file.read_text(encoding="utf-8"))
    failed = False
    for name, kind in REQUIRED.items():
        errors, warnings = V.check(pkg / name, kind)
        for e in errors:
            print(f"  {name}: ERROR {e}")
            failed = True
        for w in warnings:
            print(f"  {name}: warning {w}")
    if failed:
        sys.exit("Fix the validation errors above, then run --final again.")

    png = pkg / "png"
    jobs = []
    for n in ICON_SIZES:
        w, h = R.size_for(pkg / "icon.svg", n)
        jobs.append({"svg": pkg / "icon.svg", "out": png / f"icon-{n}.png", "width": w, "height": h, "bg": None})
    for name in ("logo-horizontal", "logo-stacked", "logo-on-dark"):
        for sc in (1, 2):
            w, h = R.size_for(pkg / f"{name}.svg", 640 * sc if name != "logo-stacked" else 480 * sc)
            jobs.append({"svg": pkg / f"{name}.svg", "out": png / f"{name}@{sc}x.png", "width": w, "height": h, "bg": None})
    for name, bg in (("logo-mono-black", "light"), ("logo-mono-white", "dark")):
        w, h = R.size_for(pkg / f"{name}.svg", 640)
        jobs.append({"svg": pkg / f"{name}.svg", "out": png / f"{name}@1x.png", "width": w, "height": h, "bg": R.bg_value(bg)})
    for n in (16, 32, 48):
        jobs.append({"svg": pkg / "favicon.svg", "out": png / f"favicon-{n}.png", "width": n, "height": n, "bg": None})
    if (pkg / "emblem.svg").is_file():                       # emblem style: the mark alone, transparent
        errors, warnings = V.check(pkg / "emblem.svg", "icon")
        if errors:
            sys.exit("emblem.svg: " + "; ".join(errors))
        for n in (256, 512, 1024):
            w, h = R.size_for(pkg / "emblem.svg", n)
            jobs.append({"svg": pkg / "emblem.svg", "out": png / f"emblem-{n}.png", "width": w, "height": h, "bg": None})
    R.render_many(jobs, backend)

    from PIL import Image
    frames = [Image.open(png / f"favicon-{n}.png").convert("RGBA") for n in (16, 32, 48)]
    base_img = Image.open(png / "icon-256.png").convert("RGBA")
    base_img.save(pkg / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)], append_images=frames)

    html = pkg / "brand-sheet.html"
    html.write_text(build_sheet_html(pkg, brand), encoding="utf-8")
    sheet_png = None
    try:
        b = R.pick_backend(backend, quiet=True)
        if want_png_sheet and hasattr(b, "screenshot_html"):
            sheet_png = pkg / "brand-sheet.png"
            b.screenshot_html(html, sheet_png, 1160, 900)
    except Exception as e:  # noqa: BLE001
        print(f"note: brand-sheet.png skipped ({str(e).splitlines()[0][:100]}); open brand-sheet.html in a browser")

    low = [(k, round(contrast(v, brand["colors"].get("paper", "#FFFFFF")), 1)) for k, v in brand["colors"].items()
           if k in (("primary",) if brand.get("style") == "emblem" else ("primary", "accent"))      # emblem style: the accent only sits on the dark card
           and contrast(v, brand["colors"].get("paper", "#FFFFFF")) < 3]
    for k, r in low:
        print(f"note: {k} colour has only {r}:1 contrast on the light background (aim for 3:1+ for the mark)")
    print(f"\n{pkg}")
    for p in sorted(pkg.rglob("*")):
        if p.is_file():
            print(f"  {p.relative_to(pkg)}  ({p.stat().st_size / 1024:.1f} KB)")
    print("\nNot trademark-cleared: run a trademark and image search before commercial use.")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug", nargs="?", help="company slug, lowercase-hyphen, e.g. lumora-labs")
    ap.add_argument("--round", default="v1", help="v1, v2 ... (never overwritten between rounds)")
    ap.add_argument("--root", default="logos", help="output root (default ./logos)")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--final", action="store_true")
    ap.add_argument("--backend", default="auto")
    ap.add_argument("--no-sheet-png", action="store_true")
    ap.add_argument("--example-brand", action="store_true", help="print an example brand.json and exit")
    a = ap.parse_args(argv)
    if a.example_brand:
        print(json.dumps(EXAMPLE_BRAND, indent=2))
        return 0
    if not a.slug or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", a.slug):
        ap.error("give a lowercase-hyphen slug, e.g. lumora-labs")
    base = Path(a.root) / a.slug / a.round
    do_prev = a.preview or (not a.final and (base / "concepts").is_dir())
    do_final = a.final or (not a.preview and (base / "package").is_dir())
    if not (do_prev or do_final):
        ap.error(f"nothing to build: put concept SVGs in {base / 'concepts'} or the package SVGs in {base / 'package'}")
    try:
        if do_prev:
            build_preview(base, a.backend)
        if do_final:
            build_final(base, a.backend, not a.no_sheet_png)
    except (RuntimeError, ValueError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
