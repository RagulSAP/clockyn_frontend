#!/usr/bin/env python3
"""Draws the ILLUSTRATED EMBLEM logo style (the default of this skill) and builds its whole package from a few choices.

The style: a big silhouette filled with a 3-stop gradient (a cloud, shield, disc ...), a texture of white glyphs in three
opacity tiers clipped inside it (binary digits, hex, dots, lines), a dark "device" card with a white outline lying over it
(server, phone, dashboard, chart, initial), a two-tone bold wordmark with a spaced light-caps descriptor, a dark rounded-square
app icon and a dark-background version. Everything is plain SVG paths (text outlined), no filters, no raster.

    python emblem.py list                                              silhouettes, objects, textures, palettes
    python emblem.py concept OUT.svg --silhouette cloud --object server --texture binary --palette aurora
    python emblem.py package logos/acme/v1/package --name AuroCloud --descriptor TECHNOLOGIES \
        --silhouette cloud --object server --texture binary --palette aurora --concept "a data cloud with a server"

`concept` writes one square, transparent emblem (for concepts/ and the preview sheet) plus its one-colour version in mono/.
`package` writes  emblem.svg  icon.svg (dark tile)  favicon.svg  wordmark.svg  logo-horizontal.svg  logo-stacked.svg
                  logo-on-dark.svg  logo-stacked-on-dark.svg  logo-mono-black.svg  logo-mono-white.svg  brand.json
then run:  python build_package.py <slug> --round v1 --final --style emblem

Name split: --parts "Auro,Cloud" (two tones), else a CamelCase or space split is used, else one tone.
--descriptor "TECHNOLOGIES" is set in light caps; its letter spacing is solved so its width is 75% of the name (--descriptor-ratio).
Custom colours: --gradient "#0F766E,#4338CA,#7E22CE" --brand "#4338CA" [--accent --ink --dark-bg --dark-brand --slate --dark-slate].
"""
import argparse
import json
import math
import random
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import text_to_path as T  # noqa: E402

# ------------------------------------------------------------------------------------------------ palettes
UI_PANEL, UI_LINE = "#1E293B", "#64748B"          # the inside of the device card, the same in every palette
PALETTES = {
    "aurora":   dict(grad=("#0F766E", "#4338CA", "#7E22CE"), brand="#4338CA", accent="#2DD4BF", dark_brand="#A5B4FC",
                     about="teal to indigo to violet: cloud, data, AI, modern SaaS"),
    "ocean":    dict(grad=("#0E7490", "#2563EB", "#4F46E5"), brand="#2563EB", accent="#22D3EE", dark_brand="#93C5FD",
                     about="cyan to blue to indigo: trust, infrastructure, fintech"),
    "sunset":   dict(grad=("#F59E0B", "#E11D48", "#7E22CE"), brand="#BE123C", accent="#FCD34D", dark_brand="#FDA4AF",
                     about="amber to rose to violet: consumer, creative, media"),
    "forest":   dict(grad=("#0F766E", "#15803D", "#4D7C0F"), brand="#15803D", accent="#A3E635", dark_brand="#86EFAC",
                     about="teal to green to olive: sustainability, health, agri"),
    "graphite": dict(grad=("#475569", "#1E3A8A", "#0F172A"), brand="#1E3A8A", accent="#38BDF8", dark_brand="#93C5FD",
                     about="slate to navy: security, enterprise, legal-tech"),
}
BASE = dict(ink="#0B1220", slate="#334155", dark_bg="#0B1220", dark_slate="#CBD5E1", paper="#FFFFFF")


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    ra, rb = hex_rgb(a), hex_rgb(b)
    return "#%02X%02X%02X" % tuple(round(x + (y - x) * t) for x, y in zip(ra, rb))


