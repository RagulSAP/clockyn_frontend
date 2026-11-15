---
title: Video Hub (guide videos for the app)
summary: How to upload, preview, rename, hide and delete the guide videos that appear in the app's Support > Video Hub, and what the Videos tab shows.
category: Support
audience: operator
tags: video hub, videos, guide video, upload, mp4, preview, rename, activate, deactivate, delete, s3, support tab
page: videos.html
updated: 2026-11-15
related: video-views, faq-hub, live-chat, roles-and-permissions
---

The Video Hub is a library of short how-to videos. Whatever you mark Active here appears in the app under Support > Video Hub ("Watch step-by-step guides"). The Videos tab is the first of two tabs in Video Hub; the second is [Views](kb:video-views). Any operator can look at and preview videos. Only a super admin can upload, rename, hide or delete them.

## How the app uses the videos
In the Clockyn app, the company admin opens the Support area and chooses **Video Hub**. The app lists every Active video, oldest first. There is no way to reorder videos: the order is simply the order they were added. When the admin taps a video it plays in a player, and the console records one "view" (see [Video Views](kb:video-views)).

The app keeps the list for about five minutes, so a newly uploaded or newly hidden video can take up to five minutes to show up or disappear on a phone that already has the screen open. Pulling down to refresh in the app updates it at once.

## What the Videos tab shows
Four tiles: **Total videos** (everything in the library), **Active** (visible in the app), **Inactive** (hidden from the app) and **Total views** (how many times app users opened videos).

Use **Search videos...** to filter by name. The table has these columns:

| Column | Meaning |
|---|---|
| Video | A play thumbnail, the name, and the storage path of the file underneath. |
| Status | **Active** (green) is visible in the app; **Inactive** (grey) is hidden. |
| Views | How many times app users opened this video. |
| Added | When the video was added, in India time. |
| Actions | **Preview** for everyone; Activate/Deactivate, Rename and Delete for super admins only. |

## Upload a video
Who can do this: super admin only. The **Upload video** button is hidden for other operators.

1. Click **Upload video**.
2. Choose the **Video file**: click the box or drag a file onto it. Use MP4 (H.264 video, AAC audio) so it plays on every phone and browser. The maximum size is 500 MB; larger files are refused with "This file is larger than 500 MB. Please compress it and try again." Only video files are accepted.
3. Check the preview. The page tests whether your browser can play the file. If it cannot, you see a warning and the Upload button stays off, because the same file would probably not play in the app either.
4. Type the **Video name**. It is filled in from the file name, but replace it with a clear name of up to 150 characters, written as the question the video answers, for example "How do I mark attendance?". Companies look for answers by their problem, not by file name.
5. Click **Upload**. You see "Uploading..." with a percentage, then "Saving...". Do not close or leave the tab: the browser warns you if you try.
6. When it says **Upload complete**, play the stored copy to confirm it works, then click **Done** or **Upload another**.

New videos are Active immediately. Behind the scenes the console asks the backend for a one-time upload link (valid for one hour) and sends the file straight to storage, so large files never pass through the API. The file is stored under a `guide_videos/` folder with a unique name. For this to work the storage bucket must allow uploads from the console's web address; if it does not, you see "Upload to storage failed. Check your connection and the bucket CORS settings (PUT from this site must be allowed)."

## Preview, hide, rename and delete
- **Preview**: click Preview, the thumbnail or the name. A player opens. If it says the format may not be supported or the link has expired, refresh the list and try again.
- **Deactivate / Activate** (super admin): hides or shows the video in the app. Use it to take a video down temporarily. A toast confirms "Video activated" or "Video deactivated".
- **Rename** (pencil icon, super admin): opens "Rename video". The name is required and up to 150 characters.
- **Delete** (trash icon, super admin): asks you to confirm "The video file will be removed from storage. This cannot be undone." Deleting removes the video and its file, but the view history stays and keeps the video's name.

## What can go wrong
- **Upload button stays disabled**: the name is empty, no file is chosen, the file is over 500 MB, it is not a video, or your browser could not play it.
- **"Upload to storage failed"**: your connection dropped, or the storage bucket does not allow uploads from the console's address. A maintainer must fix the bucket settings.
- **Preview does not play**: the file is probably not MP4 with H.264 video and AAC audio, or the temporary link has expired. Refresh the page.
- **A hidden video still shows in the app**: the app may be showing its cached list; it updates within about five minutes or on pull to refresh.
- **No upload button**: your account is not a super admin. Ask one to upload for you.

## Common questions
### How do I change the order of videos?
You cannot. Videos appear oldest first. To place a video earlier you would need to re-upload it, which adds it as the newest.

### Can I replace a video file but keep its view count?
No. Upload the new file, hide or delete the old one. Views belong to the video you uploaded.

### Is there a size or length limit?
The page blocks files over 500 MB. There is no length limit, but short guides of one or two minutes work best.

### What happens to views when I delete a video?
The view history is kept with the video's name, so the Views tab still shows past activity.

### Do companies see Inactive videos?
No. Only Active videos are sent to the app.

### Who can see the Videos tab?
Every operator. Only super admins see the upload, activate, rename and delete controls.
