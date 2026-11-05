/**
 * Query keys of the staff directory. Everything lives under `queryKeys.staff.all(scope)` (so any "staff changed"
 * invalidation refreshes it) but in a private `directory` namespace: other features cache a different DTO under
 * `queryKeys.staff.detail`, and one key must never hold two shapes.
 */
import { queryKeys } from '@/lib/query/queryKeys';

const base = (scope: string, staffId: string) => [...queryKeys.staff.all(scope), 'directory', staffId] as const;

export const directoryKeys = {
  /** Prefix of everything cached for one staff member. */
  staff: (scope: string, staffId: string) => base(scope, staffId),
  detail: (scope: string, staffId: string) => [...base(scope, staffId), 'detail'] as const,
  profile: (scope: string, staffId: string) => [...base(scope, staffId), 'profile'] as const,
  photo: (scope: string, staffId: string) => [...base(scope, staffId), 'photo'] as const,
  attendance: (scope: string, staffId: string, year: number, month: number) => [...base(scope, staffId), 'attendance', year, month] as const,
  leaves: (scope: string, staffId: string, year: number, month: number) => [...base(scope, staffId), 'leaves', year, month] as const,
  sessions: (scope: string, staffId: string, date: string) => [...base(scope, staffId), 'sessions', date] as const,
  punchPins: (scope: string, staffId: string, date: string) => [...base(scope, staffId), 'punch-pins', date] as const,
  advances: (scope: string, staffId: string) => [...base(scope, staffId), 'advances'] as const,
};
