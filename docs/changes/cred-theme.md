# CRED-style theme

Look and feel re-skin. No behaviour, copy, route or API change.

## Design language
- Near-black canvas (`#0A0A0A`) in dark, warm off-white (`#F2F1EE`) in light.
- Raised surfaces: hairline border plus a lit top edge (`colors.highlight`), deeper shadows (`elevation`).
- Monochrome primary: `primary` is near-white on dark and near-black on light; text on it is `onPrimary`.
- Colour is reserved for meaning: success / warning / danger / info, attendance status colours, money.
  Decorative tints (rainbow tiles, hashed accents, blue "selected" states) were removed.
- Hero surfaces (`Card variant="gradient"`, auth brand panel, splash) are graphite in both themes.
  Text and icons on them use the new `onGradient` token (never `onPrimary` / `textInverse`).
- Type: Outfit (geometric, Gilroy-like) in the same five weights as before (400-800), tighter display / title tracking,
  wide-tracked `micro` labels. Font files come from `@expo-google-fonts/outfit`; Inter was removed.
- Radii: `lg` 22, `xl` 32.

## Tokens (`src/theme/colors.ts`, `tokens.ts`)
New: `highlight`, `onGradient`. Changed: every surface / text / brand / semantic / status value, both themes.
Contrast of text pairs is AA (4.5:1); `border` on dark surfaces is a hairline by design, so input fields use `borderStrong`.

## Shared components
- `Card`: bevel (1px border, `borderTopColor: highlight`); zero-padding cards clip rows to the rounded corners.
- `Button`: primary / danger / success have a darker lower lip (`edge`) that flattens and drops 2px on press;
  disabled is a flat `surfaceMuted` / `textMuted` control (no longer a 50% dimmed live button).
- `Avatar`: monochrome initials palette plus `success`.
- `Badge`: `neutral` is outlined so it stays distinct from `primary` in dark.
- `SegmentedControl`: the dark thumb is `borderStrong` so it reads as raised.
- `BrandMark`: the ring is a metallic `text` to `textMuted` gradient.
- Fields: default border `borderStrong`, hover `textMuted`.

## Per-area changes (sweep)
- Admin: web map follows the theme (graphite tiles in dark, readable pin labels); selected rows / calendar days use text, not blue.
- Billing / CRM: plan tiers are monochrome; staff-limit meter on the plan card; stat grid is 3 columns on desktop.
- Chat / requests / announcements: default and "Dark" chat themes are graphite; hub tiles monochrome; read ticks readable on light bubbles.
- Employee: the punch button is the hero (152px disc, glow ring, halo rings); 56px shift countdown numerals.
- Exports (PDF / print): white paper, `#0D0D0D` headers instead of indigo.
- Team rules: decorative info badges and rainbow manager strips neutralised.

## Shared motion kit (`src/components/ui/motion`, exported from `@/components/ui`)
`Reveal` (staggered fade + rise entrance), `ProgressRing` (animated sweep), `SnapCarousel` (snap swipe, dots, web arrows),
`ActionCard` (graphite hero card, `compact` strip variant for stacks), `EntityCard` (live count + Add button), `useReduceMotion`.
Use them instead of re-implementing; all honour reduced motion.

## Admin home redesign (`src/features/dashboard`)
- **Staff Overview** (`StaffOverviewRings`): a horizontal snap carousel of progress rings (each figure's share of total staff).
  The ring sweeps in on load and on change (animated SVG attribute, no per-frame React renders); the focused ring is full size,
  neighbours are smaller and dimmer; pagination dots stretch to a pill; web adds arrow buttons beside the dots. Test ids
  (`figure-<key>`, `figure-<key>-value`, `summary-card`, `summary-open-overview`) are unchanged.
- **Quick Actions** (`QuickActions`): three graphite cards stacked one on top of another so all of them fit on one screen:
  the first two show a header strip (icon, title, blurb, badge, arrow), the last is shown in full. Ids `qa-location`,
  `qa-reports`, `qa-requests`, `qa-requests-badge` are unchanged; Staff Location still shows a lock when the plan blocks it.
- **Manage** (`ManageCards`): one card per entity (Staff, Branches, Departments) with a live count; tapping the card opens the list
  (`manage-view-<staff|branch|dept>`), the Add button creates one (`manage-add-<...>`). Counts refresh after adding.
- **Entrance**: each section fades and rises in turn (`Reveal`, 80 ms stagger). All motion honours the OS reduced-motion setting.

## Rollout beyond the home page
Same patterns, applied only where they fit (forms, tables, calendars, maps, chat threads and checkout keep their layout):
- **Staff app**: home sections enter with a staggered `Reveal`; the Requests hub (4 cards) and Expenses hub (3 cards) are stacked `ActionCard`s with the same test ids and pending badges; the staff chat hub channel list gets a `Reveal`.
- **Admin**: the Overview status tiles each wear a share-of-staff `ProgressRing` (ids unchanged); the Requests hub and the Incentive type chooser are stacked `ActionCard`s; org lists, shifts, holidays, attendance rule, company, location, announcements, reports (shared `ReportScaffold`) and the admin chat hub get one-shot `Reveal` entrances.
- **Billing / CRM / account**: used-vs-limit staff capacity is a `ProgressRing` on the plan card; the CRM "Work Status Overview" tiles are a swipeable ring carousel (share of the day's leads, tapping a ring still filters); welcome, billing screens, settings, support, suggest-feature, permissions, more-options and the CRM hub get `Reveal` entrances.
- `ActionCard` exposes the blurb and pending count through `accessibilityHint` and accepts `badgeTestID`.

## Brand assets
`node scripts/generate-brand-assets.js` regenerates every raster in `assets/` from the `BrandMark` geometry (Chromium via
`@playwright/test` rasterises the SVG): `icon.png` (graphite gradient tile, white mark, mint dot), the three Android adaptive
layers, `splash-icon.png` (dark mark, light splash `#F2F1EE`), `splash-icon-dark.png` (white mark, dark splash `#0A0A0A`),
`favicon.png`, `notification-icon.png` (white alpha mask). The notification accent colour is mint `#06C270`.

## Not changed
- Chat colour themes other than Default / Dark (Ocean, Forest, ...) keep their own colours (user content).
- Theme preference still defaults to `system`.
