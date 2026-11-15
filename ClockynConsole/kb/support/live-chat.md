---
title: Live Chat with companies
summary: How a chat starts (from the app, or from the Organizations page) and how operators answer in the console: floating button, full page, unread counts, closing, attachments, sound.
category: Support
audience: operator
tags: live chat, chat, support chat, reply, start chat, new conversation, unread, close conversation, reopen, attachment, notification, chime, floating button, panel, offline, reconnecting
page: live_chat.html
updated: 2026-11-15
related: start-a-chat-with-a-company, tickets-and-bugs, console-tour, troubleshooting
---

Live Chat is the real-time channel between a company's admin (in the Clockyn app) and the support team (operators in the console). Any operator can answer. There is one conversation per company, and you reach it from the chat button at the bottom right of every page or from the full Live Chat page.

## How a conversation starts
A company admin opens the Support area in the app, chooses **Live Chat** ("Chat with our support team") and writes a message. Only the company's admin (role Admin) can chat; managers and staff cannot. Chat is available even if the company's plan has lapsed.

The app shows a banner with the support hours, **Mon - Fri, 10 AM - 6 PM IST**, an Online or Offline pill and a promise: "We usually reply within 5 minutes" while open, or "We're offline right now. We'll reply followed by the next opening time" outside hours. These hours and the 5-minute target are what the app tells customers; aim to meet them.

Support can start a conversation too. On the Organizations page an operator clicks the Chat icon on a company's row and writes the first message; see [Start a chat with a company](kb:start-a-chat-with-a-company). A company appears in the list once either side has sent a first message. A company writing again to a closed conversation reopens it automatically. When you send a message, the company's admins also get a phone notification if push is set up on their device.

## Where to find Live Chat in the console
- **Floating chat button** (bottom right of every page except the Live Chat page): a round button with a red number for unread messages. Click it to open a compact chat panel above the button. On a phone the panel fills the screen. The panel header shows **Live Chat**, a Live or Reconnecting status, **Open full page** and a close button. Press Escape to close it.
- **Bell menu**: the line "Live chat - N unread" opens the same panel.
- **Organizations page**: the Chat icon in a row's Actions opens the panel for that company, ready for your first message.
- **Full page**: Live Chat page (link **Open full page**, or the address `live_chat.html`). It has the sound and notification controls that the panel does not.

## The conversation list
The left side lists conversations, newest message first (up to 500). Use **Search organizations or messages** (matches company name, admin name, e-mail, mobile and the last message). Tabs: **All**, **Unread** (with a count), **Open**, **Closed**.

Each row shows the company's initials, name, how long ago the last message was, a preview (your own last message starts with "You:"; pictures show "Photo"; files show the file name), and either a red unread number (99+ when large) or a grey "Closed" tag.

**Unread** means messages from the company that no operator has read yet. This is shared across all operators: when one operator opens the conversation, it is read for everyone.

## Reply to a company
Who can do this: any operator.

1. Click a company in the list. The conversation opens with the company name, an Open or Closed chip, and the admin's name, e-mail and mobile (small copy icons copy the e-mail and the number). The company name is a link to that organisation's analytics page.
2. Type in **Write a reply**. Press Enter to send. A message must not be empty and can be at most 4000 characters.
3. To send a file or picture, click the paperclip ("Attach a file (up to 10 MB)"). Pictures open a preview where you can **Crop** or **Reset** before **Send**; other files show a file card. Nothing is uploaded until you click Send.

Your messages show one tick when sent and two when the company has read them. Your name on the message comes from your operator account, or "Clockyn Support" if there is none.

If you scroll up while new messages arrive, a pill such as "2 new messages" appears; click it to jump to the end.

## Close and reopen a conversation
Who can do this: any operator.

1. In the conversation header click **Close conversation**.
2. Confirm. The message explains that if the company's admin writes again it reopens automatically.
3. A closed conversation hides the reply box and shows "This conversation is closed. Reopen it to reply." with a **Reopen** button.

Closing does not message the company. It only moves the conversation to the Closed tab.

## Delete a message
Who can do this: any operator. Hover a message, open the three-dot menu and choose **Delete message**, then confirm. The message is removed for everyone, including the company's app, and cannot be restored. Attachments are removed from storage too.

## Sound, desktop notifications and the unread badge
On the full Live Chat page the top bar has:
- A status badge: **Live** (green), **Reconnecting** (orange) or **Connecting...**.
- **Sound on / Sound off**: mutes the new-message chime. The choice is remembered in that browser only.
- **Enable notifications / Notifications on / Notifications blocked**: allows desktop notifications. Browsers only ask when you click, so this must be done on the full page. If blocked, allow notifications for the site in the browser's settings.

For each new message from a company, the console plays the chime, raises the unread count and, if allowed, shows a desktop notification, unless you are looking at that exact conversation in a focused window. The tab title gets a prefix such as "(3)". This works on every page.

## What happens when the connection drops
The console keeps one live connection. If it drops, the badge says Reconnecting, the console checks for new messages every 20 to 30 seconds and keeps trying to reconnect.

## What can go wrong
- **Badge stays on Reconnecting**: check your internet and reload the page. If it persists, tell a maintainer.
- **No chime**: check Sound on, the browser's tab sound, and that you did not already have that conversation open and focused.
- **Starting a chat fails (404 or 409)**: the company is deleted, or it has no active admin to chat with. See [Start a chat with a company](kb:start-a-chat-with-a-company).
- **File refused**: files larger than 10 MB are blocked ("That file is larger than 10 MB").
- **Notifications blocked**: allow them in the browser's site settings, then reload.

## Common questions
### Can I start a chat with a company?
Yes. Click the Chat icon on the company's row on the Organizations page and send the first message. Nothing is created until you send it.

### Why does the panel not have the sound button?
The sound and notification buttons are only on the full Live Chat page. Use Open full page.

### Does the unread number clear for everyone when I read a chat?
Yes. Read status is shared by all operators.

### What do the two ticks mean?
One tick: sent. Two ticks: the company has read it.

### Can managers or staff use Live Chat?
Not in the app. Only the company's Admin can chat with support.