def lum(h):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = hex_rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def make_palette(a):
    p = dict(BASE)
    p.update(PALETTES[a.palette])
    if a.gradient:
        g = [c.strip().upper() for c in a.gradient.split(",")]
        if len(g) != 3:
            sys.exit("ERROR: --gradient needs exactly 3 colours, e.g. \"#0F766E,#4338CA,#7E22CE\"")
        p["grad"] = tuple(g)
        p.setdefault("brand", g[1])
        if not a.brand:
            p["brand"] = g[1]
    for k in ("brand", "accent", "ink", "dark_bg", "dark_brand", "slate", "dark_slate"):
        v = getattr(a, k, None)
        if v:
            p[k] = v.upper()
    if a.brand and not a.dark_brand:
        p["dark_brand"] = mix(p["brand"], "#FFFFFF", 0.62)
    return p


# ------------------------------------------------------------------------------------------------ silhouettes
def rounded_polygon(points, r):
    n, out = len(points), []
    for i in range(n):
        p0, p1, p2 = points[i - 1], points[i], points[(i + 1) % n]
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        a = (p1[0] + v1[0] / l1 * r, p1[1] + v1[1] / l1 * r)
        b = (p1[0] + v2[0] / l2 * r, p1[1] + v2[1] / l2 * r)
        out.append((a, p1, b))
    d = f"M{out[0][0][0]:g} {out[0][0][1]:g}"
    for i, (a, c, b) in enumerate(out):
        if i:
            d += f"L{a[0]:g} {a[1]:g}"
        d += f"Q{c[0]:g} {c[1]:g} {b[0]:g} {b[1]:g}"
    return d + "Z"


# every silhouette lives in a 120 x 120 space; obj = (x, y, scale) places the 36 x 60 device card
SILHOUETTES = {
    "cloud": dict(
        d="M34 90C20 90 12 80 12 69C12 58 20 50 31 49C34 35 46 26 60 26C75 26 86 35 89 48C101 49 108 59 108 70C108 81 99 90 87 90Z",
        bbox=(12, 26, 108, 90), obj=(42, 42, 1.0), about="cloud, hosting, SaaS, data"),
    "shield": dict(
        d="M56.5 17Q60 15.5 63.5 17L97 29.5Q100 30.8 100 34V62C100 84 82 98 60 106C38 98 20 84 20 62V34Q20 30.8 23 29.5Z",
        bbox=(20, 16, 100, 106), obj=(43.8, 38, 0.9), about="security, trust, compliance"),
    "disc": dict(
        d="M16 62A44 44 0 1 1 104 62A44 44 0 1 1 16 62Z",
        bbox=(16, 18, 104, 106), obj=(43.8, 36, 0.9), about="platform, global, neutral"),
    "tile": dict(
        d="M44 18H76A28 28 0 0 1 104 46V78A28 28 0 0 1 76 106H44A28 28 0 0 1 16 78V46A28 28 0 0 1 44 18Z",
        bbox=(16, 18, 104, 106), obj=(43.8, 35, 0.9), about="app, product, mobile"),
    "hex": dict(
        d=rounded_polygon([(60, 15), (99, 37.5), (99, 82.5), (60, 105), (21, 82.5), (21, 37.5)], 7),
        bbox=(21, 15, 99, 105), obj=(43.8, 37, 0.9), about="engineering, infrastructure, blockchain"),
}
OBJECTS = {"server": "three server slots with status dots", "phone": "a phone with cards", "dashboard": "a web dashboard",
           "chart": "rising bars (analytics, growth)", "letter": "the company initial", "none": "no card"}
TEXTURES = {"binary": "0 and 1 digits", "hex": "hexadecimal characters", "dots": "a dot grid", "lines": "diagonal lines", "none": "no texture"}


# ------------------------------------------------------------------------------------------------ fonts and outlines
def find_font(fragment):
    if Path(fragment).is_file():
        return str(fragment)
    hits = T.list_fonts(fragment)
    if not hits:
        sys.exit(f"ERROR: no font file matches {fragment!r}. The skill ships assets/fonts/ (Poppins, JetBrains Mono); "
                 "run text_to_path.py --list-fonts to see what is found.")
    return hits[0]


