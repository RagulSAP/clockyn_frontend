#!/usr/bin/env python3
"""Render an SVG to PNG at several sizes, on transparent, light or dark backgrounds.

    python render.py icon.svg --sizes 16,32,64,128,256,512,1024            -> png/icon-16.png ...
    python render.py logo-horizontal.svg --scales 1,2 --base-width 640     -> png/logo-horizontal@1x.png, @2x.png
    python render.py icon.svg --sizes 512 --both-bg                        -> icon-512-on-light.png and icon-512-on-dark.png
    python render.py --check                                               -> says which renderer will be used

--sizes is the LONGEST side in pixels (the other side follows the viewBox). PNGs go to a png/ folder next to the SVG (or --out).
--bg transparent (default) | light | dark | #rrggbb

Renderer, first one that really works is used (a test render proves it, an import alone does not):
  cairosvg (pip install cairosvg; needs the Cairo library, which Windows usually lacks) -> resvg -> rsvg-convert -> inkscape ->
  Chromium through Playwright (python package, or the Node Playwright found in a node_modules up the tree).
Force one with --backend NAME. This file is also imported by build_package.py.
"""
import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

LIGHT_BG = "#FFFFFF"
DARK_BG = "#0B0F1A"
TEST_SVG = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8" fill="#336699"/></svg>'


def viewbox(svg_path):
    """(min_x, min_y, width, height) from the viewBox of the file; raises ValueError when there is none."""
    text = Path(svg_path).read_text(encoding="utf-8", errors="replace")
    m = re.search(r'viewBox\s*=\s*["\']\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*["\']', text)
    if not m:
        raise ValueError(f"{svg_path}: no viewBox (run validate.py)")
    return tuple(float(x) for x in m.groups())


def size_for(svg_path, longest):
    _, _, w, h = viewbox(svg_path)
    if w >= h:
        return int(longest), max(1, round(longest * h / w))
    return max(1, round(longest * w / h)), int(longest)


def bg_value(bg):
    if bg in (None, "", "transparent"):
        return None
    return {"light": LIGHT_BG, "dark": DARK_BG}.get(bg, bg)


# ---------------------------------------------------------------------------------------------------------- backends
def _run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"{os.path.basename(cmd[0])} failed: {(r.stderr or r.stdout).strip()[:300]}")


class CairoSvg:
    name = "cairosvg"

    def __init__(self):
        import cairosvg  # noqa: F401
        self.mod = cairosvg
        self.mod.svg2png(bytestring=TEST_SVG, output_width=8, output_height=8)   # fails here when the Cairo library is missing

    def render(self, jobs):
        for j in jobs:
            kw = dict(url=str(j["svg"]), write_to=str(j["out"]), output_width=j["width"], output_height=j["height"])
            if j["bg"]:
                kw["background_color"] = j["bg"]
            self.mod.svg2png(**kw)


class Resvg:
    name = "resvg"

    def __init__(self):
        self.exe = shutil.which("resvg")
        if not self.exe:
            raise RuntimeError("resvg not found")

    def render(self, jobs):
        for j in jobs:
            cmd = [self.exe, "-w", str(j["width"]), "-h", str(j["height"])]
            if j["bg"]:
                cmd += ["--background", j["bg"]]
            _run(cmd + [str(j["svg"]), str(j["out"])])


class Rsvg:
    name = "rsvg-convert"

    def __init__(self):
        self.exe = shutil.which("rsvg-convert")
        if not self.exe:
            raise RuntimeError("rsvg-convert not found")

    def render(self, jobs):
        for j in jobs:
            cmd = [self.exe, "-w", str(j["width"]), "-h", str(j["height"])]
            if j["bg"]:
                cmd += ["-b", j["bg"]]
            _run(cmd + ["-o", str(j["out"]), str(j["svg"])])


