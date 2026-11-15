---
title: Video Views (who watched which guide video)
summary: How to read the Views tab of Video Hub, what counts as a view, what the tiles and the Activity and By Organization tables mean, and how to use them to spot features that confuse companies.
category: Support
audience: operator
tags: video views, views, watched, activity, by organization, analytics, engagement, export, most watched
page: video_views.html
updated: 2026-11-15
related: video-hub, clickstream, faq-hub
---

The Views tab (the second tab of Video Hub) shows which companies and people opened which guide video in the app. It answers "which topics do customers need help with, and who is struggling?". Any operator can read it and export it.

## What counts as a view
A view is recorded each time an app user taps a video in the app's Support > Video Hub and the player opens. It is counted when the video opens, not when it finishes, and every tap counts: one person opening the same video three times gives three views. Only Active videos can be opened, so hidden videos record nothing. The record keeps the user, their company and the video's name at that time. If a video is deleted later, its past views stay.

If recording a view fails (for example the phone has no signal at that moment), the video still plays and that view is simply missing.

## What is loaded
The page loads the **2000 most recent views**. The tiles and tables describe those views only. In a busy period older views fall out of the picture; the page does not show a date range.

## The tiles
| Tile | Meaning |
|---|---|
| Total views | Number of views in the current filter ("Times a video was opened"). |
| Unique users | Different people who watched ("People who watched"). |
| Unique organizations | Different companies reached ("Companies reached"). |
| Most watched video | The video with the most views, with its count. |

All tiles recalculate when you use the filters.

## Filters and export
- **Search org, user, email, mobile...** matches the company name, person name, e-mail or mobile number.
- The **All videos** drop-down limits everything to one video.
- **Export** offers **Export Excel** and **Export PDF** of whatever sub-tab is open (Activity or By Organization).

## The two sub-tabs
**Activity** is the raw list, newest first.

| Column | Meaning |
|---|---|
| Time (IST) | When the video was opened, in India time. |
| Video | The video name. |
| Organization | The person's company. |
| User | Name, then e-mail and mobile underneath. |
| Role | Admin, Manager or Staff. The app's Support area is meant for Admins, so most rows show Admin. |

**By Organization** groups the same views per company, most views first.

| Column | Meaning |
|---|---|
| Organization | Company name. |
| Views | Total views, with a small bar for comparison. |
| Users | How many different people from that company watched. |
| Videos watched | How many different videos, with the first two names shown and "+N" for the rest. |
| Last viewed (IST) | The most recent view. |

Click a company row in By Organization (when the company name is known) to jump to the Activity tab filtered to that company.

## Use the views to find confusing features
Who can do this: any operator.

1. Open the Views tab and read **Most watched video**. A video that is watched far more than the others usually points to a feature people find hard.
2. Check [Clickstream](kb:clickstream) for the same area. Many taps on a screen plus many video views suggests the screen needs a clearer design or a better FAQ.
3. Sort out whether it is one company or many: in By Organization, a single company with many views may just need a call; many companies each watching once means a general gap.
4. Add or improve a [FAQ](kb:faq-hub) entry for that topic, or record a clearer video in [Video Hub](kb:video-hub).
5. Come back after a week and compare.

## What can go wrong
- **"Couldn't load video views"**: the backend could not be reached. Use the refresh control or reload the page.
- **No video views yet**: nobody has opened a guide video yet. Views appear as soon as app users open one.
- **A company shows as unknown**: the company record was removed or could not be matched. The user's name may still show.
- **Numbers look too low**: only the latest 2000 views are loaded.

## Common questions
### Does a view mean the person watched the whole video?
No. It means they opened it.

### Why do some rows show Manager or Staff?
The role comes from the user's account. The Support area is intended for Admins, but any account that reaches it is recorded with its own role.

### Can I see views for just one company?
Yes. Type the company name in the search box, or click that company in By Organization.

### How far back does the list go?
It shows the 2000 most recent views, so the age of the oldest row depends on how busy the app is.

### Can I download the data?
Yes, use Export > Export Excel or Export PDF. The file contains what the current sub-tab shows.

### Are deleted videos still in the list?
Yes, with the name they had when they were watched.
