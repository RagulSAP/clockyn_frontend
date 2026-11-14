---
name: tech-logo-generator
description: Create a professional logo package (SVG source, PNG exports, favicon, app icon, dark version, brand sheet) for a tech company, startup or product. Default look is the illustrated emblem style of logo-files/ (gradient silhouette with a glyph texture, a dark device card, a two-tone bold wordmark with a spaced descriptor, a dark rounded app icon); a flat minimal style is available on request. Use when the user asks for a logo, brand mark, wordmark, icon, app icon, favicon or brand identity, says "design a logo for <name>", "make a logo", "I need a brand for my startup", "logo ideas for", "redo our logo", or asks for logo concepts or a lockup. Produces 3 distinct concepts, self-critiques them, recommends one, then builds the full set.
---

# Tech logo generator

Input: a company name (plus optional context). Output: three distinct logo concepts as SVG, a recommendation, and on request a complete package in `./logos/<company-slug>/<round>/`.
Be decisive: produce real work in the first turn. Do not interrogate the user.

## Pick the style first

| Style | Use when | How it is made |
|---|---|---|
| **emblem** (default) | Nothing else is said, or the user wants it "like the logo-files / AuroCloud look", rich, illustrated, modern, app-like | `scripts/emblem.py` draws it from choices (silhouette, object, texture, palette). Read `references/emblem-style.md`. |
| **minimal** | The user asks for flat, minimal, simple, a monogram, or a one-colour mark | You write the SVG icon yourself, then `compose_lockups.py`. Read `references/design-principles.md`. |

If the user names the style, follow it. If they only say "elegant" or "simple", still use emblem and keep texture calm (`--texture dots` or `none`). Say which style you used in the one-line assumptions.

Always read `references/palettes.md` (colours) and `references/typography.md` (wordmarks, outlining). The minimal style also needs `references/design-principles.md`; the emblem style needs `references/emblem-style.md`.

## Workflow

### 1. Gather inputs (no interrogation)
Required: the company name. Optional: what it does, audience, tone, colours to use or avoid, styles to avoid.
If optional inputs are missing, **infer defaults from the name and state the assumptions in ONE line** ("Assuming: cloud and AI services, modern and trustworthy, emblem style, aurora palette"). Ask **at most one** clarifying question, and only when the answer would change everything, and still deliver work in the same reply.

### 2. Analyse the name
Write a **3 to 5 line brief**: length and what it implies, how the name splits into two parts (`Auro|Cloud`), meaning, the business in one object, tone, palette family, and the concept directions.

### 3. Three DIFFERENT concepts
- **emblem:** three different combinations of silhouette + object + texture + palette (table in `emblem-style.md`). Never three palettes of one idea. One-line rationale each, tied to the name and the business.
- **minimal:** three strategies: A abstract geometric symbol, B lettermark / monogram, C embedded idea (details in `design-principles.md` section 4).
Do not imitate a famous brand: describe the mark in one sentence; if that also describes a well-known logo, redo it.

### 4. Build each concept as SVG
Folder: `./logos/<slug>/v1/concepts/concept-a-<idea>.svg`, `concept-b-...`, `concept-c-...`.

**emblem:**
```
python .github/skills/tech-logo-generator/scripts/emblem.py concept logos/<slug>/v1/concepts/concept-a-<idea>.svg \
    --name "<Name>" --silhouette cloud --object server --texture binary --palette aurora
```
(`emblem.py list` shows every option; each call also writes a one-colour version to `concepts/mono/`.)

**minimal:** write icon SVGs yourself, `viewBox="0 0 512 512"`, no width/height, no external refs, no raster, no filters, primitives only on a grid with one stroke width, 2 to 3 flat colours, 5 to 8 shapes, recognisable at 16 px and in black on white.

Then validate (errors must be fixed; the style is detected from the file):
```
python .github/skills/tech-logo-generator/scripts/validate.py ./logos/<slug>/v1/concepts/*.svg --kind icon
```

### 5. Render and self-critique (at least one refinement pass)
```
python .github/skills/tech-logo-generator/scripts/build_package.py <slug> --round v1 --preview
```
This writes `logos/<slug>/v1/preview.png`: each concept on light, on dark, in one colour, and at 16/32/64 px. **Look at the image** and check every concept:

- [ ] Legible and distinct at 16 px (emblem: the favicon reads as a coloured shape with a card)
- [ ] Works in one colour (black and white)
- [ ] Works on both light and dark backgrounds
- [ ] Balanced optical weight between icon and wordmark
- [ ] Letter spacing and kerning look even
- [ ] Not generic or derivative
- [ ] Fits the stated industry and tone
- [ ] SVG passes `validate.py`

Check contrast too (mark vs background 3:1 or better; wordmark colours 4.5:1). Do not present a concept you would reject yourself: replace it. Keep earlier files; refinements go in the same round only before the first presentation, after that start `v2`.

