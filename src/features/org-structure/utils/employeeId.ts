/**
 * Employee-id suggestion: take the id the server proposes and count up until an unused one is found.
 *
 * Same algorithm as v1 (server `next-emp-id`, then `validate-emp-id` in a numeric increment loop, fail-open on lookup
 * errors) with two guards v1 lacked: a non-numeric id is never incremented into "NaN", and the loop is bounded.
 */

export interface EmployeeIdDeps {
  /** Id proposed by the server (the API layer already falls back to `'1000'` on HTTP errors). */
  getNext: () => Promise<string>;
  /** Whether an id is unused (fail-open: the API layer resolves `true` when the lookup fails). */
  isAvailable: (id: string) => Promise<boolean>;
  /** Upper bound of increments before giving up (default 500). */
  maxSteps?: number;
}

export const FALLBACK_EMPLOYEE_ID = '1000';

const NUMERIC = /^\d{1,15}$/;

/** `"1007"` -> `"1008"`; `null` when the id is not a plain integer. */
export function incrementEmployeeId(id: string): string | null {
  const trimmed = id.trim();
  if (!NUMERIC.test(trimmed)) return null;
  return String(parseInt(trimmed, 10) + 1);
}

export async function suggestEmployeeId(deps: EmployeeIdDeps): Promise<string> {
  const maxSteps = deps.maxSteps ?? 500;
  let candidate: string;
  try {
    candidate = (await deps.getNext()).trim() || FALLBACK_EMPLOYEE_ID;
  } catch {
    candidate = FALLBACK_EMPLOYEE_ID;
  }
  for (let step = 0; step <= maxSteps; step += 1) {
    let available: boolean;
    try {
      available = await deps.isAvailable(candidate);
    } catch {
      available = true; // fail open, like v1
    }
    if (available) return candidate;
    const next = incrementEmployeeId(candidate);
    if (next === null) return candidate; // cannot count up: the save-time uniqueness check will catch a clash
    candidate = next;
  }
  return candidate;
}
