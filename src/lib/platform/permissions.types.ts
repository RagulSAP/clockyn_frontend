export type PermissionKind = 'location' | 'camera' | 'photos' | 'notifications';
export type PermissionState = 'granted' | 'denied' | 'undetermined';
export type PermissionDetail = {
  status: PermissionState;
  /** false when the OS/browser will no longer show the prompt (send the user to settings). */
  canAskAgain: boolean;
};
