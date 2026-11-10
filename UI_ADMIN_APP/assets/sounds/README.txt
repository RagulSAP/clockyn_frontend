Notification sound of the admin web app (Live Chat)
====================================================

Put your own sound here, named exactly:

    notification.mp3

and the admin web app plays it every time a new Live Chat message arrives.
There is no setting to change and nothing to rebuild: save the file, then press Ctrl+F5 in the browser.

If the file is missing (or the browser cannot play it) the app uses its built-in two-note chime, so nothing breaks.

Tips
- Keep it short: 1 to 3 seconds. A long file is cut off by the next message.
- MP3 is the safest format. Normal volume is fine; the app plays it at 80%.
- Use a sound you own or one that is free for commercial use. Do not use a copyrighted ringtone.
- Test it: open the browser console (F12) on any admin page and run   ClockynLiveChat.testSound()
  The browser plays sound only after you have clicked somewhere on the page once.
- To silence it from the browser console run   ClockynLiveChat.setMuted(true)   (and   ClockynLiveChat.setMuted(false)   to turn it back on).
- A different file name or place: before the script runs set   window.CLOCKYN_NOTIFY_SOUND = 'path/or/url.mp3'
  (rarely needed).

When you host the admin app online (S3 / CloudFront), upload the whole assets\sounds folder with the rest of the app.
This is only for the web console. The phone app has its own notification sound (set in the app build, not here).