class Face:
    """One font opened once, outlines glyphs to SVG path data."""

    def __init__(self, path):
        from fontTools.ttLib import TTFont
        self.f = TTFont(path, fontNumber=0)
        self.upm = self.f["head"].unitsPerEm
        self.cmap = self.f.getBestCmap()
        self.gs = self.f.getGlyphSet()
        self.hmtx = self.f["hmtx"]
        os2 = self.f["OS/2"]
        self.cap = (getattr(os2, "sCapHeight", 0) or int(self.upm * 0.7)) / self.upm

    def glyph(self, ch, size, x, y, nd=2):
        from fontTools.pens.svgPathPen import SVGPathPen
        from fontTools.pens.transformPen import TransformPen
        name = self.cmap.get(ord(ch))
        if name is None:
            sys.exit(f"ERROR: the font has no glyph for {ch!r}")
        s = size / self.upm
        fmt = lambda v: f"{v:.{nd}f}".rstrip("0").rstrip(".") or "0"        # noqa: E731
        pen = SVGPathPen(self.gs, ntos=fmt)
        self.gs[name].draw(TransformPen(pen, (s, 0, 0, -s, x, y)))
        return pen.getCommands(), self.hmtx[name][0] * s

    def text(self, s, size, tracking=0.0, x=0.0, y=0.0, nd=2):
        """outlined text -> (path data, advance width). tracking in 1/1000 em, none after the last letter."""
        d, cur = [], 0.0
        for i, ch in enumerate(s):
            if ch == " ":
                cur += self.hmtx[self.cmap[32]][0] * size / self.upm + tracking / 1000 * size
                continue
            cmd, adv = self.glyph(ch, size, x + cur, y, nd)
            d.append(cmd)
            cur += adv + (tracking / 1000 * size if i < len(s) - 1 else 0)
        return "".join(d), cur


_FACES = {}


def face(fragment):
    path = find_font(fragment)
    if path not in _FACES:
        _FACES[path] = Face(path)
    return _FACES[path]


# ------------------------------------------------------------------------------------------------ texture
def texture_markup(kind, sil, seed, mono, knock, mono_fill):
    """White glyph paths in three opacity tiers, in the 120-unit space, to be drawn inside the silhouette clip."""
    if kind == "none":
        return ""
    x0, y0, x1, y1 = sil["bbox"]
    rng = random.Random(seed)
    ink = knock if mono else "#fff"
    tiers = [([], 0.95), ([], 0.65), ([], 0.38)]
    if kind in ("binary", "hex"):
        f = face("JetBrainsMono_700Bold")
        chars = "01" if kind == "binary" else "0123456789ABCDEF"
        size, cw, rh = 7.5, 7.6, 7.6
        row, y = 0, y0 + 6.5
        while y < y1 + 5:
            x, col = x0 - 2.5 + (3.5 if row % 2 and kind == "hex" else 0), 0
            while x < x1 + 1:
                t = (row * 7 + col * 13 + rng.randrange(0, 3)) % 5
                tier = 0 if t < 2 else (1 if t < 4 else 2)
                if not (mono and tier == 2):
                    d, _ = f.glyph(rng.choice(chars), size, x, y, 2)
                    tiers[tier][0].append(d)
                x += cw
                col += 1
            y += rh
            row += 1
    elif kind == "dots":
        r, step, row, y = 1.5, 7.0, 0, y0 + 4
        while y < y1 + 4:
            x, col = x0 - 1 + (step / 2 if row % 2 else 0), 0
            while x < x1 + 2:
                tier = 0 if (row + col) % 3 == 0 else (1 if (row + col) % 3 == 1 else 2)
                if not (mono and tier == 2):
                    tiers[tier][0].append(f"M{x - r:g} {y:g}a{r:g} {r:g} 0 1 0 {2 * r:g} 0a{r:g} {r:g} 0 1 0 {-2 * r:g} 0Z")
                x += step
                col += 1
            y += step
            row += 1
    elif kind == "lines":
        w, step = 2.4, 8.0
        k, tier_i = -(y1 - y0), 0
        while k < (x1 - x0) + 8:
            xa, ya = x0 + k, y1 + 4
            tiers[tier_i % 3][0].append(f"M{xa:g} {ya:g}l{w:g} 0l{(y1 - y0 + 8):g} {-(y1 - y0 + 8):g}l{-w:g} 0Z")
            k += step
            tier_i += 1
    out = ""
    for paths, op in tiers:
        if paths:
            o = "" if mono else f' opacity="{op}"'
            out += f'<path d="{"".join(paths)}" fill="{ink}"{o}/>'
    return out