class Inkscape:
    name = "inkscape"

    def __init__(self):
        self.exe = shutil.which("inkscape")
        if not self.exe:
            raise RuntimeError("inkscape not found")

    def render(self, jobs):
        for j in jobs:
            cmd = [self.exe, str(j["svg"]), "--export-type=png", f"--export-filename={j['out']}", "-w", str(j["width"]), "-h", str(j["height"])]
            if j["bg"]:
                cmd += [f"--export-background={j['bg']}", "--export-background-opacity=1"]
            _run(cmd)


def _page_html(svg_path, w, h, bg):
    data = base64.b64encode(Path(svg_path).read_bytes()).decode("ascii")
    return (f'<!doctype html><html><body style="margin:0;background:{bg or "transparent"}">'
            f'<img src="data:image/svg+xml;base64,{data}" style="display:block;width:{w}px;height:{h}px"></body></html>')


class PlaywrightPy:
    name = "chromium (python playwright)"

    def __init__(self):
        from playwright.sync_api import sync_playwright
        self.sync_playwright = sync_playwright
        self.render([{"svg": _tmp_svg(), "out": Path(tempfile.gettempdir()) / "logo-render-test.png", "width": 8, "height": 8, "bg": None}])

    def render(self, jobs):
        with self.sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                for j in jobs:
                    page = browser.new_page(viewport={"width": j["width"], "height": j["height"]})
                    page.set_content(_page_html(j["svg"], j["width"], j["height"], j["bg"]))
                    page.screenshot(path=str(j["out"]), omit_background=not j["bg"])
                    page.close()
            finally:
                browser.close()

    def screenshot_html(self, html_path, out_png, width, height=900):
        with self.sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page(viewport={"width": width, "height": height})
                page.goto(Path(html_path).resolve().as_uri())
                page.wait_for_timeout(300)
                page.screenshot(path=str(out_png), full_page=True)
            finally:
                browser.close()


NODE_RENDER = r"""
const fs = require('fs');
const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const bases = JSON.parse(process.argv[3]);
function load() {
  for (const base of bases) for (const pkg of ['@playwright/test', 'playwright-core', 'playwright']) {
    try { return require(require.resolve(pkg, { paths: [base] })); } catch (e) { /* try the next */ }
  }
  throw new Error('Playwright not found');
}
const { chromium } = load();
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  for (const j of jobs) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: j.width, height: j.height });
    if (j.html_path) await page.goto('file:///' + j.html_path.replace(/\\/g, '/'));
    else await page.setContent(j.html);
    if (j.html_path) await page.waitForTimeout(300);
    await page.screenshot({ path: j.out, omitBackground: !j.bg && !j.html_path, fullPage: !!j.html_path });
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(3); });
"""


def _search_bases():
    bases, seen = [], set()
    for start in [Path.cwd(), Path(__file__).resolve().parent]:
        for p in [start, *start.parents][:9]:
            if (p / "node_modules").is_dir() and str(p) not in seen:
                seen.add(str(p))
                bases.append(str(p))
    return bases


class PlaywrightNode:
    name = "chromium (node playwright)"

    def __init__(self):
        self.node = shutil.which("node")
        if not self.node:
            raise RuntimeError("node not found")
        self.bases = _search_bases()
        if not self.bases:
            raise RuntimeError("no node_modules folder found above the current directory")
        self.render([{"svg": _tmp_svg(), "out": Path(tempfile.gettempdir()) / "logo-render-test.png", "width": 8, "height": 8, "bg": None}])

    def _run_jobs(self, js_jobs):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "jobs.json").write_text(json.dumps(js_jobs), encoding="utf-8")
            (Path(td) / "run.js").write_text(NODE_RENDER, encoding="utf-8")
            _run([self.node, str(Path(td) / "run.js"), str(Path(td) / "jobs.json"), json.dumps(self.bases)])

    def render(self, jobs):
        self._run_jobs([{"html": _page_html(j["svg"], j["width"], j["height"], j["bg"]), "out": str(j["out"]), "width": j["width"], "height": j["height"], "bg": j["bg"]}
                        for j in jobs])

    def screenshot_html(self, html_path, out_png, width, height=900):
        self._run_jobs([{"html_path": str(Path(html_path).resolve()), "out": str(out_png), "width": width, "height": height, "bg": "x"}])


