import { isStillWorking } from '../stillWorking';

describe('isStillWorking (tracking resume check)', () => {
  it('is false when not punched in', () => {
    expect(isStillWorking({ isPunchedIn: false, punchOut: undefined, sessions: [] })).toBe(false);
    expect(isStillWorking({ isPunchedIn: false, punchOut: '18:00', sessions: [{ punchIn: '09:00', punchOut: '18:00' }] })).toBe(false);
  });

  it('is true while punched in without a punch-out', () => {
    expect(isStillWorking({ isPunchedIn: true, punchOut: undefined, sessions: [{ punchIn: '09:00' }] })).toBe(true);
  });

  it('stays true in an open SECOND session even if the server keeps the first punch-out', () => {
    expect(
      isStillWorking({ isPunchedIn: true, punchOut: '13:00', sessions: [{ punchIn: '09:00', punchOut: '13:00' }, { punchIn: '14:00' }] }),
    ).toBe(true);
  });

  it('is false when punched in but the last session is closed (v1 rule: punch-out present)', () => {
    expect(isStillWorking({ isPunchedIn: true, punchOut: '18:00', sessions: [{ punchIn: '09:00', punchOut: '18:00' }] })).toBe(false);
    expect(isStillWorking({ isPunchedIn: true, punchOut: '18:00', sessions: [] })).toBe(false);
  });
});
