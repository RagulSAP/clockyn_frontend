# ClockynConsole Knowledge Base: how it works and how to keep it right

This folder is the knowledge base of the Clockyn Console: articles that teach a new team member to run the console. The articles are Markdown files
in git. The console shows them on the **Knowledge Base** page (`pages/kb.html`, left menu, System section). This file is for the people who
maintain the articles. It is not shown in the console.

## Layout

```
ClockynConsole/kb/
  index.json                 generated list of all articles (never edit by hand)
  getting-started/  operations/  billing/  support/  reference/  maintainers/
    <slug>.md                one article per file
```

The folder an article lives in decides its category: `getting-started` = Getting started, `operations` = Operations, `billing` = Billing & growth,
`support` = Support, `reference` = Reference, `maintainers` = Maintainers. A folder whose name starts with `_` is ignored by the tools.

## Add or change an article

1. Edit or create `kb/<category>/<slug>.md`. The slug is the file name without `.md`: lower-case words joined by hyphens, unique in the whole KB.
2. Start the file with the front matter (below). Set `updated` to today's date.
3. Run `npm run kb:build` (rewrites `index.json`), then `npm run kb:check` (must pass; it also runs inside `npm run verify`).
4. Put the article change in the **same pull request** as the console change it describes. A change to a page, a button label, a status, a rule
   or a role without the matching article change is an incomplete change.
5. Open the console, go to **Knowledge Base** and read the article once on screen.

### Front matter

```
---
title: Void a payout
summary: One sentence, at most 200 characters, saying what the article covers and who it is for.
category: Billing & growth
audience: super_admin
tags: payout, void, commission, undo
page: referrals.html
updated: 2026-11-15
related: b2c-commission-and-payouts, referrals-b2c
---
```

| Key | Required | Meaning |
| --- | --- | --- |
| `title` | yes | What a person would search for. At most 80 characters. |
| `summary` | yes | One sentence, at most 200 characters. Shown under the title, in lists and in search. |
| `category` | yes | Must match the folder (see above). |
| `audience` | yes | `all`, `operator`, `super_admin` (role 1 only actions) or `maintainer`. |
| `tags` | yes | Comma-separated lower-case search words, including the synonyms a newcomer would type. |
| `page` | no | The console page the article is about, for example `referrals.html`. Adds an "Open this page" button. |
| `updated` | yes | `YYYY-MM-DD`. |
| `related` | no | Comma-separated slugs of related articles. |

The audience chips in the console work like this: **All** shows everything. **Operators** shows `all` and `operator` articles. **Super admin** shows
`all`, `operator` and `super_admin` articles. **Maintainers** shows `all` and `maintainer` articles.

### Body format (a small Markdown subset, no HTML)

- Do not repeat the title as `# Heading`. Start with an introduction of 2 to 4 sentences, then `##` sections and `###` sub-sections only.
- Allowed: paragraphs, `-` bullets, `1.` numbered lists (nest with two spaces), pipe tables, fenced code blocks, `inline code`, `**bold**`, `*italic*`.
- Links: `[text](https://...)` for outside links (https only) and `[text](kb:slug)` for another article.
- Callouts: a blockquote whose first line starts with `**Note**`, `**Tip**` or `**Warning**`, for example `> **Warning** This cannot be undone.`
- Raw HTML is never rendered: it is shown as text. A link with any other target (for example `javascript:`) shows only its text.

### Writing rules (they also make the later AI search accurate)

- Write for a new employee. Short sentences, plain words, define a term the first time.
- Each `##` section must make sense on its own. Name the page and feature in the section ("On the Referrals page, B2C Referral tab ...").
- Steps are numbered and use the exact button and field labels from the screen. Say who can do the task (any operator, or super admin only).
- Explain what each tile, column, filter, badge and status means, with a number example where it helps.
- Every article about a page ends with `## Common questions` (4 to 8 `###` questions written the way a newcomer asks) and `## What can go wrong`
  (symptom, cause, fix).
