import { delayedMessage, isSupportOpen, nextOpeningLabel, REPLY_TARGET_MS, supportMsBetween, type DelayNoticeItem } from '../supportHours';

/** An India-time wall clock as an instant. 2026-11-09 is a Monday. */
const ist = (day: number, hour: number, minute = 0, month = 11) => Date.UTC(2026, month - 1, day, hour, minute) - 330 * 60_000;
const MON = 9, TUE = 10, FRI = 13, SAT = 14, SUN = 15, NEXT_MON = 16;
const MIN = 60_000;

describe('isSupportOpen (Mon-Fri 10:00-18:00 India time)', () => {
  it('is open inside the window, closed at the edges and outside', () => {
    expect(isSupportOpen(ist(MON, 10, 0))).toBe(true);
    expect(isSupportOpen(ist(MON, 9, 59))).toBe(false);
    expect(isSupportOpen(ist(MON, 17, 59))).toBe(true);
    expect(isSupportOpen(ist(MON, 18, 0))).toBe(false);
    expect(isSupportOpen(ist(FRI, 12, 0))).toBe(true);
  });
  it('is closed on Saturday and Sunday', () => {
    expect(isSupportOpen(ist(SAT, 12, 0))).toBe(false);
    expect(isSupportOpen(ist(SUN, 12, 0))).toBe(false);
  });
  it('uses India time whatever the phone clock says (09:30 IST is 04:00 UTC)', () => {
    expect(isSupportOpen(Date.UTC(2026, 10, 9, 4, 0))).toBe(false); // 09:30 IST
    expect(isSupportOpen(Date.UTC(2026, 10, 9, 4, 30))).toBe(true); // 10:00 IST
  });
});

describe('nextOpeningLabel', () => {
  it('names the next opening in plain words', () => {
    expect(nextOpeningLabel(ist(MON, 8, 0))).toBe('today at 10 AM');
    expect(nextOpeningLabel(ist(MON, 19, 0))).toBe('tomorrow at 10 AM');
    expect(nextOpeningLabel(ist(FRI, 19, 0))).toBe('Monday at 10 AM');
    expect(nextOpeningLabel(ist(SAT, 11, 0))).toBe('Monday at 10 AM');
    expect(nextOpeningLabel(ist(SUN, 11, 0))).toBe('tomorrow at 10 AM');
  });
});

describe('supportMsBetween (only working time counts)', () => {
  it('counts minutes inside one working day', () => {
    expect(supportMsBetween(ist(MON, 10, 0), ist(MON, 10, 5))).toBe(5 * MIN);
    expect(supportMsBetween(ist(MON, 12, 0), ist(MON, 12, 0))).toBe(0);
    expect(supportMsBetween(ist(MON, 12, 5), ist(MON, 12, 0))).toBe(0);
  });
  it('skips the night and the weekend', () => {
    expect(supportMsBetween(ist(MON, 17, 58), ist(TUE, 10, 3))).toBe(5 * MIN); // 2 min before closing + 3 min after opening
    expect(supportMsBetween(ist(FRI, 17, 58), ist(NEXT_MON, 10, 3))).toBe(5 * MIN);
    expect(supportMsBetween(ist(SAT, 9, 0), ist(SUN, 20, 0))).toBe(0);
    expect(supportMsBetween(ist(TUE, 0, 0), ist(TUE, 23, 59))).toBe(8 * 60 * MIN);
  });
});

describe('delayedMessage (reply promised within 5 minutes)', () => {
  const own = (ts: number, over: Partial<DelayNoticeItem> = {}): DelayNoticeItem => ({ id: 'm9', fromMe: true, ts, state: 'sent', ...over });
  const theirs = (ts: number): DelayNoticeItem => ({ id: 'a1', fromMe: false, ts, state: 'sent' });

  it('fires once five working minutes have passed without a reply', () => {
    expect(delayedMessage([own(ist(TUE, 11, 0))], ist(TUE, 11, 4))).toBeNull();
    expect(delayedMessage([own(ist(TUE, 11, 0))], ist(TUE, 11, 0) + REPLY_TARGET_MS)).toEqual({ id: 'm9' });
    expect(delayedMessage([own(ist(TUE, 11, 0))], ist(TUE, 12, 30))).toEqual({ id: 'm9' });
  });
  it('is quiet when support replied (the last message is theirs)', () => {
    expect(delayedMessage([own(ist(TUE, 11, 0)), theirs(ist(TUE, 11, 2))], ist(TUE, 12, 0))).toBeNull();
  });
  it('is quiet for a message that is still sending or failed, and for an empty chat', () => {
    expect(delayedMessage([own(ist(TUE, 11, 0), { state: 'sending' })], ist(TUE, 12, 0))).toBeNull();
    expect(delayedMessage([own(ist(TUE, 11, 0), { state: 'failed' })], ist(TUE, 12, 0))).toBeNull();
    expect(delayedMessage([], ist(TUE, 12, 0))).toBeNull();
  });
  it('is quiet while the team is off (evening, weekend)', () => {
    expect(delayedMessage([own(ist(TUE, 17, 0))], ist(TUE, 18, 30))).toBeNull();
    expect(delayedMessage([own(ist(FRI, 17, 0))], ist(SAT, 12, 0))).toBeNull();
  });
  it('counts working time only: a message left in the evening is "late" five minutes after the team opens', () => {
    expect(delayedMessage([own(ist(MON, 19, 0))], ist(TUE, 10, 4))).toBeNull();
    expect(delayedMessage([own(ist(MON, 19, 0))], ist(TUE, 10, 5))).toEqual({ id: 'm9' });
    expect(delayedMessage([own(ist(SAT, 15, 0))], ist(NEXT_MON, 10, 5))).toEqual({ id: 'm9' });
  });
});
