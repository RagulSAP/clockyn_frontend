/**
 * Reverse geocoding — NATIVE implementation (expo-location). Resolves `null` on any failure (best effort).
 */
import * as Location from 'expo-location';
import { formatAddress } from './geocodeFormat';

export { formatAddress } from './geocodeFormat';
export type { AddressParts } from './geocodeFormat';

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = results[0];
    if (!first) return null;
    return formatAddress({ name: first.name, street: first.street, city: first.city, region: first.region });
  } catch {
    return null;
  }
}