- Write only what you verified in the code or on screen. Never invent a feature, number or address.
- No secrets, keys, real personal data or real e-mail addresses (use `name@example.com`). No former product names.
- Size: 300 to 1000 words per article (the check fails below 250 and above 1200). Keep each `##` section under about 400 words.

## The tools

| Command | What it does |
| --- | --- |
| `npm run kb:build` | Rewrites `kb/index.json` from the articles. It has no timestamp, so an unchanged KB gives an identical file. |
| `npm run kb:check` | Fails on a broken article or a stale index; prints warnings for advice. Also part of `npm run verify`. |
| `node scripts/build-kb.js --check` | Only checks that `index.json` is current. |
| `node scripts/build-kb.js --out kb-dist` | Also exports the articles with metadata files for AWS (see below). `kb-dist/` is git-ignored. |

`kb:check` also checks **coverage**: every page in `ClockynConsole/pages` (except `login.html` and `kb.html`) must be the `page:` of at least one
article. Adding a console page without an article fails the check.

## Ownership and review

- The person who changes a console page owns the matching article change, and the reviewer checks it like code.
- Names of owners per area are kept by the console maintainers. Report a wrong or missing answer to them; fix it in a pull request.
- Review the whole KB when a release changes roles, security settings, billing rules or the deploy steps, and bump `updated` on the files you touch.

## Why Markdown in git, and not a database table

Keep the articles in git as the single source of truth.

- An article changes together with the code it describes, in the same pull request, with review and history. A database copy would drift.
- The console serves the files as they are: no table, no backend route, no migration to maintain.
- AWS Bedrock Knowledge Bases ingest documents from a data source such as an S3 bucket. They do not read an application's PostgreSQL table
  directly. A table would only be one more copy to export to S3.
- A table makes sense only if people who cannot use git must edit articles in a browser. In that case add an editor to the console that
  **commits to this folder** (or writes to S3 and git), rather than making the database the source.

## Future: Bedrock search for employee questions

Plan. Verify every AWS detail against the current AWS documentation when you build it.

1. **Export in CI** on every change under `ClockynConsole/kb/**`:
   `node scripts/build-kb.js --out kb-dist`, then `aws s3 sync kb-dist s3://<bucket>/clockyn-console-kb/ --delete`.
   The export keeps each `.md` as it is and writes a sidecar `<file>.md.metadata.json` next to it. The sidecar follows the Bedrock S3 metadata-file
   convention: `{"metadataAttributes": {...}}` with string values (`title`, `slug`, `category`, `audience`, `page`, `updated`, `tags`, `summary`, `link`).
   Each sidecar must stay under 10 KB.
2. **Create a Bedrock Knowledge Base** with that S3 prefix as the data source and a vector store of your choice. Start an ingestion job (sync) after
   each export so the index follows the files.
3. **Chunking.** Each file is one topic and each `##` section stands on its own, so the default or hierarchical chunking both work. Keep sections
   under about 400 words. Questions written as `###` headings under "Common questions" match how employees ask.
4. **Scope the retrieval.** Use the metadata filter on `audience` (and `category` when useful): an operator must not be answered from
   `super_admin` or `maintainer` articles. Take the audience from the signed-in operator's role.
5. **Cite sources.** Show the article title and link to `kb.html#<slug>` (the `link` attribute) with every answer, so the employee can open the
   full article. If nothing relevant is retrieved, say so and point to the maintainers instead of guessing.
6. **Privacy.** Employee questions are sent to a model. Tell people not to paste customer personal data, and do not log full questions with
   identities longer than needed.
7. **Keep the console search.** The client-side search on the Knowledge Base page keeps working without AWS and stays the fallback.

Other things to decide at that time: which model and region, the cost per question, who may use the assistant, and how wrong answers are reported
back to the article owners.