# ------------------------------------------------------------------------------------------------ device card (36 x 60)
def object_markup(kind, pal, seed_initial, mode, simple=False, C="#fff", K="#0B1220"):
    """Card drawn in its own 36 x 60 box. mode 'color' or 'mono' (C = shape colour, K = knock-out colour)."""
    mono = mode == "mono"
    P = K if mono else UI_PANEL            # panel on the card
    L = C if mono else UI_LINE             # line on a panel
    A = C if mono else pal["accent"]       # accent on a panel
    F = K if mono else UI_LINE             # free ornament on the bare card
    FA = K if mono else pal["accent"]      # free accent on the bare card
    fill = C if mono else pal["dark_bg"]
    stroke = K if mono else "#fff"
    out = f'<rect width="36" height="60" rx="5" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
    if kind == "none":
        return ""
    if simple or kind == "server":
        out += f'<g fill="{P}"><rect x="5" y="6" width="26" height="12" rx="2"/><rect x="5" y="22" width="26" height="12" rx="2"/><rect x="5" y="38" width="26" height="12" rx="2"/></g>'
        out += f'<g fill="{A}"><circle cx="10" cy="12" r="1.8"/><circle cx="10" cy="28" r="1.8"/><circle cx="10" cy="44" r="1.8"/></g>'
        if not simple:
            out += f'<g stroke="{L}" stroke-width="1.6" stroke-linecap="round"><path d="M16 10H27M16 14H27M16 26H27M16 30H27M16 42H27M16 46H27"/></g>'
    elif kind == "phone":
        out += f'<rect x="12" y="4" width="12" height="2.6" rx="1.3" fill="{F}"/>'
        out += f'<g fill="{P}"><rect x="5" y="10" width="26" height="16" rx="2"/><rect x="5" y="30" width="26" height="16" rx="2"/></g>'
        out += f'<circle cx="10.5" cy="18" r="2.2" fill="{A}"/>'
        out += f'<g stroke="{L}" stroke-width="1.6" stroke-linecap="round"><path d="M16 16H27M16 20H24M10 36H27M10 40H21"/></g>'
        out += f'<rect x="11" y="51" width="14" height="3" rx="1.5" fill="{FA}"/>'
    elif kind == "dashboard":
        out += f'<g fill="{F}"><circle cx="6.5" cy="7" r="1.3"/><circle cx="11" cy="7" r="1.3"/><circle cx="15.5" cy="7" r="1.3"/></g>'
        out += f'<g fill="{P}"><rect x="5" y="13" width="26" height="16" rx="2"/><rect x="5" y="33" width="12" height="11" rx="2"/><rect x="19" y="33" width="12" height="11" rx="2"/></g>'
        out += f'<g stroke="{A}" stroke-width="1.8" stroke-linecap="round"><path d="M9 19H21"/></g>'
        out += f'<g stroke="{L}" stroke-width="1.6" stroke-linecap="round"><path d="M9 24H27"/></g>'
        out += f'<g stroke="{F}" stroke-width="1.6" stroke-linecap="round"><path d="M5 49H31M5 53H22"/></g>'
    elif kind == "chart":
        out += f'<rect x="5" y="6" width="26" height="48" rx="2" fill="{P}"/>'
        out += f'<g stroke="{L}" stroke-width="1.6" stroke-linecap="round"><path d="M9 11H20"/></g>'
        out += f'<g fill="{L}"><rect x="9" y="36" width="5" height="12" rx="1"/><rect x="16.5" y="28" width="5" height="20" rx="1"/></g>'
        out += f'<rect x="24" y="18" width="5" height="30" rx="1" fill="{A}"/>'
    elif kind == "letter":
        f = face("Poppins_800ExtraBold")
        size = 34.0
        letter = (seed_initial or "A")[:1].upper()
        _, adv = f.glyph(letter, size, 0, 0)
        d, _ = f.glyph(letter, size, (36 - adv) / 2, 30 + f.cap * size / 2 - 1, 2)
        out += f'<path d="{d}" fill="{FA}"/>'
        out += f'<g stroke="{F}" stroke-width="1.6" stroke-linecap="round"><path d="M11 50H25"/></g>'
    return out


