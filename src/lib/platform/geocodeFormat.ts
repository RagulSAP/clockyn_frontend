/** Shared pure helpers of reverse geocoding (used by the web and native implementations). */

export type AddressParts = {
  name?: string | null;
  street?: string | null;
  city?: string | null;
  region?: string | null;
};

/**
 * `"{name}, {street}, {city}, {region}"` with missing parts left out (v1 printed empty parts as ", ,").
 * Consecutive duplicates (e.g. name === street) are collapsed. `null` when nothing usable remains.
 */
export function formatAddress(parts: AddressParts): string | null {
  const out: string[] = [];
  for (const raw of [parts.name, parts.street, parts.city, parts.region]) {
    const part = typeof raw === 'string' ? raw.trim() : '';
    if (part !== '' && out[out.length - 1] !== part) out.push(part);
  }
  return out.length > 0 ? out.join(', ') : null;
}
