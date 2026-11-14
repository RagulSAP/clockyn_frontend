# Wordmark typography

## Decision: outlined paths first

A wordmark in live `<text>` depends on the viewer having the font: it changes in browsers, in Figma and in print. So:

1. **Preferred:** convert the text to outlined paths with `scripts/text_to_path.py` and a font file whose licence allows it (below). The wordmark then renders identically everywhere and `validate.py` has no `<text>` warning.
2. **Fallback:** if no suitable font file is available, use live text with a robust stack and say clearly in the reply that fonts may vary:

   ```
   font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
   ```
   Other safe stacks: geometric `Outfit, 'Avenir Next', 'Segoe UI', Arial, sans-serif`; humanist `'Segoe UI', 'Open Sans', Roboto, Arial, sans-serif`; technical mono `'JetBrains Mono', 'SF Mono', Consolas, 'Courier New', monospace`; serif `Georgia, 'Times New Roman', serif`.

## Finding a font file

```
python scripts/text_to_path.py --list-fonts               all .ttf/.otf found on this machine (system fonts, ./fonts, node_modules/@expo-google-fonts)
python scripts/text_to_path.py --list-fonts outfit        filter by file name
```

Licence: outline only fonts you may embed. Safe: **SIL Open Font License** and **Apache 2.0** families (Inter, Outfit, Manrope, Sora, Space Grotesk, DM Sans, Plus Jakarta Sans, Poppins, Montserrat, Nunito, JetBrains Mono, IBM Plex). Many projects already ship some (`@expo-google-fonts/*` packages are OFL). **System fonts such as Arial, Segoe UI or Helvetica are NOT for a logo you will sell or register**: their licence does not clearly allow it. Say which font and licence you used in `brand.json`.

If you can only find a restricted font, tell the user, and either use the live-text fallback or ask them to supply a licensed font.

## Outlining a wordmark

```
python scripts/text_to_path.py --font Outfit_700Bold.ttf --text "Lumora" --size 120 --tracking 6 --kern "Lu:-4" --x 0 --y 120 --fill "#0B1020" --json
```

`--json` gives `width`, `cap_height`, `x_height`, `ascent`, `descent` and the ready `<path>` element. Use those numbers to lay out the lockup:

- Horizontal lockup: icon height `H`; wordmark cap height about `0.55 H`; set `--size` so that `cap_height` is that; vertical centre the wordmark on the icon centre: baseline `y = icon_centre_y + cap_height / 2`.
- Two-part names ("Lumora Labs"): make **one** part heavier (primary name bold, descriptor regular or light, or smaller in the same line). Outline each part separately (two calls) and place them with a gap of about 0.25 em.

## Spacing and kerning

The tool does not read the font's kerning table. Check pairs by eye in the render and correct them:

- Tracking: **bold wordmarks +0 to +20** (units of 1/1000 em), regular +10 to +40, ALL CAPS **+60 to +120** (capitals need air), small sizes more.
- Pairs that usually need tightening: `LT LY LV AV AT AY TA VA YA` and a letter followed by a round letter (`ro`, `ra`). Pairs that touch: `rn` can read as `m` (add 8 to 15).
- The **even-colour test:** the white space between letters should look equal. Squint: dark blotches or holes mean wrong spacing. Use `--kern "Lu:-4,or:-2"` for single pairs.
- Optical alignment: round letters (`o`, `c`, `e`) should overshoot the baseline and x-height by about 1% to prevent looking small, which the font's design usually already includes.

## Choosing the type

| Tone | Direction |
|---|---|
| Modern, technical | Geometric or neo-grotesque sans (Outfit, Sora, Inter, Space Grotesk), medium to bold |
| Trustworthy, financial | Slightly wider sans with large x-height (Manrope, DM Sans, IBM Plex Sans), semibold |
| Friendly, consumer | Rounded or soft geometric (Nunito, Poppins), bold, lower case works well |
| Premium, minimal | Light to regular weight, wide tracking, lower case or small caps |
| Developer, hacker | Monospace or a grotesque with a technical detail (JetBrains Mono, Space Mono) |

Case: lower case reads friendlier, Title Case neutral, ALL CAPS formal and needs extra tracking. Keep a single typeface in the wordmark, at most two weights.

## Customising one detail

A small unique detail makes a wordmark ownable: a dotted letter replaced by a shape from the icon, a cut crossbar, an open counter, a shared stroke between two letters. Do it by drawing the shape on top of the outlined path (for example replace the dot of an `i` with the icon's circle), and keep the change to **one** letter.

## Checks before accepting a wordmark

- [ ] No `<text>` left in the file (or the fallback stack is stated).
- [ ] Even spacing at 100% and at 25% size; no touching letters at small size.
- [ ] Weight matches the icon's stroke weight.
- [ ] Readable at 120 px wide (the minimum for the horizontal lockup).
- [ ] The font and its licence are written in `brand.json`.

## Emblem style pairing (used by `emblem.py`)

Name in **Poppins ExtraBold** (or Bold with `--weight bold`), two tones, no gap between the parts; descriptor in **Poppins Light**, ALL CAPS, wide tracking solved so the descriptor is 75% as wide as the name, cap height 34% of the name's, gap 41% of the name's cap height. Texture digits in **JetBrains Mono Bold**. All three are SIL OFL and ship in `assets/fonts/`. Kerning tables are not applied: check pairs in the render (`Au`, `ro`, `Cl`).