# ------------------------------------------------------------------------------------------------ the emblem
def emblem_bbox(sil, obj):
    x0, y0, x1, y1 = sil["bbox"]
    if obj != "none":
        ox, oy, s = sil["obj"]
        x0, y0 = min(x0, ox - 1.5 * s), min(y0, oy - 1.5 * s)
        x1, y1 = max(x1, ox + (36 + 1.5) * s), max(y1, oy + (60 + 1.5) * s)
    return x0, y0, x1, y1


def emblem_parts(a, pal, mode="color", simple=False, C="#fff", K="#0B1220"):
    """(defs, body) of the emblem in the 120-unit space. mode: color | mono."""
    sil = SILHOUETTES[a.silhouette]
    mono = mode == "mono"
    if mono:
        defs = f'<clipPath id="cc"><path d="{sil["d"]}"/></clipPath>'
        body = f'<path d="{sil["d"]}" fill="{C}"/>'
    else:
        g = pal["grad"]
        defs = (f'<clipPath id="cc"><path d="{sil["d"]}"/></clipPath>'
                f'<linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="{g[0]}"/>'
                f'<stop offset=".5" stop-color="{g[1]}"/><stop offset="1" stop-color="{g[2]}"/></linearGradient>')
        body = f'<path d="{sil["d"]}" fill="url(#g)"/>'
    tex = "" if simple else texture_markup(a.texture, sil, a.seed or a.name or "emblem", mono, K, C)
    if tex:
        body += f'<g clip-path="url(#cc)">{tex}</g>'
    if a.object != "none":
        ox, oy, s = sil["obj"]
        body += (f'<g transform="translate({ox:g} {oy:g}) scale({s:g})">'
                 f'{object_markup(a.object, pal, a.name, mode, simple, C, K)}</g>')
    return defs, body


def place(defs_body, bbox, x, y, h):
    """transform so the emblem's bbox top-left lands on (x, y) and its height is h. Returns (markup, width)."""
    defs, body = defs_body
    bx0, by0, bx1, by1 = bbox
    s = h / (by1 - by0)
    g = f'<g transform="translate({x - bx0 * s:.2f} {y - by0 * s:.2f}) scale({s:.4f})">{body}</g>'
    return defs, g, (bx1 - bx0) * s


def svg(vb, defs, body, bg=None):
    w, h = vb[2], vb[3]
    bgr = f'<rect x="{vb[0]:g}" y="{vb[1]:g}" width="{w:g}" height="{h:g}" fill="{bg}"/>' if bg else ""
    d = f"<defs>{defs}</defs>" if defs else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]:g} {vb[1]:g} {w:g} {h:g}">{d}{bgr}{body}</svg>\n'


