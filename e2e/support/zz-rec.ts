/** TEMPORARY video recorder helper (copy kept in C:\POC\clockyn_videos\source). Delete from the repo when the videos are done. */
import * as fs from 'fs';

import type { Page } from '@playwright/test';

export async function startRecorder(page: Page, out: string) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  const frames: { f: string; ts: number }[] = [];
  const taps: { t: number; x: number; y: number }[] = [];
  const marks: Record<string, number> = {};
  const mark = (name: string) => void (marks[name] = Date.now() / 1000);

  const cdp = await page.context().newCDPSession(page);
  let n = 0;
  cdp.on('Page.screencastFrame', (fr: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    const f = `f${String(n++).padStart(5, '0')}.jpg`;
    fs.writeFileSync(`${out}/${f}`, Buffer.from(fr.data, 'base64'));
    frames.push({ f, ts: fr.metadata.timestamp ?? Date.now() / 1000 });
    void cdp.send('Page.screencastFrameAck', { sessionId: fr.sessionId }).catch(() => undefined);
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 });
  await page.waitForTimeout(300);

  type Loc = ReturnType<Page['getByTestId']>;
  const stableBox = async (loc: Loc) => {
    let prev = await loc.boundingBox();
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(40);
      const cur = await loc.boundingBox();
      if (prev && cur && Math.abs(cur.x - prev.x) < 0.5 && Math.abs(cur.y - prev.y) < 0.5 && Math.abs(cur.height - prev.height) < 0.5) return cur;
      prev = cur;
    }
    return prev!;
  };
  const tap = async (id: string | Loc) => {
    const loc = typeof id === 'string' ? page.getByTestId(id) : id;
    const b = await stableBox(loc.first());
    taps.push({ t: Date.now() / 1000, x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await loc.first().click();
  };
  const type = async (id: string, text: string, delay = 45) => {
    await tap(id);
    await page.getByTestId(id).pressSequentially(text, { delay });
  };
  const pick = async (trigger: string, option: string) => {
    await tap(trigger);
    await tap(page.getByRole('radio', { name: option }));
    await page.waitForTimeout(110);
  };
  const scrollTo = (id: string) => page.evaluate((tid) => document.querySelector(`[data-testid="${tid}"]`)!.scrollIntoView({ block: 'center', behavior: 'smooth' }), id);
  const smoothTo = async (id: string) => {
    await scrollTo(id);
    await page.waitForTimeout(450);
  };
  const finish = async () => {
    await cdp.send('Page.stopScreencast');
    await page.waitForTimeout(200);
    fs.writeFileSync(`${out}/live.json`, JSON.stringify({ frames, taps, marks, viewport: page.viewportSize()!, dpr: 3 }));
    console.log(`RECORDED ${frames.length} frames; ${taps.length} taps; marks ${JSON.stringify(marks)}`);
  };
  /** tap an absolute viewport position (for example a spot on a map) */
  const tapPoint = async (x: number, y: number) => {
    taps.push({ t: Date.now() / 1000, x, y });
    await page.mouse.click(x, y);
  };
  /** stop capturing (for page loads / user switches that would only record blank frames); the timeline stays continuous */
  const finishPause = async () => {
    await cdp.send('Page.stopScreencast');
  };
  const finishResume = async () => {
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 });
    await page.waitForTimeout(300);
  };
  return { mark, tap, tapPoint, type, pick, scrollTo, smoothTo, finish, finishPause, finishResume };
}