def _tmp_svg():
    p = Path(tempfile.gettempdir()) / "logo-render-test.svg"
    p.write_bytes(TEST_SVG)
    return p


ORDER = [CairoSvg, Resvg, Rsvg, Inkscape, PlaywrightPy, PlaywrightNode]
_cache = {}


def pick_backend(name="auto", quiet=False):
    """The first renderer that passes a real test render. Raises RuntimeError with install hints when none does."""
    if name in _cache:
        return _cache[name]
    notes = []
    for cls in ORDER:
        short = cls.name.split(" ")[0]
        if name != "auto" and name not in (cls.name, short, cls.__name__.lower()):
            continue
        try:
            b = cls()
            _cache[name] = b
            if not quiet:
                print(f"[render] using {b.name}")
            return b
        except Exception as e:  # noqa: BLE001 - every failure just means "try the next renderer"
            notes.append(f"  - {cls.name}: {str(e).splitlines()[0][:110] if str(e) else type(e).__name__}")
    raise RuntimeError("No SVG renderer works on this machine. Tried:\n" + "\n".join(notes) + "\nInstall ONE of:\n"
                       "  pip install cairosvg   (Windows also needs the GTK/Cairo runtime)\n"
                       "  resvg or rsvg-convert or inkscape on PATH\n"
                       "  pip install playwright && playwright install chromium   (works everywhere)")


def render_many(jobs, backend="auto"):
    """jobs: dicts with svg, out, width, height, bg (None or '#rrggbb'). Creates the folders."""
    for j in jobs:
        Path(j["out"]).parent.mkdir(parents=True, exist_ok=True)
    pick_backend(backend).render(jobs)


# ---------------------------------------------------------------------------------------------------------- command line
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("svg", nargs="*", help="SVG file(s)")
    ap.add_argument("--sizes", help="longest side in px, comma separated, e.g. 16,32,64,128,256,512,1024")
    ap.add_argument("--scales", help="scale factors for lockups, e.g. 1,2 (needs --base-width)")
    ap.add_argument("--base-width", type=int, default=640, help="width in px at 1x for --scales (default 640)")
    ap.add_argument("--out", help="output folder (default: png/ next to each SVG)")
    ap.add_argument("--bg", default="transparent", help="transparent | light | dark | #rrggbb")
    ap.add_argument("--both-bg", action="store_true", help="make a light and a dark version of each size (names end -on-light / -on-dark)")
    ap.add_argument("--backend", default="auto", help="auto | cairosvg | resvg | rsvg-convert | inkscape | chromium")
    ap.add_argument("--check", action="store_true", help="only report which renderer would be used")
    a = ap.parse_args(argv)
    try:
        if a.check:
            pick_backend(a.backend)
            return 0
        if not a.svg or not (a.sizes or a.scales):
            ap.error("give at least one SVG and --sizes or --scales")
        jobs = []
        for s in a.svg:
            s = Path(s)
            out = Path(a.out) if a.out else s.parent / "png"
            variants = [("-on-light", "light"), ("-on-dark", "dark")] if a.both_bg else [("", a.bg)]
            for suffix, bg in variants:
                for size in [int(x) for x in a.sizes.split(",")] if a.sizes else []:
                    w, h = size_for(s, size)
                    jobs.append({"svg": s, "out": out / f"{s.stem}-{size}{suffix}.png", "width": w, "height": h, "bg": bg_value(bg)})
                for sc in [float(x) for x in a.scales.split(",")] if a.scales else []:
                    w, h = size_for(s, round(a.base_width * sc))
                    tag = f"@{sc:g}x"
                    jobs.append({"svg": s, "out": out / f"{s.stem}{tag}{suffix}.png", "width": w, "height": h, "bg": bg_value(bg)})
        render_many(jobs, a.backend)
        for j in jobs:
            print(f"wrote {j['out']}  {j['width']}x{j['height']}")
        return 0
    except (RuntimeError, ValueError, FileNotFoundError) as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