# ------------------------------------------------------------------------------------------------ wordmark
def split_name(a):
    if a.parts:
        return [p.strip() for p in a.parts.split(",") if p.strip()][:2], a.space
    name = a.name
    if " " in name.strip():
        first, second = name.strip().split(None, 1)
        return [first, second], True
    m = re.search(r"(?<=[a-z0-9])(?=[A-Z])", name)
    if m:
        return [name[:m.start()], name[m.start():]], a.space
    return [name], False


def wordmark(a, pal, theme, cap_target, x, base_y_center=None, align="left", width_target=None):
    """Returns (markup, width, total_height, name_cap). Baselines computed from the block centre."""
    mono = theme.startswith("mono")
    name_face = face("Poppins_800ExtraBold" if a.weight == "extrabold" else "Poppins_700Bold")
    desc_face = face("Poppins_300Light")
    parts, spaced = split_name(a)
    tr = 0.0
    # size from the cap height; for the stacked lockup from a target width, never taller than cap_target
    cap_ratio = name_face.cap
    size = cap_target / cap_ratio
    if width_target:
        _, w100 = name_face.text("".join(parts), 100, tr)
        size = min(size, width_target / w100 * 100)
    cap = cap_ratio * size
    ink = {"light": pal["ink"], "dark": "#FFFFFF", "mono-black": "#000000", "mono-white": "#FFFFFF"}[theme]
    tone2 = {"light": pal["brand"], "dark": pal["dark_brand"], "mono-black": "#000000", "mono-white": "#FFFFFF"}[theme]
    sub = {"light": pal["slate"], "dark": pal["dark_slate"], "mono-black": "#000000", "mono-white": "#FFFFFF"}[theme]
    gap_em = 0.28 if len(parts) == 2 and spaced else 0.0
    # name outlines (baseline y=0 for now)
    paths, cur = [], 0.0
    for i, p in enumerate(parts):
        d, w = name_face.text(p, size, tr, cur, 0)
        paths.append((d, ink if i == 0 else tone2))
        cur += w + (gap_em * size if i < len(parts) - 1 else 0)
    name_w = cur
    desc = None
    block_h = cap
    d_cap = d_gap = 0.0
    if a.descriptor:
        d_cap = 0.34 * cap
        d_gap = 0.41 * cap
        dsize = d_cap / desc_face.cap
        _, w0 = desc_face.text(a.descriptor, dsize, 0)
        target = a.descriptor_ratio * name_w
        n = len(a.descriptor)
        track = max(0.0, (target - w0) / max(n - 1, 1) / dsize * 1000)
        desc = (dsize, track)
        block_h = cap + d_gap + d_cap
    # place: top of the cap line of the block at yt
    def build(left, yt):
        mk = ""
        base = yt + cap
        for d, col in paths:
            mk += f'<path transform="translate({left:.2f} {base:.2f})" d="{d}" fill="{col}"/>'
        if desc:
            dsize, track = desc
            dd, dw = desc_face.text(a.descriptor, dsize, track, 0, 0)
            mk += f'<path transform="translate({left + 0.04 * cap:.2f} {base + d_gap + d_cap:.2f})" d="{dd}" fill="{sub}"/>'
        return mk
    return build, name_w, block_h, cap


