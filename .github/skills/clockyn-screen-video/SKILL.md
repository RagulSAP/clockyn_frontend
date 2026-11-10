---
name: clockyn-screen-video
description: Create a portrait screen-recording tutorial video with voice-over and captions from the REAL Clockyn app screens, ready to upload to the Video Hub. Completeness for the end user comes first, so the length follows the content (no fixed limit). Use when asked to make a how-to / FAQ / feature walkthrough video, a screen recording of an app flow, or a Video Hub video for admins, managers or employees.
---

# Clockyn screen-recording video

Produces `<slug>.mp4`: 1080x1920 portrait, 30 fps, H.264 + AAC, as long as the question needs (see "Coverage first" below), with

1. an opening question card (animated title, optional badge such as "Under a minute"),
2. the **real app** inside a phone frame, driven step by step, with a finger marker and tap ripple at the exact tap positions,
3. a caption box and a male voice-over for each step at normal pace, soft background music that dips under the voice and a progress bar (no step numbers anywhere: not spoken, not in the captions, not in the top-right pill).

The screens are real: the app's web build in a phone-size browser (390x844, 3x) against the e2e **mock backend**. Nothing is drawn or mocked up
per video. A video is two files you write (`config.json` and a recording spec) plus one command.

## When NOT to use

- A real-device recording (status bar, native keyboard, camera, biometrics): this tool cannot show those. Say so and stop.
- Screens that need the real backend or real data. The mock backend shows sample data ("Acme Traders", "Priya Sharma"); never present it as real customer data.
- A video that would need more than a few minutes. Split it only along natural tasks (for example "register" and "log in again"), and only if each part is still a complete answer on its own. Never cut content to hit a duration.

## Prerequisites (check, do not assume)

| Need | Check |
|---|---|
| Windows (voice uses built-in SAPI voices), Node 20+, Python 3.10+ on PATH | `node -v`, `python --version` |
| Repo deps installed | `node_modules` exists in the repo root (`npm install`) |
| Playwright Chromium installed | `npx playwright install chromium` if the e2e run complains |
| **Web build of the CURRENT app code** | `npm run e2e:build` (re-run after ANY app change, or the video shows old screens) |
| English voice | PowerShell: `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() \| % { $_.VoiceInfo.Name }` |

The repo root is found automatically (`.github/skills/clockyn-screen-video/scripts/` is four levels below it). If you copy the scripts elsewhere, set
`VIDEO_REPO_ROOT` to the `clockyn_frontend` folder.

## Workflow