### 6. Present
Reply concisely: one-line assumptions (include the style), the brief, the **preview sheet** (show the PNG), one-line rationale per concept, **your recommendation with 2 to 3 reasons**, and next steps as a short list (palette, silhouette, texture, weight, build the package). Add one line: **not trademark-cleared; run a trademark and image search before commercial use.** Then build the package for the recommended concept unless the user said otherwise.

### 7. Finalise into the package
Folder `./logos/<slug>/<round>/package/`.

**emblem** (one command writes every SVG and `brand.json`):
```
python .github/skills/tech-logo-generator/scripts/emblem.py package logos/<slug>/v1/package --name AuroCloud \
    --descriptor TECHNOLOGIES --silhouette cloud --object server --texture binary --palette aurora \
    --concept "a data cloud with a server in front"
```
Options: `--parts "Auro,Cloud"` (name split), `--gradient "#a,#b,#c" --brand "#hex"` (custom colours), `--seed` (other digit layout), `--weight bold`, `--space` (gap between the two name parts). Files: `emblem.svg` (mark alone), `icon.svg` (dark app tile), `favicon.svg`, `wordmark.svg`, `logo-horizontal.svg`, `logo-on-dark.svg`, `logo-stacked.svg`, `logo-stacked-on-dark.svg`, `logo-mono-black.svg`, `logo-mono-white.svg`, `brand.json`. Fonts: Poppins and JetBrains Mono (SIL OFL) from `assets/fonts/`, outlined.

**minimal:** you write `icon.svg`, `favicon.svg` (the icon simplified for 16 px) and `brand.json`; `compose_lockups.py` makes the rest with exact proportions:
```
python .github/skills/tech-logo-generator/scripts/compose_lockups.py logos/<slug>/v1/package --name <Name> [--descriptor Labs] --font-bold <Bold.ttf> --font-regular <Regular.ttf> --ink "#primary-or-ink" --on-dark-ink "#light" --on-dark-map "#old:#new,..."
```
Keep each lockup to 3 colours. `brand.json`: name, slug, colours (`primary accent ink paper dark_bg`), font + licence, `clear_space` (0.25), `min_size`, one-line concept (`build_package.py --example-brand` prints a template).

Both styles then:
```
python .github/skills/tech-logo-generator/scripts/build_package.py <slug> --round v1 --final
```
It validates every file, renders `png/` (icon 16 to 1024 px; horizontal, stacked, on-dark 1x and 2x; mono; emblem 256 to 1024 for the emblem style), creates `favicon.ico` and `brand-sheet.html` / `brand-sheet.png` (colours with hex and contrast, clear space, minimum size, light and dark use), and prints the tree. Open the brand sheet and fix anything that looks wrong.

### Putting the logo into a project
Give the file that fits the slot: square slot on white (invoice, e-mail) = `png/emblem-512.png` (transparent, mark only); app icon / store = `png/icon-1024.png` (no transparency needed, already on dark); website header = `logo-horizontal.svg` and `logo-on-dark.svg`; favicon = `favicon.ico` + `favicon.svg`. Copy, never edit the generated files by hand; change the choices and rebuild in a new round.

## Scripts (all in `.github/skills/tech-logo-generator/scripts/`)
- `emblem.py list | concept OUT.svg ... | package DIR ...` draws the emblem style (see `references/emblem-style.md`).
- `render.py <svg> --sizes 16,32,... | --scales 1,2 [--bg light|dark|#hex] [--both-bg]` writes PNGs to a `png/` folder next to the SVG. First renderer that really works: cairosvg (installed on demand; Windows often lacks the Cairo library), resvg, rsvg-convert, inkscape, then Chromium through Playwright. `--check` says which is used.
- `validate.py <svg...> [--kind icon|lockup|wordmark] [--style auto|minimal|emblem] [--strict]` checks XML, viewBox, external refs, raster embeds, filters, file size, shapes, colours. The emblem profile allows 3-stop gradients, clipPath, opacity tiers, 12 colours, 400 KB.
- `build_package.py <slug> --round vN [--preview | --final]` makes the preview sheet or the package.
- `compose_lockups.py <package-dir> --name N ...` builds the minimal-style lockups from `icon.svg`.
- `text_to_path.py --font F.ttf --text "Name" --size 120 [--tracking N] [--kern "Lu:-3"] --json` outlines text (needs `fonttools`, installed on demand). `--list-fonts` finds font files, including `assets/fonts/`.

## Rules of behaviour
- Be decisive and concise; real files on the first turn.
- Lowercase-hyphen slugs for folders and files. **Never overwrite a previous round**: iterate in `v2`, `v3` ...
- Emblem style: choose ingredients, do not hand-edit generated paths. Minimal style: write the SVG yourself (this skill does not trace raster art). Keep colours as `fill="#hex"` attributes.
- Fonts: outlined text from an OFL or Apache font; say which one. Poppins and JetBrains Mono ship in `assets/fonts/`.
- Always give hex codes. State when a check failed and what you changed.
- Never claim the logo is trademark-cleared or unique; recommend a trademark and image search before commercial use.
- If the user asks to imitate an existing brand, decline that part and offer an original direction in the same spirit.