def lockups(a, pal, bbox):
    """All horizontal / stacked / wordmark svgs. Returns dict name -> text."""
    H = 170.0                                     # emblem height in the lockups
    pad = 0.25 * H
    ex0, ey0, ex1, ey1 = bbox
    E_w = (ex1 - ex0) * H / (ey1 - ey0)
    out = {}
    themes = {
        "logo-horizontal.svg": ("light", "color", None, None),
        "logo-on-dark.svg": ("dark", "color", pal["dark_bg"], None),
        "logo-mono-black.svg": ("mono-black", "mono", None, ("#000000", "#FFFFFF")),
        "logo-mono-white.svg": ("mono-white", "mono", None, ("#FFFFFF", pal["dark_bg"])),
    }
    cap_h = (0.48 if a.descriptor else 0.52) * H
    for fname, (theme, mode, bg, ck) in themes.items():
        C, K = ck or ("#fff", pal["dark_bg"])
        parts = emblem_parts(a, pal, mode, False, C, K)
        defs, g, _ = place(parts, bbox, pad, pad, H)
        build, name_w, block_h, cap = wordmark(a, pal, theme, cap_h, 0)
        tx = pad + E_w + 0.32 * H
        yt = pad + H / 2 - block_h / 2
        body = g + build(tx, yt)
        W = tx + name_w + pad
        out[fname] = svg((0, 0, round(W, 1), round(H + 2 * pad, 1)), defs, body, bg)
    # stacked: emblem over the name
    for fname, theme, bg in (("logo-stacked.svg", "light", None), ("logo-stacked-on-dark.svg", "dark", pal["dark_bg"])):
        parts = emblem_parts(a, pal, "color", False)
        cap_s = 0.30 * H
        build, name_w, block_h, cap = wordmark(a, pal, theme, cap_s, 0, width_target=1.55 * E_w)
        gap = 0.20 * H
        W = max(E_w, name_w) + 2 * pad
        defs, g, ew = place(parts, bbox, (W - E_w) / 2, pad, H)
        yt = pad + H + gap
        body = g + build((W - name_w) / 2, yt)
        out[fname] = svg((0, 0, round(W, 1), round(pad + H + gap + block_h + pad, 1)), defs, body, bg)
    # wordmark alone
    build, name_w, block_h, cap = wordmark(a, pal, "light", 100.0, 0)
    q = 0.12 * cap
    out["wordmark.svg"] = svg((0, 0, round(name_w + 2 * q * 2, 1), round(block_h + 2 * q * 2, 1)), "", build(q * 2, q * 2))
    return out


def tile(a, pal, simple=False):
    """512 x 512 app icon: dark rounded square holding the emblem."""
    sil = SILHOUETTES[a.silhouette]
    bbox = emblem_bbox(sil, a.object)
    parts = emblem_parts(a, pal, "color", simple)
    target_w = 0.64 * 512 if not simple else 0.74 * 512
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    s = min(target_w / bw, 0.62 * 512 / bh if not simple else 0.72 * 512 / bh)
    w, h = bw * s, bh * s
    defs, g, _ = place(parts, bbox, (512 - w) / 2, (512 - h) / 2 + 4, h)
    body = f'<rect width="512" height="512" rx="112" fill="{pal["dark_bg"]}"/>' + g
    return svg((0, 0, 512, 512), defs, body)


