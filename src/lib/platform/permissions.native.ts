/**
 * Permissions — NATIVE implementation (expo-location, expo-image-picker, expo-notifications).
 * Camera and photo-library state come from expo-image-picker (same OS permissions the pickers use).
 */
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import type { PermissionDetail, PermissionKind, PermissionState } from './permissions.types';

export type { PermissionKind, PermissionState, PermissionDetail } from './permissions.types';

type Raw = { status: string; granted: boolean; canAskAgain: boolean };

function toDetail(r: Raw): PermissionDetail {
  const status: PermissionState = r.granted ? 'granted' : r.status === 'undetermined' ? 'undetermined' : 'denied';
  return { status, canAskAgain: r.canAskAgain };
}

async function read(p: PermissionKind): Promise<Raw> {
  switch (p) {
    case 'location':
      return Location.getForegroundPermissionsAsync();
    case 'camera':
      return ImagePicker.getCameraPermissionsAsync();
    case 'photos':
      return ImagePicker.getMediaLibraryPermissionsAsync();
    case 'notifications':
      return Notifications.getPermissionsAsync();
  }
}

async function ask(p: PermissionKind): Promise<Raw> {
  switch (p) {
    case 'location':
      return Location.requestForegroundPermissionsAsync();
    case 'camera':
      return ImagePicker.requestCameraPermissionsAsync();
    case 'photos':
      return ImagePicker.requestMediaLibraryPermissionsAsync();
    case 'notifications':
      return Notifications.requestPermissionsAsync();
  }
}

export async function getPermissionDetail(p: PermissionKind): Promise<PermissionDetail> {
  try {
    return toDetail(await read(p));
  } catch {
    return { status: 'undetermined', canAskAgain: true };
  }
}

export async function checkPermission(p: PermissionKind): Promise<PermissionState> {
  return (await getPermissionDetail(p)).status;
}

/** Shows the OS prompt when it can still be shown. Resolves `true` when the permission is granted. */
export async function requestPermission(p: PermissionKind): Promise<boolean> {
  try {
    const current = toDetail(await read(p));
    if (current.status === 'granted') return true;
    if (!current.canAskAgain) return false;
    return toDetail(await ask(p)).status === 'granted';
  } catch {
    return false;
  }
}

/** Opens this app's page in the OS settings. */
export function openAppSettings(): void {
  void Linking.openSettings().catch(() => undefined);
}