Use a work folder OUTSIDE the repo, e.g. `C:\POC\clockyn_videos\<slug>\` (call it `$W`). Never commit videos or work files.

### 1. Understand the flow from the code, before writing anything

Open the real screens and read their labels. The narration and captions must name exactly what is on screen: the button text, the section
name, the field labels, which fields are required, what happens after saving (toast? which screen do you land on?).

- Find testIDs and labels: search `src/features/<feature>/screens/*.tsx` for `testID=` and the visible text. Existing specs in `e2e/specs/` show the flow and the selectors that work.
- Use the **role** the video is for in `loginAs(page, 'admin' | 'manager' | 'staff' | 'fieldStaff')`. Employee screens only open in the web build because the e2e build sets `EXPO_PUBLIC_ALLOW_WEB_EMPLOYEE=true`.
- Data needed on screen must exist in the mock (`e2e/mock-server/fixtures.js`, constants in `e2e/support/fixtures.ts`). Do not edit the mock for a video; pick a flow the seed data already supports.
- If the real UI differs from what the user described (for example the button is "+ Add", not "Add Staff"), follow the real UI and tell the user.

### 2. Write `$W\config.json`

Copy `scripts/config.example.json` (a complete working example: "How do I add a new staff member?") and edit it.

```jsonc
{
  "slug": "add-staff",                      // output file name <slug>.mp4
  "question": "How do I add a new staff member?",   // big animated title on the opening card
  "introIcon": "user-plus",                 // user-plus clock calendar wallet map-pin receipt users check play message
  "badge": "Under a minute",                // green chip on the opening card; "" hides it
  "watermark": "AuroCloud Technologies",    // small text at the bottom of every frame; "" hides it
  "voice": "Microsoft David Desktop",       // any installed SAPI voice (David = male US; Zira = female US)
  "rate": 0,                                // -10 slow .. 10 fast; 0 = normal speaking pace (2 was ~20% faster than normal)
  "music": "generated",                     // "generated" = soft ambient bed made by music.py; a path to your own royalty-free MP3/WAV; "none"
  "musicLufs": -28,                         // music loudness when nobody speaks (voice is -16); lower = quieter. It also dips ~6 dB under the voice
  "scenes": [ ... ],                        // scene 1 = the opening card, scenes 2..N = steps on the phone
  "endMark": "s4_end"                       // recording mark at the very end
}
```

Each scene: `pill` (top-right label; **always `""`: never show "Step 1", "Step 2"...**), `caption` (HTML, wrap the key words in `<em>` to colour them),
`narration` (plain text, what the voice says; keep it the same words as the caption), and for scenes 2..N `startMark` (the recording mark when that screen starts) and
`anchors`: `[{ "mark": "s2_tap", "at": 3.9 }]` meaning "the tap named s2_tap must land 3.9 s after this scene starts" (put it on the words "tap Add on the Staff card"). To choose `at`: render once with `-Preview`, read the scene lengths it prints, and estimate where the tap word falls in the sentence (character position / sentence length x scene length); then check a preview still taken at that second shows the finger pressing the target.
`"at": "realtime"` means "as long after the scene start as it really took in the recording" (use for typing/filling a form).

Writing rules for the script:
- Scene 1 is the question card, then one scene per action. A small task is about 4 scenes (~20 s); a full task has as many scenes as it needs. The render prints "longer than 30 s": ignore that warning, it is not a limit.
- **Coverage first.** The goal is that the end user can do the task after watching, so cover everything they need: every required field and step, the important optional parts, what they see when it works, and the common next action (for example logging in again after registering). Do not drop content to make the video shorter; 60 s, 90 s or more is fine when the content needs it. Before recording, list what a first-time user must know and check each item is in the storyboard.
- **No step numbers.** Do not say "Step one", "Step two"... in the narration, do not write them in the caption, and keep `pill` empty. Each scene just starts with its action; the scene order and the progress bar already show the sequence.
- **Company name is AuroCloud.** Run every recording with `VIDEO_ORG_NAME=AuroCloud` (read by `e2e/mock-server/fixtures.js`); in the register video type "AuroCloud". Check the stills for any "Acme Traders" or "Sunrise Traders".
- One scene per action or screen, 8 to 16 words per scene (split longer ones). Plain words, one action per sentence ("On Home, find Manage and tap Add on the Staff card.").
- Say the exact on-screen names. Do not promise anything the screen does not show.
- No jargon, no ids, no "simply"/"just". End with the outcome the user cares about ("Your employee can then sign in on their phone.").

### 3. Write the recording spec

Copy `scripts/record-flow.template.ts.txt` to `e2e/specs/zz-record-<slug>.spec.ts` in the repo (it is temporary) and replace everything between the
`FLOW` banners. Keep the recorder and helpers as they are. Build the flow from the helpers only:

| Helper | Use |
|---|---|
| `tap(testIdOrLocator)` | every click (records the finger position after the element stops moving) |
| `type(testId, text)` | tap a field and type visibly |
| `pick(triggerTestId, optionLabel)` | open a dropdown/sheet and choose an option |
| `scrollTo(testId)` / `smoothTo(testId)` | smooth scroll (never jump); wait about 1.4 s after a long scroll |
| `mark(name)` | name a moment that `config.json` refers to (startMark, anchors, endMark) |

Pacing rules (the voice-over at normal pace is ~12 words per 5 s; the recording is re-timed to it, so keep each segment's real speed within 0.5x to 2x):
- Start with the first screen already settled (the template waits 1.8 s before recording).
- One `mark()` per scene start; a tap that the narration mentions gets its own mark and anchor.
- Leave 1 to 2 s of calm before the last tap so the finger can travel to the button, and 3 to 4 s after the result so the outcome stays on screen.
- Use realistic sample values from the mock ("Priya Sharma", "9876543210"). Never type real people's data.
- If a screen needs a state the seed lacks, change state through the mock control API (`mock` fixture, see `e2e/README.md`), not by editing the mock.

### 4. Record

```powershell
cd C:\POC\clockyn_frontend
npm run e2e:build        # skip only if the build is already from the current code
$env:VIDEO_WORK_DIR = "C:\POC\clockyn_videos\<slug>"
npx playwright test -c e2e/playwright.config.ts e2e/specs/zz-record-<slug>.spec.ts --project phone
```

It must end with `RECORDED <n> frames; <n> taps; marks {...}` and `1 passed`. Every mark named in `config.json` must be in that list.
If it fails on a selector or timing, fix the spec and re-run; do not weaken the flow into something the screen does not do.

### 5. Preview, then render

```powershell
$S = "C:\POC\clockyn_frontend\.github\skills\clockyn-screen-video\scripts"
powershell -File $S\render.ps1 -Work $W -Preview "1.5,6,10,14,18"   # seconds into the video: fast stills, no video yet
```

Look at every `$W\preview-*.png` (open the images). Check: nothing overlaps or is cut off, captions fit in two lines, the finger is on the thing
being described, the right screen is showing when the words describe it. The render prints the **playback speed per segment**; a warning means the
recording pace and the narration disagree: change `at`, the `waitForTimeout` pauses, or the sentence length.

When the previews are right:

```powershell
powershell -File $S\render.ps1 -Work $W          # about 3 to 5 minutes (frame-by-frame render, then ffmpeg)
```

Output: `$W\<slug>.mp4`. Reuse `-SkipTts` when only visuals changed. First run creates `$W\venv` (installs `imageio-ffmpeg`, which bundles ffmpeg).

### 6. Verify the finished file (do not skip, do not claim success from the render log)

```powershell
& "$W\venv\Scripts\python.exe" $S\check.py "$W\<slug>.mp4" "$W\check"
```

- Open the stills it writes. Compare them with the intended storyboard (opening card, each step's screen, the final result).
- Expect: H.264 High, `yuv420p`, AAC, 1080x1920, the length you planned (no fixed range), size a few MB per minute (Video Hub limit is 500 MB), audio mean about -25 to -12 dB. The audio must run to the last frame (music fades out at the end).
  A silent file reads about -91 dB.
- You cannot hear the audio. Say that you checked loudness and timing but did not listen.

### 7. Clean up and hand over

- Delete `e2e/specs/zz-record-<slug>.spec.ts`. `git status` must show no leftover spec, no work files, no video in the repo.
- Keep the spec as `$W\record-flow.spec.ts.txt` next to the video so the video can be re-recorded after a UI change.
- Tell the user: the file path, length and size, what the screens show, and the caveats below.

## Upload to the Video Hub

Web console (`UI_ADMIN_APP`) > Support > Video Hub > **Upload video**: enter a **Video name** (max 150 characters, phrase it as the question, e.g.
"How do I add a new staff member?") and choose the MP4 (MP4 with H.264 + AAC, max 500 MB). The app's Video Hub then lists it for users.

## Caveats to always state

- Voice is a Windows built-in SAPI voice (Microsoft David, male US): clear, but a little robotic, and US-accented. This PC has no Indian English voice. To get one, install it in Windows (Settings > Time & language > Speech > Add voices, English (India)); voices that appear only there (not in the list from the prerequisites) need `tts.ps1` switched to the Windows.Media.SpeechSynthesis API. A cloud neural voice (e.g. `en-IN-PrabhatNeural`) sounds far more natural but sends the narration text to an online service: ask the user first. Either way the only thing to replace is the `scene<N>.wav` files (render with `-SkipTts`).
- It is the app's web build in a phone-size browser with sample data, not a physical phone: no status bar, no native keyboard.
- The music is a generated soft ambient loop (no sampled audio, so no licence issue). Level is checked with numbers (about 20 dB under the voice while speaking), not by ear. The video is not tested inside the app's Video Hub player unless you uploaded and played it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Mark 'x' is in config.json but the recording never took it` | add `mark('x')` in the spec or fix the name in `config.json` |
| `Anchors must move forward in both clocks` | a later `at` is smaller than an earlier one, or marks are taken in a different order than the scenes |
| `WARNING: a segment plays faster than 2.5x` | the recording of that part is long for its sentence: shorten the flow part, add a pause where the sentence is long, or lengthen the sentence |
| Video shows old UI | `npm run e2e:build` was not re-run after the app change |
| Finger is off the target | tap through `tap()/type()/pick()` only; do not call `.click()` directly in the flow |
| `Voice 'x' is not installed` | pick a name from the voice list (prerequisites) |
| `python -m venv failed` / `ffmpeg` missing | install Python 3 and put it on PATH; or put ffmpeg on PATH (mux.py falls back to it) |
| Playwright port in use / flaky servers | stop other `npm run e2e` runs; the e2e config reuses running servers |
| Screens for staff/employee show the "mobile only" modal | the e2e build sets `EXPO_PUBLIC_ALLOW_WEB_EMPLOYEE=true`; rebuild with `npm run e2e:build`, do not use a normal web build |

## Which video to make

`video-list.txt` (next to this file) is the agreed list of 28 videos (ID, title, role, storyboard, what can and cannot be recorded, status). When the user says "make V07", read that entry, then follow the workflow above. One video per request. Update the STATUS line to DONE when a video is handed over.

## Files in this skill

`scripts/config.example.json` (worked example), `record-flow.template.ts.txt` (recording spec), `render.ps1` (one command: voice, timing, anchors, music, frames, MP4), `music.py` (music bed),
`tts.ps1`, `timing.py`, `build_src.py`, `video.html` (opening card, phone frame, finger, captions), `capture.mjs` (frame renderer), `mux.py` (ffmpeg), `check.py` (verification stills and loudness).
