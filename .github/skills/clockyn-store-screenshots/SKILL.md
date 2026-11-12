---
name: clockyn-store-screenshots
description: Make the Google Play and Apple App Store screenshots (phone and tablet, every size the stores ask for) from the REAL Clockyn app screens, designed as marketing images that make people tap Install: benefit headlines, elegant device frames, a story order, Play feature graphic, listing text with character limits. Use when asked for store screenshots, a listing refresh, a new language, or when the app UI changed and the store images must be redone.
---

# Clockyn store screenshots

A store screenshot is an advertisement. People decide in about three seconds, usually from the first two or three images in the search results,
and most never read the description. This skill turns the **real app screens** into a set of images where each one says one clear benefit,
looks calm and premium, and tells a story from "what is this" to "I want it".

You write one file (`config.json`: the headlines and which screens) and run one command. The app screens are never drawn or faked: they are
the app's own web build (phone and tablet size) running against the e2e mock backend. Marketing copy, backgrounds, device frames and callouts
are added around them.

## What it makes

| Store | Set | Pixels | Needed? |
|---|---|---|---|
| Google Play | Phone (2 to 8 images) | 1080 x 1920 | Required |
| Google Play | 7-inch tablet | 1200 x 1920 | Optional, recommended |
| Google Play | 10-inch tablet | 1600 x 2560 | Optional |
| Google Play | Feature graphic | 1024 x 500 | Required to publish |
| Google Play | App icon | 512 x 512 | Required |
| App Store | iPhone 6.9-inch (1 to 10 images) | 1320 x 2868 | Required for iPhone (Apple scales it to smaller iPhones) |
| App Store | iPhone 6.5-inch | 1284 x 2778 | Optional |
| App Store | iPad 13-inch | 2064 x 2752 | Required while `app.config.ts` has `ios.supportsTablet: true` |
| App Store | iPad 11-inch | 1668 x 2420 | Optional |

All in `scripts/targets.json`, the **one** place to edit when a store changes a rule (it records when it was last checked). Output is PNG without transparency.
Re-check Apple's page before each release: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications

## When NOT to use

- A photo of a real phone, a real status bar, the native camera or biometrics: this tool shows the web build, not a device. Say so and stop.
- A screen that needs real data or the real backend. The mock shows sample data (company "AuroCloud", people like "Priya Sharma"): that is fine as a demo, never present it as real customers.
- Claims the app cannot back up (see "Honest rules"). Do not write them, even if asked for "more punchy".

## Prerequisites (check, do not assume)

