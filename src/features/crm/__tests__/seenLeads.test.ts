import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS, clearSessionStorage } from '@/lib/storage';
import { badges } from '@/store/badges';

import { computeUnseen, countUnseen, markCrmSeen, readSeenIds, seenStorageKey, syncCrmBadge, tracksCrmBadge, writeSeenIds } from '../seenLeads';

beforeEach(async () => {
  await AsyncStorage.clear();
  badges.reset();
});

describe('crmSeen badge logic', () => {
  it('only managers and staff get a badge (admins never)', () => {
    expect(tracksCrmBadge(1)).toBe(false);
    expect(tracksCrmBadge(2)).toBe(true);
    expect(tracksCrmBadge(3)).toBe(true);
    expect(tracksCrmBadge(null)).toBe(false);
  });

  it('counts the ids that are not in the seen list (ids compare as strings)', () => {
    expect(countUnseen(['1', '2', 3], ['1', '3'])).toBe(1);
    expect(countUnseen([], ['1'])).toBe(0);
    expect(countUnseen(['1', '1'], [])).toBe(1);
  });

  it('is scoped to the user on this device', async () => {
    expect(seenStorageKey('u1')).toBe(`${STORAGE_KEYS.crmSeenLeadIds}:u1`);
    await writeSeenIds('u1', ['10', '11']);
    expect(await readSeenIds('u1')).toEqual(['10', '11']);
    expect(await readSeenIds('u2')).toEqual([]);
    expect(await computeUnseen('u2', ['10', '11'])).toBe(2);
  });

  it('publishes the unseen count to the badge store for roles 2 and 3', async () => {
    await writeSeenIds('u1', ['1']);
    expect(await syncCrmBadge('u1', 3, ['1', '2', '3'])).toBe(2);
    expect(badges.get().crm).toBe(2);
    expect(await syncCrmBadge('u1', 2, ['1'])).toBe(0);
    expect(badges.get().crm).toBe(0);
  });

  it('admins get no badge and nothing is stored', async () => {
    expect(await syncCrmBadge('admin1', 1, ['1', '2'])).toBe(0);
    expect(badges.get().crm).toBe(0);
  });

  it('opening the tab clears the badge and marks the fetched list as seen (overwrite)', async () => {
    await writeSeenIds('u1', ['old']);
    await syncCrmBadge('u1', 3, ['a', 'b']);
    expect(badges.get().crm).toBe(2);
    await markCrmSeen('u1', ['a', 'b']);
    expect(badges.get().crm).toBe(0);
    expect(await readSeenIds('u1')).toEqual(['a', 'b']);
    // a lead assigned afterwards is new again
    expect(await syncCrmBadge('u1', 3, ['a', 'b', 'c'])).toBe(1);
  });

  it('tolerates a corrupt stored value', async () => {
    await AsyncStorage.setItem(seenStorageKey('u1'), '{not json');
    expect(await readSeenIds('u1')).toEqual([]);
    await AsyncStorage.setItem(seenStorageKey('u1'), '"text"');
    expect(await readSeenIds('u1')).toEqual([]);
  });

  it('is wiped on sign-out', async () => {
    await writeSeenIds('u1', ['1']);
    await clearSessionStorage();
    expect(await readSeenIds('u1')).toEqual([]);
  });
});
