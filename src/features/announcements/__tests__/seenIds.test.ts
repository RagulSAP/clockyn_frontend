import { mapAnnouncement } from '@/api/announcements';
import { STORAGE_KEYS } from '@/lib/storage';
import { badges, resetBadges } from '@/store/badges';
import {
  MAX_SEEN_IDS,
  addSeenIds,
  computeUnreadCounts,
  loadSeenIds,
  markBroadcastRead,
  markTargetedRead,
  mergeSeenIds,
  refreshUnread,
  resetUnread,
  seenKey,
  useAnnouncementUnreadStore,
} from '../seenIds';

const ann = (id: string, target: string) => mapAnnouncement({ id, title: `t${id}`, message: 'm', target, created_at: '2026-10-18T05:00:00Z' });

const LIST = [ann('1', 'all'), ann('2', 'selected'), ann('3', 'branch'), ann('4', 'dept'), ann('5', 'all')];

beforeEach(async () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  await require('@react-native-async-storage/async-storage').clear();
  resetBadges();
  resetUnread();
});

describe('mergeSeenIds', () => {
  it('merges without duplicates, drops blanks and keeps order', () => {
    expect(mergeSeenIds(['a', 'b'], ['b', 'c', '', '  '])).toEqual(['a', 'b', 'c']);
  });
  it('caps the list keeping the newest ids', () => {
    const many = Array.from({ length: MAX_SEEN_IDS + 10 }, (_, i) => `id${i}`);
    const out = mergeSeenIds([], many);
    expect(out).toHaveLength(MAX_SEEN_IDS);
    expect(out[out.length - 1]).toBe(`id${MAX_SEEN_IDS + 9}`);
    expect(out).not.toContain('id0');
  });
});

describe('computeUnreadCounts', () => {
  it('counts unseen broadcast (all|selected) and targeted (branch|dept) separately', () => {
    expect(computeUnreadCounts(LIST, { broadcast: [], targeted: [] })).toEqual({ broadcast: 3, targeted: 2, total: 5 });
  });
  it('ignores seen ids of the right class only', () => {
    // id "3" is a targeted announcement: having it in the broadcast list does not count as seen
    const c = computeUnreadCounts(LIST, { broadcast: ['1', '3'], targeted: ['4'] });
    expect(c).toEqual({ broadcast: 2, targeted: 1, total: 3 });
  });
  it('is zero for an empty list', () => {
    expect(computeUnreadCounts([], { broadcast: ['x'], targeted: [] }).total).toBe(0);
  });
});

describe('seen ids are scoped per user', () => {
  it('uses user-scoped storage keys (never the global base key)', () => {
    expect(seenKey('broadcast', 'u1')).toBe(`${STORAGE_KEYS.announcementSeenBroadcast}:u1`);
    expect(seenKey('targeted', 'u1')).toBe(`${STORAGE_KEYS.announcementSeenTargeted}:u1`);
    expect(seenKey('broadcast', 'u1')).not.toBe(seenKey('broadcast', 'u2'));
  });

  it("one user's seen ids do not affect another user's unread count", async () => {
    await addSeenIds('broadcast', 'u1', ['1', '2', '5']);
    expect(await loadSeenIds('broadcast', 'u1')).toEqual(['1', '2', '5']);
    expect(await loadSeenIds('broadcast', 'u2')).toEqual([]);
    expect((await refreshUnread('u1', LIST)).broadcast).toBe(0);
    expect((await refreshUnread('u2', LIST)).broadcast).toBe(3);
  });

  it('does nothing without a user id', async () => {
    expect(await addSeenIds('broadcast', '', ['1'])).toEqual([]);
    expect(await loadSeenIds('broadcast', '')).toEqual([]);
  });

  it('tolerates corrupt stored data', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    await require('@react-native-async-storage/async-storage').setItem(seenKey('broadcast', 'u1'), '{not json');
    expect(await loadSeenIds('broadcast', 'u1')).toEqual([]);
  });
});

describe('markBroadcastRead / markTargetedRead', () => {
  it('opening Broadcast clears only the broadcast count and updates the Chat tab badge', async () => {
    await refreshUnread('u1', LIST);
    expect(useAnnouncementUnreadStore.getState()).toMatchObject({ broadcast: 3, targeted: 2 });
    expect(badges.get().announcements).toBe(5);

    await markBroadcastRead('u1', LIST);
    expect(useAnnouncementUnreadStore.getState()).toMatchObject({ broadcast: 0, targeted: 2 });
    expect(badges.get().announcements).toBe(2);

    await markTargetedRead('u1', LIST);
    expect(useAnnouncementUnreadStore.getState()).toMatchObject({ broadcast: 0, targeted: 0 });
    expect(badges.get().announcements).toBe(0);
  });

  it('marks only the ids of the list that was displayed and MERGES (a later announcement stays unread)', async () => {
    await markBroadcastRead('u1', LIST);
    const stored = await loadSeenIds('broadcast', 'u1');
    expect(stored.sort()).toEqual(['1', '2', '5']);

    const newer = [...LIST, ann('6', 'all')];
    const counts = await refreshUnread('u1', newer);
    expect(counts.broadcast).toBe(1); // id 6 was not on screen when the feed was opened

    // opening again keeps the earlier ids (merge, not replace)
    await markBroadcastRead('u1', [ann('6', 'all')]);
    expect((await loadSeenIds('broadcast', 'u1')).sort()).toEqual(['1', '2', '5', '6']);
  });

  it('a realtime optimistic +1 (push and socket both count) is healed by the recompute', async () => {
    await markBroadcastRead('u1', LIST);
    badges.increment('announcements'); // socket
    badges.increment('announcements'); // push for the same announcement
    expect(badges.get().announcements).toBe(4); // 2 unseen targeted + 2 optimistic (double counted)
    await refreshUnread('u1', [...LIST, ann('6', 'all')]);
    expect(badges.get().announcements).toBe(3); // targeted 2 + the one new broadcast
  });

  it('resetUnread zeroes the counters (sign-out)', async () => {
    await refreshUnread('u1', LIST);
    resetUnread();
    expect(useAnnouncementUnreadStore.getState()).toMatchObject({ broadcast: 0, targeted: 0 });
    expect(badges.get().announcements).toBe(0);
  });
});