| Need | Check |
|---|---|
| Windows, Node 20+, Python 3.10+ with Pillow | `node -v`, `python --version`, `python -c "import PIL"` (`pip install pillow`) |
| Repo deps installed | `node_modules` in the repo root (`npm install`) |
| Playwright Chromium | `npx playwright install chromium` if the run complains |
| Outfit font (the app's own font) | `node_modules\@expo-google-fonts\outfit` exists (it is an app dependency) |

The repo root is found automatically (`.github/skills/clockyn-store-screenshots/scripts/` is four levels below it). Otherwise set `STORE_REPO_ROOT`.

## Marketing principles (read before writing any headline)

### 1. Story order: the first three images carry the listing

Both stores show about the first three images in search and on the listing before anyone scrolls. Put the strongest benefits first, the
nice-to-haves last. A set that works for Clockyn (owner or HR of a small business, India, busy, not technical):

| # | Job of the image | Clockyn default |
|---|---|---|
| 1 | **Hook**: the main outcome in the user's words | Punch in with one tap (attendance) |
| 2 | **Control**: what the owner gets | Your whole team, at a glance (dashboard) |
| 3 | **Differentiator**: what others do not do | See where field staff are now (live location) |
| 4 | **Saves time / money** | Salary sheets made for you (payroll) |
| 5 | **Removes a daily pain** | Approve leave in one tap (requests) |
| 6 | **Proof of completeness** | Reports ready to share |
| 7 | **Belonging** | Keep your team connected (chat) |
| 8 | **Closing nudge** | Invite a friend, both save 10% (refer and earn) |

Play takes 8, App Store takes 10. Fewer strong images beat more weak ones: 5 to 8 is right. Drop a screen that does not earn its place.

### 2. Headlines that sell

- **One idea per image, 3 to 7 words.** It must still be readable when the image is a thumbnail the size of a postage stamp.
- **Outcome, not feature.** "Punch in with one tap", not "Attendance module". "Approve leave in one tap", not "Request management".
- **Start with a verb or the user's gain** ("See", "Approve", "Know", "Run", "Save").
- **Highlight the 1 to 3 power words** with `<em>` (they turn the accent colour): "Your whole team, <em>at a glance</em>".
- **Plain words** a shop owner understands. No "ecosystem", "seamless", "leverage", "solution". No jargon (HRMS, geo-fencing) in the headline; keywords belong in the listing text.
- **One short sub-line** (under 9 words) adds the proof: "Present, late and absent, live". Optional.
- **Same voice in every image**: same tense, same style of capitalisation (sentence case reads friendly).
- **Numbers only when true and stable** ("both save 10%" is a real feature; "save 20 hours a week" is not provable, leave it out).
- Local language: copy the config to a new work folder and translate the headlines (keep them short: Hindi and Tamil run longer, so check the overview sheet for wrapping). The app screens stay English until the app itself is translated.

### 3. Visual rules (what makes it look elegant, not busy)

- **The app is the hero.** The device is as large as the layout allows and bleeds off the bottom edge, so the real UI is big and legible. Never shrink it to make room for decoration.
- **One calm background family.** The default is deep green-black with a soft mint glow and one accent colour (the Clockyn green). `brand.flow: true` runs ONE gradient across the whole set, so the images flow into each other when the store scrolls them: a premium, continuous look. Use it only with palettes of the same family (all dark, or all light); mixing dark and light would make grey seams.
- **A status bar** (9:41, signal, battery) is drawn over the top of every phone picture, in the colour of the app header, because the web build has none and the camera hole would otherwise sit on top of the app title. It never covers app content: the picture is shifted down by that height (its bottom bleeds off anyway).
- **High contrast text**: white on dark, dark on light. Never put text over the busy part of the screen.
- **Vary the rhythm, not the style.** Layouts: `center` (calm, default), `tilt` (device rotated a few degrees, gives energy), `duo` (two screens, a second one behind). Use `tilt` for at most every second image and `duo` once. Keep the same palette family, fonts and corner radii.
- **Callouts**: 0 to 2 small floating cards per image ("Face verified", "Live", "10% off"). They are micro-proof and a focal point. Never cover the main UI element, never more than 2, keep them to 1 to 2 words.
- **No** stock photos, emoji, clip-art, star ratings you invented, laurels, arrows and "NEW!" bursts. They make a premium app look cheap, and invented ratings or awards can get a listing flagged as misleading.
- **Consistency of the real screens**: same company name everywhere (AuroCloud), same plan state, same theme (light) unless the image is about dark mode. No empty states, no error toasts, no "Acme Traders" or leftover test names. Fix the data you show, not the picture.

### 4. Honest rules (these decide whether the store accepts the images)

- Show the app **in use**: the screen in the image is the real screen. No features that are not in the build, no future screens, no mock-ups of a different UI. (Apple guideline 2.3.3 and Google's "Metadata" policy.)
- No unverifiable superlatives or rankings ("#1", "best", "fastest"), no prices, no "free" unless every user can really use it free, no store awards you do not hold, no other company's logo, no device maker's logo.
- No sample person that looks like a real customer testimonial. Sample names inside the UI are fine.
- **Maps:** the web build draws maps with OpenStreetMap tiles; the Android app uses Google Maps and the iPhone Apple Maps. The map screen is the same layout with a different map style. Keep it (it is the strongest "live location" proof) but tell the user, and they decide; a screenshot should never claim a map provider.
- Face attendance and live location are sensitive: say plainly what they do ("face-verified", "live locations of field staff"); never imply covert tracking.

### 5. Tablets

Apple needs iPad images while the app is marked as running on iPad (`supportsTablet: true`). Google rewards a real tablet set with better placement on tablets.
The tablet pictures are the web build at tablet width (1032 x 1376 at 2x), so each screen shows what the app lays out at that width: the wide layout with the
side menu. **Look at the tablet overview before shipping it.** At that width some screens are dense (tables, long lists: fine, they look professional) and some
are mostly empty (a punch screen, a short chat list: weak). Put the weak ones on `"forms": ["phone"]`; do not ship a sparse tablet image just to fill the slot.
Apple and Google need only 1 to 2 tablet images, so a set of 4 to 5 strong ones is right. If the app ever gets a real tablet layout, re-run and add them back.
To show a different tablet width (for example 834 for the 11-inch iPad), change `capture.tablet`; the screens then show that layout.

## Workflow

Use a work folder OUTSIDE the repo, e.g. `C:\POC\clockyn_store_shots\<release>\` (call it `$W`). Never commit images or work files.

### 1. Understand which screens sell

Open the screens in `src/app/**` and the e2e specs in `e2e/specs/` to find the route and a `testID` that proves the screen has loaded. Pick screens that show
a full, populated, good-looking state (the mock data decides what is there; do not edit the mock for a screenshot, pick a screen the seed data already fills).
Route keys are in `src/config/routes.ts` (`admin.home`, `admin.payroll.salarySheet`, `staff.home` ...); a plain path such as `/admin/home` also works.

### 2. Write `$W\config.json`

Copy `scripts/config.example.json` (a complete working Clockyn set of 8) and edit it.

```jsonc
{
  "app": { "name": "Clockyn", "tagline": "...", "logo": "assets/icon.png" },    // logo is used on the feature graphic and for the icons
  "brand": {
    "accent": "#06C270",
    "flow": true,                                   // one continuous background across the set (same-family palettes only)
    "sequence": ["midnight","forest", ...],         // palette per image; built in: midnight, forest (dark) and paper, mint (light). Override or add under "palettes"
    "palettes": { "name": { "from": "#..", "to": "#..", "glow": "#..", "text": "#..", "muted": "rgba(..)", "accent": "#..", "card": "rgba(..)", "cardText": "#.." } }
  },
  "capture": {
    "orgName": "AuroCloud",
    "settleMs": 1600,
    "allowInternet": true,                          // true = map tiles are real (needs internet on this PC); false = the e2e stubs, maps are blank
    "phone":  { "width": 390,  "height": 844,  "scale": 3 },
    "tablet": { "width": 1032, "height": 1376, "scale": 2 }
  },
  "stores": ["play", "appstore"],                   // leave one out to skip it
  "includeOptionalSizes": true,                     // false = only the required sizes
  "shots": [ ... ],                                 // in story order; see below
  "featureGraphic": { "headline": "...<em>..</em>", "sub": "...", "shots": ["punch","dashboard"] },   // Play 1024x500
  "listing": { "play": {...}, "appstore": {...} }   // draft text; the build checks the character limits
}
```

Each shot:

| Field | Meaning |
|---|---|
| `id` | file name part; unique |
| `role` | `admin` (default), `manager`, `staff`, `fieldStaff`: who is signed in |
| `route`, `params` | registry key or path, and its query params |
| `waitFor` | a `testID` that must be visible before the picture is taken (strongly recommended) |
| `theme` | `light` (default) or `dark` |
| `steps` | actions before the picture: `{"tap":"testid"}`, `{"tapText":"Label"}`, `{"fill":{"id":"testid","text":"..."}}`, `{"scrollTo":"testid"}`, `{"scrollBy":400}`, `{"hide":"css selector"}`, `{"waitFor":"testid"}`, `{"waitForMap":true,"optional":true}` (map screens: wait until real map tiles loaded), `{"wait":500}` |
| `forms` | `["phone"]` or `["tablet"]` to restrict; default both. **Use `["phone"]` for a screen that looks sparse or stretched at tablet width.** Each set then contains only its own shots, and the background flow and file numbers count within that set |
| `eyebrow` | tiny label above the headline ("Attendance"); 1 to 2 words |
| `headline` | 3 to 7 words, `<em>` around the power words; at most 3 lines (it shrinks to fit, and warns if it still does not) |
| `sub` | optional short line under it |
| `layout` | `center`, `tilt` (add `"tiltDir": 1` or `-1` to choose the side), `duo` (+ `"secondary": "<other shot id>"`) |
| `callouts` | up to 2: `{"text":"Face verified","icon":"check","x":0.06,"y":0.34}` where x and y are positions inside the device box (0 to 1). Icons: check pin gift bolt star users clock wallet chat. Callouts are made for phone sizes and are **off on tablets** unless the shot has its own `"tabletCallouts": [...]` |
| `palette` | override the palette of just this image |
| `maxLines` | most lines the headline may use (default 3); it shrinks to fit and warns if it cannot |

### 3. Run it

```powershell
cd C:\POC\clockyn_frontend
.\.github\skills\clockyn-store-screenshots\scripts\run.ps1 -Work C:\POC\clockyn_store_shots\v1
```

It builds the web app from the CURRENT code, captures every shot at phone and tablet size, composes all store sizes, and validates them. Switches:

- `-SkipBuild`: the app code has not changed since the last run (saves the build).
- `-ComposeOnly`: only `config.json` text or layout changed: re-makes the images from the pictures already captured (about a minute).
- `-SkipBuild -Only location,punch`: recapture just those screens (the other pictures are kept), then recompose. Use it to fix one screen without redoing all.
- It uses its own ports (18887 / 18888) and its own build folder, so it never disturbs your normal e2e runs. The temporary spec it adds to `e2e/specs/` is removed again; no other file in the repo is touched.

### 4. Review (this is where the quality comes from)

Open `$W\out\overview\*.png`: every set side by side, in upload order. Judge it like a shopper scrolling:

1. Cover the sub-lines and the fine print: can you still tell what the app does from the **first three images alone**?
2. Squint or zoom out to a stamp size: is every headline still readable? Is one idea shown per image?
3. Does the background flow from one image into the next? Any seam, mixed dark/light, or grey patch?
4. Is the real UI big and sharp, with no empty states, error toasts, cut-off text, "Acme", or a wrong company name?
5. Are callouts few, short, and not covering the main control?
6. Tablet set: does every screen look intentionally laid out, or like a stretched phone?
7. Read every headline aloud. Would a shop owner say it? Any claim you cannot prove? (Honest rules above.)

Fix in `config.json` and run `-ComposeOnly`. Repeat. The compose step prints **CHECK THESE** for headlines that do not fit, missing pictures and listing text over the limit.

### 5. Upload

`$W\out\manifest.json` lists every set in upload order with the Console path. The first image is the most important one.

- **Google Play Console:** Grow users > Store presence > Main store listing > Graphics: phone screenshots (`out\play\phone`), 7-inch and 10-inch tablet (`out\play\tablet-7`, `tablet-10`), feature graphic (`out\play\graphics\feature-graphic.png`), app icon (`app-icon-512.png`).
- **App Store Connect:** your app > the version > Previews and Screenshots: iPhone 6.9-inch (`out\appstore\iphone-6.9`), iPad 13-inch (`out\appstore\ipad-13`). Apple scales these to the smaller devices, so 6.9 + 13 is the minimum; the 6.5 and 11-inch sets are only for when you want to control those sizes. The 1024 app icon comes from the app build (`assets/icon.png`).
- **Listing text:** `out\listing.md` has the draft title, short text, subtitle, promo text and keywords with character counts (Play title 30 / short description 80; App Store name 30 / subtitle 30 / promo 170 / keywords 100). Put the main benefit and 1 to 2 real search words in the title and subtitle; the first lines of the long description are what people read.

### 6. Tell the user what you did

Report: the output folder and the overview sheets, the order of the story and the reason for it, anything you changed from their wording and why, anything dropped (a screen that looked weak, a claim you could not support), what is NOT verified (real devices, store review), and that Apple's sizes were last checked on the date in `targets.json`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `raw\report\*.json` says a shot failed | The route key or `waitFor` testID is wrong, or the screen needs a plan or role the mock does not give. Open the screen in the e2e web build, fix `route` / `waitFor` / `role`, run again. |
| An image shows the sign-in or an "unauthorised" screen | Wrong `role` for that route (employee screens need `staff` / `manager`; admin screens need `admin`). |
| A map is blank or one flat colour | The tiles did not load: this PC needs internet access to `tile.openstreetmap.org`, and `capture.allowInternet` must be `true` (it is by default). The validation prints a warning "map tiles did not load". Recapture with `-SkipBuild -Only location` once online, or drop that shot. |
| A picture shows a loading skeleton | Raise `capture.settleMs` or add a `waitFor`. |
| Headline too long | The build warns; shorten it (3 to 7 words). |
| Colours differ between images | Mixed light and dark palettes with `flow: true`: use one family, or set `flow: false`. |
| A store rejects an image | Run `validate.py` (it runs automatically): wrong size, transparency (it removes alpha itself) or more images than the store takes. If a size changed, edit `targets.json`. |
| Old screens in the images | The web build is old: run without `-SkipBuild`. |
| Port already in use | Another run is open: close it, or edit the ports at the top of `run.ps1`. |

## Files

| File | Role |
|---|---|
| `scripts/run.ps1` | Does everything: build, capture, compose, validate |
| `scripts/config.example.json` | Complete example config (the Clockyn set of 8) |
| `scripts/targets.json` | The store sizes and limits (edit here when a store changes) |
| `scripts/shots.spec.template.ts.txt` | The temporary capture spec (copied into `e2e/specs/`, run, deleted) |
| `scripts/compose.mjs` | Builds the marketing images with the real screens, the Outfit font and the brand colours |
| `scripts/validate.py` | Checks sizes, transparency, counts; makes the overview sheets and the manifest |
