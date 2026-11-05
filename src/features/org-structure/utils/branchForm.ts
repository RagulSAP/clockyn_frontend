/** Pure logic of the branch screens: validation, GPS helpers, radius options, sorting. */
import type { Branch } from '@/types/api/branches';

export const RADIUS_OPTIONS = [100, 250, 500, 750, 1000] as const;
export const DEFAULT_RADIUS = 100;
/** Map start when nothing is known yet (v1 fallback: Chennai). */
export const FALLBACK_MAP_CENTER = { latitude: 13.0827, longitude: 80.2707 } as const;

export interface BranchFormValues {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export const EMPTY_BRANCH_FORM: BranchFormValues = { name: '', address: '', latitude: 0, longitude: 0, radius: DEFAULT_RADIUS };

export interface BranchFormErrors {
  name?: string;
  address?: string;
  gps?: string;
}

export const BRANCH_MESSAGES = {
  name: 'Branch name is required',
  address: 'Branch address is required',
  gps: 'Please select GPS location',
} as const;

/** (0, 0) is the "no GPS" sentinel. */
export function hasGps(latitude: number | undefined, longitude: number | undefined): boolean {
  return (latitude ?? 0) !== 0 || (longitude ?? 0) !== 0;
}

export function validateBranchForm(values: BranchFormValues): BranchFormErrors {
  const errors: BranchFormErrors = {};
  if (values.name.trim() === '') errors.name = BRANCH_MESSAGES.name;
  if (values.address.trim() === '') errors.address = BRANCH_MESSAGES.address;
  if (!hasGps(values.latitude, values.longitude)) errors.gps = BRANCH_MESSAGES.gps;
  return errors;
}

export function formatGps(latitude: number, longitude: number, digits: number): string {
  return `${latitude.toFixed(digits)}, ${longitude.toFixed(digits)}`;
}

export function formatRadius(radius: number | undefined): string {
  return `${radius || DEFAULT_RADIUS}m radius`;
}

/** The five standard radii; an out-of-set stored radius (edit mode) is added so it stays visible and selected. */
export function radiusChoices(current: number): number[] {
  const all: number[] = [...RADIUS_OPTIONS];
  if (current > 0 && !all.includes(current)) all.push(current);
  return all.sort((a, b) => a - b);
}

export function sortBranches<T extends { name: string }>(branches: readonly T[]): T[] {
  return [...branches].sort((a, b) => a.name.localeCompare(b.name));
}

export function formFromBranch(branch: Branch): BranchFormValues {
  return {
    name: branch.name,
    address: branch.address,
    latitude: branch.latitude,
    longitude: branch.longitude,
    radius: branch.radius || DEFAULT_RADIUS,
  };
}