def emblem_square(a, pal, mode="color"):
    sil = SILHOUETTES[a.silhouette]
    bbox = emblem_bbox(sil, a.object)
    bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
    side = max(bw, bh) * 1.1
    parts = emblem_parts(a, pal, mode, False, "#000000", "#FFFFFF") if mode == "mono" else emblem_parts(a, pal, "color", False)
    defs, body = parts
    cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
    vb = (round(cx - side / 2, 2), round(cy - side / 2, 2), round(side, 2), round(side, 2))
    return svg(vb, defs, body)


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def write_package(a, pal):
    pkg = Path(a.out)
    pkg.mkdir(parents=True, exist_ok=True)
    sil = SILHOUETTES[a.silhouette]
    bbox = emblem_bbox(sil, a.object)
    files = lockups(a, pal, bbox)
    files["icon.svg"] = tile(a, pal)
    files["favicon.svg"] = tile(a, pal, simple=True)
    files["emblem.svg"] = emblem_square(a, pal)
    for name, text in files.items():
        (pkg / name).write_text(text, encoding="utf-8")
        print(f"wrote {pkg / name}  ({len(text) / 1024:.0f} KB)")
    brand = {
        "name": a.name, "slug": slugify(a.name), "tagline": "", "style": "emblem",
        "colors": {"primary": pal["brand"], "accent": pal["accent"], "ink": pal["ink"], "slate": pal["slate"], "paper": pal["paper"],
                   "dark_bg": pal["dark_bg"], "gradient_start": pal["grad"][0], "gradient_mid": pal["grad"][1], "gradient_end": pal["grad"][2]},
        "font": {"family": "Poppins ExtraBold + Light (outlined), JetBrains Mono Bold for the texture", "license": "SIL Open Font License 1.1", "outlined": True},
        "clear_space": 0.25, "min_size": {"icon_px": 32, "horizontal_px": 180, "stacked_px": 96},
        "concept": a.concept or f"{a.silhouette} emblem with a {a.object} card and {a.texture} texture",
        "emblem": {"silhouette": a.silhouette, "object": a.object, "texture": a.texture, "palette": a.palette},
    }
    (pkg / "brand.json").write_text(json.dumps(brand, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {pkg / 'brand.json'}")
    cb = contrast(pal["brand"], pal["paper"])
    cd = contrast(pal["dark_brand"], pal["dark_bg"])
    print(f"contrast: brand on white {cb:.1f}:1, light brand on dark {cd:.1f}:1" + ("" if cb >= 4.5 and cd >= 4.5 else "   <- below 4.5: pick a different --brand / --dark-brand"))


def build_args(ap, concept_only=False):
    ap.add_argument("--silhouette", default="cloud", choices=list(SILHOUETTES))
    ap.add_argument("--object", default="server", choices=list(OBJECTS))
    ap.add_argument("--texture", default="binary", choices=list(TEXTURES))
    ap.add_argument("--palette", default="aurora", choices=list(PALETTES))
    ap.add_argument("--gradient")
    for k in ("brand", "accent", "ink", "dark-bg", "dark-brand", "slate", "dark-slate"):
        ap.add_argument(f"--{k}")
    ap.add_argument("--seed", help="texture seed (default: the name)")
    ap.add_argument("--name", default="", help="company name (also gives the initial for --object letter)")
    ap.add_argument("--parts"), ap.add_argument("--descriptor", default="")
    ap.add_argument("--descriptor-ratio", type=float, default=0.75)
    ap.add_argument("--weight", default="extrabold", choices=["extrabold", "bold"])
    ap.add_argument("--space", action="store_true", help="keep a gap between the two name parts (default: one word)")
    ap.add_argument("--concept", default="")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    c = sub.add_parser("concept")
    c.add_argument("out")
    build_args(c, True)
    p = sub.add_parser("package")
    p.add_argument("out")
    build_args(p)
    a = ap.parse_args(argv)
    T.need_fonttools()
    if a.cmd == "list":
        print("silhouettes:", *[f"\n  {k:9} {v['about']}" for k, v in SILHOUETTES.items()])
        print("objects:", *[f"\n  {k:9} {v}" for k, v in OBJECTS.items()])
        print("textures:", *[f"\n  {k:9} {v}" for k, v in TEXTURES.items()])
        print("palettes:", *[f"\n  {k:9} {v['about']}  {' '.join(v['grad'])}  brand {v['brand']}" for k, v in PALETTES.items()])
        return 0
    a.dark_bg, a.dark_brand, a.dark_slate = getattr(a, "dark_bg", None), getattr(a, "dark_brand", None), getattr(a, "dark_slate", None)
    pal = make_palette(a)
    if a.cmd == "concept":
        Path(a.out).parent.mkdir(parents=True, exist_ok=True)
        Path(a.out).write_text(emblem_square(a, pal), encoding="utf-8")
        print(f"wrote {a.out}")
        mono = Path(a.out).parent / "mono" / Path(a.out).name           # the preview sheet shows this in its one-colour row
        mono.parent.mkdir(exist_ok=True)
        mono.write_text(emblem_square(a, pal, "mono"), encoding="utf-8")
        return 0
    if not a.name:
        ap.error("package needs --name")
    write_package(a, pal)
    return 0


if __name__ == "__main__":
    sys.exit(main())
