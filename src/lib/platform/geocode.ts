/**
 * Reverse geocoding — WEB / default implementation (OpenStreetMap Nominatim, same provider family as the web map tiles).
 * The native implementation lives in `geocode.native.ts` (expo-location).
 *
 * Best effort: resolves `null` on any failure / timeout / empty result (callers show "Address not available").
 */
import { formatAddress } from './geocodeFormat';

export { formatAddress } from './geocodeFormat';
export type { AddressParts } from './geocodeFormat';

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const TIMEOUT_MS = 8_000;

type NominatimAddress = Record<string, string | undefined>;

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  if (typeof fetch === 'undefined') return null;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
  try {
    const url = `${ENDPOINT}?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(String(latitude))}&lon=${encodeURIComponent(String(longitude))}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller?.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { name?: string; display_name?: string; address?: NominatimAddress };
    const a = body.address ?? {};
    const structured = formatAddress({
      name: body.name || a.building || a.amenity || a.shop || a.house_number,
      street: a.road || a.pedestrian || a.suburb,
      city: a.city || a.town || a.village || a.county || a.state_district,
      region: a.state,
    });
    return structured ?? (body.display_name?.trim() || null);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
