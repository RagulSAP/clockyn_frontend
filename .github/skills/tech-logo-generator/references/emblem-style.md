# Illustrated emblem style (the default look of this skill)

The reference is the AuroCloud set in `logo-files/` (`aurocloud-binary.svg`, `-dark.svg`, `-icon.svg`): a gradient cloud filled with a binary texture, a dark server card lying over it, a heavy two-tone wordmark, a spaced light descriptor, a dark rounded-square app icon. `scripts/emblem.py` draws this style exactly, so you choose the ingredients instead of drawing paths by hand.

## Anatomy (what every emblem has)

| Layer | What | Rule |
|---|---|---|
| 1. Silhouette | One large closed shape: `cloud shield disc tile hex` | It is the **business in one object** (cloud for hosting, shield for security). Filled with a **3-stop diagonal gradient** (bottom-left to top-right). |
| 2. Texture | White glyphs clipped inside the silhouette, in **3 opacity tiers** (0.95 / 0.65 / 0.38) | It is **what the product is made of**: `binary` data, `hex` code, `dots` network, `lines` motion. Glyphs cut by the edge are intended. |
| 3. Object | A dark card (36 x 60) with a **3 unit white outline**, lying over the silhouette | It is **how the user touches it**: `server phone dashboard chart letter`. The white outline separates it from the texture. Inside: slate panels, one accent colour. |
| 4. Wordmark | Name in Poppins ExtraBold, two tones (ink + brand colour), no space | Split at the natural join (`Auro|Cloud`). One word, two tones. |
| 5. Descriptor | Light caps, wide tracking, slate | Optional: `TECHNOLOGIES`, `LABS`, `SYSTEMS`. Letter spacing is solved so its width is 75% of the name. |
| 6. App icon | The emblem on a dark `#0B1220` rounded square (radius 22%) | Emblem about 64% of the tile width. |
| 7. Dark version | Same shapes on `#0B1220`; name white, second tone a light tint of the brand colour | Make the tint at least 4.5:1 on the dark background. |

## Choosing the ingredients (state the reason in one line per concept)

| Business | Silhouette | Object | Texture | Palette |
|---|---|---|---|---|
| Cloud, hosting, SaaS, data | cloud | server, dashboard | binary | aurora, ocean |
| Security, compliance, identity | shield | phone, dashboard | hex | graphite, ocean |
| Mobile app, consumer product | tile | phone, letter | dots | sunset, aurora |
| Analytics, fintech, growth | disc | chart, dashboard | dots, lines | ocean, forest |
| Engineering, DevOps, infra | hex | server, dashboard | hex, binary | graphite, aurora |
| AI, automation | cloud, disc | letter, dashboard | binary, lines | aurora |
| Health, sustainability | disc, tile | phone, chart | dots | forest |

`python scripts/emblem.py list` prints every option. Use **three different** combinations for the three concepts (never three palettes of one idea). A literal object such as a cloud is wanted in this style; it is made distinctive by the texture, the card and the gradient, so the cliché rule of the minimal style does not apply here. Do not copy a famous mark: no bitten fruit, no swoosh tick, no overlapping circles in two colours.

## Palettes (3-stop gradients, with brand colour for the second name part)

`aurora` teal `#0F766E` > indigo `#4338CA` > violet `#7E22CE`, brand `#4338CA` (dark tint `#A5B4FC`) | `ocean` `#0E7490 > #2563EB > #4F46E5`, brand `#2563EB` | `sunset` `#F59E0B > #E11D48 > #7E22CE`, brand `#BE123C` | `forest` `#0F766E > #15803D > #4D7C0F`, brand `#15803D` | `graphite` `#475569 > #1E3A8A > #0F172A`, brand `#1E3A8A`.
Custom: `--gradient "#a,#b,#c" --brand "#hex"`. The script prints the contrast of the brand colour on white and of its dark tint on `#0B1220`; both must be at least 4.5:1, otherwise change `--brand` / `--dark-brand`.

## Rules the generator already follows (check them in the render)

- Gradient: 3 stops, one direction, no radial, no opacity on the gradient itself. Opacity is used only for the white texture tiers, inside the clip.
- Text is always outlined (Poppins, JetBrains Mono for the digits, both in `assets/fonts/`, SIL OFL). No `<text>`.
- No filters, no raster, no external references. Files are 40 to 60 KB because the glyphs are paths (limit 400 KB for this style).
- Clear space 25% of the logo height. Minimum sizes: emblem 32 px, horizontal lockup 180 px wide, stacked 96 px. Below 32 px use `favicon.svg` (frame and dots only, no texture).
- Mono versions are two-tone by design: shape colour plus a knock-out colour equal to the background (`logo-mono-black.svg` on white, `logo-mono-white.svg` on `#0B1220`).

## Self-critique for this style (in addition to the checklist in SKILL.md)

- [ ] The silhouette alone, in one colour, still names the business.
- [ ] The card is clearly in front: white outline visible on the light version.
- [ ] The texture is calm: digits are readable at 512 px and form a soft pattern at 64 px. No digit cut so that it reads as a wrong character.
- [ ] The two wordmark tones are both 4.5:1 or better on their background.
- [ ] The favicon (16 px) reads as a coloured shape with a dark card.
- [ ] Nothing in the mark is a brand you recognise.

## Files produced by `emblem.py package`

`emblem.svg` (mark only, transparent, for invoices and slides), `icon.svg` (dark app tile 512), `favicon.svg`, `wordmark.svg`, `logo-horizontal.svg`, `logo-on-dark.svg`, `logo-stacked.svg`, `logo-stacked-on-dark.svg`, `logo-mono-black.svg`, `logo-mono-white.svg`, `brand.json`. Then `build_package.py <slug> --round vN --final` renders the PNGs (icon 16 to 1024, lockups 1x and 2x, emblem 256 to 1024), `favicon.ico` and the brand sheet.
