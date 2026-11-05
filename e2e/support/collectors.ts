/**
 * Browser issue collector. Attached to every page by the `page` fixture; a test FAILS at teardown when it
 * recorded any non-allow-listed:
 *   - uncaught page error (`pageerror`)
 *   - console.error message
 *   - failed network request to the app / mock backend (except cancelled ones)
 *   - mock backend answer 404 / 405 (a missing endpoint) or >= 500
 * Allow-list: support/allowlist.json (global) or `issues.allow(/regex/, 'kind?')` inside a test.
 */
import type { ConsoleMessage, Page, Request, Response } from '@playwright/test';

import allowlist from './allowlist.json';

export type IssueKind = 'console' | 'pageerror' | 'requestfailed' | 'http';

export interface Issue {
  kind: IssueKind;
  text: string;
  url?: string;
}

interface AllowEntry {
  kind: IssueKind | 'any';
  re: RegExp;
}

const GLOBAL_ALLOW: AllowEntry[] = (allowlist.entries as { kind: IssueKind | 'any'; match: string }[]).map((e) => ({ kind: e.kind, re: new RegExp(e.match) }));

export interface Collector {
  /** Everything recorded so far (including allow-listed ones, flagged). */
  all: (Issue & { allowed: boolean })[];
  /** Issues that fail the test. */
  issues(): Issue[];
  /** Allow additional known noise for the rest of this test. */
  allow(re: RegExp, kind?: IssueKind | 'any'): void;
  /** Forget what was recorded so far (e.g. after an intentional failure injection). */
  clear(): void;
  detach(): void;
}

const isLocal = (url: string): boolean => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);

export function attachCollector(page: Page, opts: { mockOrigin: string }): Collector {
  const extra: AllowEntry[] = [];
  const all: (Issue & { allowed: boolean })[] = [];

  const isAllowed = (issue: Issue): boolean => [...GLOBAL_ALLOW, ...extra].some((a) => (a.kind === 'any' || a.kind === issue.kind) && a.re.test(issue.text));
  const record = (issue: Issue): void => {
    all.push({ ...issue, allowed: isAllowed(issue) });
  };

  const onConsole = (msg: ConsoleMessage): void => {
    if (msg.type() !== 'error') return;
    // Chrome echoes every non-2xx fetch as a console error. Business 4xx answers (401/403/422...) are normal API behaviour;
    // 404/405/5xx from the mock are reported by the 'http' kind below, so the echo is redundant.
    if (/^Failed to load resource: the server responded with a status of \d{3}/.test(msg.text())) return;
    const loc = msg.location();
    record({ kind: 'console', text: `${msg.text()}${loc.url ? ` @ ${loc.url}` : ''}`, url: loc.url });
  };
  const onPageError = (err: Error): void => record({ kind: 'pageerror', text: `${err.name}: ${err.message}${err.stack ? `\n${err.stack.split('\n').slice(1, 4).join('\n')}` : ''}` });
  const onRequestFailed = (req: Request): void => {
    const errorText = req.failure()?.errorText ?? '';
    if (/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(errorText)) return; // navigations / superseded queries
    if (!isLocal(req.url())) return;
    record({ kind: 'requestfailed', text: `${req.method()} ${req.url()} -> ${errorText}`, url: req.url() });
  };
  const onResponse = (res: Response): void => {
    const url = res.url();
    if (!url.startsWith(opts.mockOrigin)) return;
    const status = res.status();
    if (status === 404 || status === 405 || status >= 500) {
      record({ kind: 'http', text: `${res.request().method()} ${url.replace(opts.mockOrigin, '')} -> ${status}`, url });
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onRequestFailed);
  page.on('response', onResponse);

  return {
    all,
    issues: () => all.filter((i) => !i.allowed).map(({ allowed: _a, ...i }) => i),
    allow: (re, kind = 'any') => {
      extra.push({ kind, re });
      for (const i of all) if (!i.allowed && (kind === 'any' || kind === i.kind) && re.test(i.text)) i.allowed = true;
    },
    clear: () => {
      all.length = 0;
    },
    detach: () => {
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      page.off('requestfailed', onRequestFailed);
      page.off('response', onResponse);
    },
  };
}

export function formatIssues(issues: Issue[]): string {
  return issues.map((i, n) => `  ${n + 1}. [${i.kind}] ${i.text}`).join('\n');
}
