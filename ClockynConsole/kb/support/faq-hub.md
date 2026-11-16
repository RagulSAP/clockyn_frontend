---
title: FAQ Hub (questions and answers shown in the app)
summary: How the FAQ library is organised into buckets and categories, how to add, edit, reorder, hide, rename and delete FAQs, and how to keep them in step with product changes.
category: Support
audience: operator
tags: faq, faq hub, questions, answers, bucket, category, sort order, active, inactive, add faq, edit, rename, starter set, support tab
page: faqs.html
updated: 2026-11-15
related: video-hub, live-chat, suggestions, glossary
---

The FAQ Hub is where the team writes the questions and answers that company admins read in the app under Support > FAQ ("Answers to common questions"). Every operator can read the library. Only a super admin can add, edit, reorder, hide, rename or delete FAQs.

## How FAQs are organised
Each FAQ has a **bucket**, a **category**, a **question**, an **answer**, a **sort order** and a **status**.

- A **bucket** is a top-level group. The app shows buckets first, as tiles. The starter set has six: Set up & Account, Attendance & Time, Pay & Expenses, Team & Customers, Plans & Payments and Help & Fixes.
- A **category** is a topic inside a bucket, for example "Payroll & Salary" inside Pay & Expenses. In the app, a bucket's questions appear under their category headings.
- The **answer** is plain text. Line breaks are kept, but no formatting or links are rendered.
- **Active** FAQs are shown in the app. **Inactive** ones are hidden but kept in the library.
- Questions are shown in order of **sort order**, then by id. The order of buckets and categories follows the first FAQ of each.

In the app, the admin can search across all buckets (question, answer, category and bucket), tap a bucket tile to see its questions, and expand a row to read the answer.

## What the FAQ Hub page shows
Five tiles: **Total FAQs**, **Active** (visible in the app), **Inactive** (hidden), **Buckets** (top-level groups) and **Categories** (topics inside buckets).

On the left, the **Buckets** list has an All entry and one entry per bucket with counts. Click one to filter. **Search all FAQs** looks in every bucket at once and ranks the matches. The status drop-down offers **All statuses**, **Active** and **Inactive**. Click a category name to show only that category, and **All categories** to go back. **Expand all** and **Collapse all** open or close every answer.

Each FAQ is an expandable row. Under the answer you see "Order N - Updated date". Super admins also see Move up, Move down, Edit, Activate or Deactivate, and Delete.

## Add a FAQ
Who can do this: super admin only (the **Add FAQ** button is hidden for others).

1. Click **Add FAQ**.
2. Fill in **Bucket** (up to 60 characters; start typing to pick an existing one or type a new name) and **Category** (up to 60 characters).
3. Leave **Sort order** as "Auto" to place the FAQ after the current last one, or type a number from 0 to 1,000,000.
4. Type the **Question** (5 to 300 characters) and the **Answer** (up to 8000 characters). Counters show how much room is left.
5. Leave the switch on "Active (shown in the app)", or turn it off to save it as "Inactive (hidden from the app)".
6. Click **Save FAQ**. The page confirms "FAQ added".

Questions must be unique, ignoring capital letters. If the same question exists, the form shows "This question already exists." and nothing is saved.

## Edit, reorder, hide and delete
Who can do this: super admin only.

- **Edit**: open the row, click Edit, change fields, click **Save FAQ** ("FAQ saved").
- **Move up / Move down**: swaps the sort order with the neighbouring FAQ in the same bucket and category ("Moved up" or "Moved down").
- **Deactivate / Activate**: hides or shows the FAQ in the app ("FAQ deactivated" or "FAQ activated").
- **Delete**: asks "Delete this FAQ?" and warns it is removed from the library and the app. This cannot be undone.
- **Rename a bucket or category** (pencil icon beside the list title when a bucket is selected, or the rename link on a category heading): enter the new name and click Rename. Every FAQ in that bucket or category is updated one by one with a progress bar. If the new name already exists, the FAQs are merged into it. If it fails part-way, the ones already renamed stay renamed; run it again to finish.

## The starter set and updates for existing databases
The library was first filled from a script, `FAQ.sql`, in the backend project. It holds 397 questions in the six buckets. It is safe to run again: a question that already exists (ignoring capital letters) is skipped, so FAQs you edited here are not overwritten (a deleted question would come back).

A second script, `FAQ_referral_update.sql`, is for databases that already had the starter set. Run it once after the related features are deployed. Unlike `FAQ.sql`, it deliberately overwrites 12 existing answers (referral percent, plan durations, free months) and adds 9 new questions. A maintainer runs these scripts against the database; the console does not.

## Keep FAQs in step with product changes
1. When a feature, screen name, price rule or limit changes, search the FAQ Hub for the old wording and update the answer on the same day.
2. Do not write numbers that can change. For example, the referral discount percent is set in the console and can change; say "the percent shown on the Refer & Earn screen".
3. Use the exact button and screen names the app shows.
4. Write the question the way a customer would ask it ("How do I add a new staff member?").
5. When a [chat](kb:live-chat) or [suggestion](kb:suggestions) question repeats, add a FAQ for it.

## What can go wrong
- **No Add FAQ button, no Edit buttons**: your account is not a super admin.
- **"A FAQ with this question already exists"**: use Search to find the existing one and edit it.
- **A new FAQ is not in the app yet**: it may be Inactive (check the status switch), or the app is still showing its saved list. The app keeps the FAQ list for about five minutes, so a change can take that long to appear on a phone that already has the screen open.
- **Rename stopped part-way**: read the message ("Renamed 5 of 9 FAQs, then it failed") and click Rename again with the same name.
- **FAQ Hub shows no FAQs on a new database**: the starter script has not been run yet. Ask a maintainer.

## Common questions
### How do I move a FAQ to a different bucket?
Edit it and change the Bucket (and Category) fields, then save.

### Can I use bold text, links or images in an answer?
No. Answers are plain text; only line breaks are kept.

### Does hiding a FAQ delete it?
No. Inactive FAQs stay in the library and can be activated again.

### Who decides the order buckets appear in?
The order follows the sort order of the first FAQ in each bucket. Move that FAQ, or change its sort order.

### Can two FAQs have the same question?
No. The check ignores capital letters.

### Is there a limit on answer length?
Answers can be up to 8000 characters and questions up to 300.
