/** Shared CRM view types (the wire DTOs live in `@/types/api/leads`). */
import type { LeadWithCarryForward, LeadWorkStatus } from '@/types/api/leads';

/** A lead with its (pending/approved) carry-forward request attached; one row per lead (duplicates merged). */
export type CrmLead = LeadWithCarryForward;

/** Date chips of the hub / assign list. `custom` carries an explicit date. */
export type DateFilterKey = 'yesterday' | 'today' | 'tomorrow' | 'custom';

/** Date chips of the carry-forward request list (adds `all`). */
export type CfrDateFilterKey = DateFilterKey | 'all';

/** Work-status buckets of the admin overview (`total` shows every lead). */
export type StatFilter = 'total' | 'unassigned' | 'pending' | 'working' | 'completed' | 'carry_forward';

/** Employee-side status chips (v1 has no carry-forward chip). */
export type EmployeeStatusFilter = 'all' | 'pending' | 'working' | 'completed';

export type { LeadWorkStatus };
