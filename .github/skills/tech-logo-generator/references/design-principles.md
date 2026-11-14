# Logo craft rules (minimal / flat style)

These rules apply to the **minimal** style. The default **emblem** style (gradient silhouette, glyph texture, device card) has its own rules in `emblem-style.md`; the file-safety rules in section 1 (no external references, no raster, no filters, outlined text) and the lockup, clear-space and minimum-size rules in sections 8 to 10 apply to both.

These rules are enforced by the skill: `scripts/validate.py` checks the mechanical ones, and the self-critique checklist in SKILL.md covers the rest.

## 1. File rules (SVG)

- Clean `viewBox` and nothing that depends on a fixed size: **icons `0 0 512 512`**, lockups a width:height that fits the content (for example `0 0 960 240`). No `width`/`height` on `<svg>`.
- **No external references** (`href` to a file or URL, `@import`, web fonts), **no embedded raster** (`<image>`, `data:image/...`), no `<script>`, no `<foreignObject>`.
- **No filters** (blur, drop shadow, glow): they render differently in browsers, design tools and the OS. Depth, if wanted, is drawn with extra flat shapes.
- Build from primitives: `path`, `circle`, `rect`, `polygon`. A path with few nodes and round numbers beats a traced one.
- Round coordinates to 1 or 2 decimals. Group nothing you do not need. Keep one `xmlns="http://www.w3.org/2000/svg"`.
- Gradients only if subtle: **at most 2 stops**, and the design must still work in one flat colour. Never use opacity to make a second colour (it changes with the background).
- Give the shapes plain colours as attributes (`fill="#4F46E5"`), so recolouring the mono and on-dark versions is a search-and-replace.

## 2. Geometry (what makes it look designed, not drawn)

- **Grid.** Place everything on a coarse grid (`512` icons: multiples of 16, or 32). Choose a **base unit** (`u = 32`) and build sizes from it: a stroke of `1u`, radius of `1u`, gaps of `0.5u`.
- **One stroke width** across the whole mark, **one corner radius family** (all corners the same radius, or radius = half the stroke).
- **Optical centre, not mathematical centre.** A circle looks smaller than a square of the same size (make it about 5% bigger); a triangle's weight sits low (nudge it up); a shape with a heavy side looks off-centre even when it is not: shift by a few units until it feels balanced.
- **Consistent gaps.** Equal spaces between shapes, and a gap at least as wide as the stroke so shapes do not merge at 16 px.
- **Safe zone.** Keep the mark inside about 80% of the canvas (icons: 51 to 461 on a 512 grid) so an OS mask or rounded corner never clips it.
- **Angles.** Use few, repeated angles (0, 45, 90; or one chosen angle). A random angle looks like an error.
- **Count.** One clear idea, **about 5 to 8 shapes at most**. No hairlines (strokes under 1.5% of the viewBox vanish at 16 px), no tiny details, no text inside an icon unless it is a lettermark.

## 3. Colour

- **Maximum 2 to 3 colours** in the primary version, flat. Choose from `palettes.md` by industry and tone, and always write hex codes.
- The mark must work in **pure black on white** and **pure white on dark**: if two shapes are told apart only by hue, separate them with a gap or a different form.
- **Contrast:** mark vs background at least 3:1 (it is a graphic); any small text at least 4.5:1. The light version and the dark version are checked separately.
- The dark version is adapted, not inverted: lighter tone of the primary, same shapes.

## 4. Concept strategies (use three DIFFERENT ones)

| Strategy | What it is | Good when | Example moves |
|---|---|---|---|
| **Abstract geometric symbol** | A shape built from circles, bars or arcs that suggests a quality (growth, connection, light) without drawing an object | The name is abstract or invented | Two overlapping discs forming a lens; a rising stepped bar; a quarter-circle in a square |
| **Lettermark / monogram** | The initial (or two) turned into a distinctive form | The name has a strong first letter, or is long | An "L" whose foot ends in a dot; two letters sharing a stroke; an initial cut from a solid shape |
| **Embedded idea** | A simple symbol that hides a second meaning: negative space, a letter inside a motif, a motif forming a letter | The name has a clear meaning or compound words | An arrow in the gap of a letter; a letter formed by three connected dots; a circle with a notch that reads as a clock |
| **Wordmark-led** | The type itself carries the identity (one custom detail: a dotted i, a cut crossbar) | Short, distinctive name; the user wants no symbol | Outline the text, alter one glyph |

Rules: three concepts, three strategies (never three variations of one idea). Say in **one line** why each fits the name and the industry.

## 5. Analysing the name (3 to 5 line brief)

Look at: length (long names want a monogram), initials and how the first letter is built (symmetry, ascenders and descenders, round vs straight), meaning and etymology (Latin or Greek roots, compound words), sound (hard vs soft), and any natural metaphor. Then write: industry, tone, palette family, and the three concept directions.

## 6. Clichés to avoid (unless inverted in a clever way)

Generic globes, lightbulbs, gears and cogs, circuit-board patterns, glowing brains, cloud icons, swooshes, orbiting dots around a letter, a plain hexagon, the "tech" blue-to-purple gradient sphere, a rocket for every startup, handshakes, a padlock for any security company, a magnifier for search. If the idea is in this list, find the unexpected angle or pick another.

## 7. Never imitate

- The mark must not resemble any well-known brand: not the shape, not the shape-plus-colour combination (for example a swoosh tick, a bitten fruit, a speech bubble with a tail used by a messenger, interlocked rings, overlapping circles in a payment company's two colours).
- Test: describe the mark in one sentence. If the sentence also describes a famous logo, redo it.
- Overlapping circles, a rounded square with a letter, and a single letter in a circle are common structures: they are allowed only with a distinctive twist in proportion, cut or colour. Say what the twist is.
- **Never claim the logo is trademark-cleared.** Recommend a trademark and image search before commercial use.

## 8. Tests every mark must pass

1. **16 px test:** render at 16 x 16. Is the idea still readable and distinct from a blob?
2. **One-colour test:** pure black on white (and white on black). Does it hold together?
3. **Light and dark:** both backgrounds, contrast checked.
4. **Squint test:** blur your eyes, is there one clear shape?
5. **Distance test:** the 64 px version next to ten other icons: does it stand out?
6. **Not generic, not derivative.**

## 9. Lockups

- **Horizontal:** icon left, wordmark right. The wordmark's **cap height is about 50% to 60% of the icon height**, vertically centred on the icon's optical centre; the gap between them is about 0.25 x the icon height.
- **Stacked:** icon centred above the wordmark; the gap about 0.08 x the icon canvas height (the canvas already holds about 10% safe-zone padding, so the visible gap is larger than it looks); wordmark width about 1.2 to 1.6 x icon width.
- **Optical weight:** the wordmark's stroke weight should be similar to the icon's stroke weight. A thin wordmark next to a heavy icon looks like two logos.
- **Clear space:** keep **x = 25% of the logo height** free on every side (stated in `brand.json` as `clear_space: 0.25`).
- **Minimum size:** icon 16 px; horizontal lockup 120 px wide; stacked 64 px wide. Below that use the icon alone.

## 10. The set of files

`icon.svg` (square, safe zone, works as app icon and favicon), `wordmark.svg`, `logo-horizontal.svg`, `logo-stacked.svg`, `logo-mono-black.svg`, `logo-mono-white.svg`, `logo-on-dark.svg`, `favicon.svg` (the icon simplified for 16 px: fewer details, thicker strokes). Each is self-contained and passes `validate.py`.
