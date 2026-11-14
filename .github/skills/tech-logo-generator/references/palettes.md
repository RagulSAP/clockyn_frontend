# Palettes by industry and tone

Pick ONE row from the industry, then adjust for tone. Every colour is a hex code. Contrast numbers are real WCAG ratios (computed with
`build_package.py`'s own function), so you can see which pairing is safe for a mark: **3:1 or more for a graphic, 4.5:1 or more for small text.**

## How to use a palette

- A logo uses **2 colours, at most 3**: the **primary** (the mark), one **accent** (a single highlight shape or a letter), and **ink** (the wordmark, if it is not the primary).
- `paper` is the light background (default `#FFFFFF`); `dark_bg` is the dark background. Put both in `brand.json`: the brand sheet checks the contrast for you.
- Accents are bright, so they usually fail 3:1 on white (column "accent / white") but pass easily on dark. **On white, draw the mark in the primary and keep the accent to a small shape; on dark, use `primary_on_dark` for the mark and the accent freely.** Never put a light accent on white as the only visible colour of a mark.
- The on-dark version is not a colour inversion: take the lighter `primary_on_dark` tone, keep the same shapes, and re-check the contrast.

| Industry / tone | primary | secondary | accent | ink | primary_on_dark | dark_bg | primary / white | accent / white | accent / dark | primary_on_dark / dark |
|---|---|---|---|---|---|---|---|---|---|---|
| Fintech, payments, banking (trust, precision) | `#0F3D8A` | `#0E9F9A` | `#F5B700` | `#0B1220` | `#7FB0FF` | `#0A1428` | 10.2 | 1.8 | 10.2 | 8.4 |
| AI, developer tools, data infra (modern, technical) | `#4F46E5` | `#8B5CF6` | `#22D3EE` | `#0B1020` | `#A5B4FC` | `#0B0F1A` | 6.3 | 1.8 | 10.6 | 9.6 |
| Health tech, wellness, bio (calm, caring) | `#0F766E` | `#16A34A` | `#34D399` | `#0B1F1C` | `#5EEAD4` | `#07201D` | 5.5 | 1.9 | 8.9 | 11.5 |
| Security, compliance, identity (serious, sharp) | `#0B1B3A` | `#1E40AF` | `#FF4D6D` | `#0B1220` | `#8FB4FF` | `#070D1C` | 17.0 | 3.2 | 6.0 | 9.4 |
| Analytics, BI, productivity (clear, friendly) | `#2563EB` | `#0891B2` | `#F59E0B` | `#0F172A` | `#93C5FD` | `#0B1220` | 5.2 | 2.1 | 8.7 | 10.4 |
| Climate, energy, sustainability (grounded, hopeful) | `#166534` | `#0F766E` | `#84CC16` | `#0F1F14` | `#86EFAC` | `#08150D` | 7.1 | 2.0 | 9.5 | 13.3 |
| Cloud, infrastructure (dark, minimal) | `#111827` | `#374151` | `#F97316` | `#030712` | `#F9FAFB` | `#030712` | 17.7 | 2.8 | 7.2 | 19.3 |
| Consumer app, social, playful (energetic) | `#7C3AED` | `#EC4899` | `#FBBF24` | `#1E1033` | `#C4B5FD` | `#150B26` | 5.7 | 1.7 | 11.4 | 10.3 |
| Education, edtech (approachable, optimistic) | `#1D4ED8` | `#0EA5E9` | `#F59E0B` | `#0F172A` | `#93C5FD` | `#0B1220` | 6.7 | 2.1 | 8.7 | 10.4 |
| Enterprise SaaS, B2B (neutral, dependable) | `#1F2937` | `#3B82F6` | `#10B981` | `#111827` | `#93C5FD` | `#0B1220` | 14.7 | 2.5 | 7.4 | 10.4 |
| Creative, design tools (bold, expressive) | `#E11D48` | `#7C3AED` | `#FACC15` | `#18181B` | `#FB7185` | `#111113` | 4.7 | 1.5 | 12.3 | 7.0 |
| Logistics, mobility, hardware (robust, kinetic) | `#0F172A` | `#0369A1` | `#FB923C` | `#0B1220` | `#7DD3FC` | `#0B1220` | 17.9 | 2.3 | 8.3 | 11.2 |

## Adjusting for tone

| Tone | Move the palette like this |
|---|---|
| Trustworthy, established | Deeper primary, fewer colours (one accent, small), no gradient |
| Playful, friendly | Brighter primary, rounder shapes, accent as a large shape; keep contrast above 3:1 |
| Futuristic | Near-black ink and `dark_bg`, one electric accent (cyan, violet, lime); a subtle 2-stop gradient is allowed if a flat version exists |
| Minimal, premium | One colour plus ink; lots of clear space; the accent used once or not at all |
| Warm, human | Shift towards teal-green, coral or amber; avoid cold blue-grey |

## Rules for choosing

1. Respect what the user asked for (colours to use or avoid) before the table.
2. Avoid the exact brand colour of a famous competitor in the same field (not blue-and-white for a payment app that looks like a known payment brand; not the single bright magenta of a known telecom).
3. Check red and green together: they are indistinguishable for some people; add a shape or lightness difference.
4. State the hex codes in the reply and in `brand.json`; never describe a colour only in words.
5. The one-colour versions (`logo-mono-black.svg`, `logo-mono-white.svg`) must still work: if two shapes only differ by hue, give them a visible gap or a different shape.

## Emblem style: gradient palettes

The emblem style uses a 3-stop gradient instead of the flat 2 to 3 colours above (`emblem.py list`, details in `emblem-style.md`). The colour budget is: gradient (3 stops), one brand colour for the second half of the name, one accent for the card details (dots, tall bar), neutrals (`#0B1220` ink and dark background, `#1E293B` and `#64748B` card interior, `#334155` / `#CBD5E1` descriptor).

| Palette | Gradient (bottom-left > top-right) | Brand colour | Accent | Dark tint of brand | Fits |
|---|---|---|---|---|---|
| `aurora` | `#0F766E` > `#4338CA` > `#7E22CE` | `#4338CA` | `#2DD4BF` | `#A5B4FC` | cloud, data, AI, modern SaaS |
| `ocean` | `#0E7490` > `#2563EB` > `#4F46E5` | `#2563EB` | `#22D3EE` | `#93C5FD` | trust, infrastructure, fintech |
| `sunset` | `#F59E0B` > `#E11D48` > `#7E22CE` | `#BE123C` | `#FCD34D` | `#FDA4AF` | consumer, creative, media |
| `forest` | `#0F766E` > `#15803D` > `#4D7C0F` | `#15803D` | `#A3E635` | `#86EFAC` | sustainability, health, agri |
| `graphite` | `#475569` > `#1E3A8A` > `#0F172A` | `#1E3A8A` | `#38BDF8` | `#93C5FD` | security, enterprise, legal-tech |

The brand colour must be 4.5:1 or better on white and its dark tint 4.5:1 or better on `#0B1220` (the script prints both). The gradient stops are graphics (3:1 against the white and dark backgrounds is enough). Avoid gradients that end in a near-white stop, they vanish on the light version.
