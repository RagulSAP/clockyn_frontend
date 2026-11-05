import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { employeeApi } from '@/api';
import { useToast } from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { MediaPermissionError, pickImage, type PickedImage } from '@/lib/platform/media';
import { queryKeys } from '@/lib/query/queryKeys';
import { patchSession, useSession } from '@/store/auth';
import type { StaffRecord } from '@/types/api/staff';

import {
  fieldError,
  hasUnsavedChanges,
  issuesMessage,
  sanitizeInput,
  toDraft,
  toUpdateInput,
  validateChanged,
  type FieldKey,
  type PersonalDraft,
} from '../utils/personalDetails';

/** How long the "Saved!" confirmation stays up. */
export const SAVED_MODAL_MS = 2000;

export type PhotoSource = 'camera' | 'library';

/** State and actions of the personal-details screen (view / edit, photo, validation, save). */
export function usePersonalDetailsEditor() {
  const session = useSession();
  const userId = session?.userId ?? '';
  const orgId = session?.orgId ?? '';
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: queryKeys.staff.personal(userId),
    queryFn: () => employeeApi.getPersonalDetails(userId),
    enabled: userId !== '',
    staleTime: 30_000,
  });
  const saved = useMemo(() => toDraft(query.data), [query.data]);

  const [isEdit, setIsEdit] = useState(false);
  const [draft, setDraft] = useState<PersonalDraft>(saved);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const dirty = isEdit && hasUnsavedChanges(draft, saved, photo !== null);

  /** Inline errors: only fields the user changed (an old stored value never blocks unrelated edits). */
  const errors = useMemo(() => {
    const out: Partial<Record<FieldKey, string>> = {};
    for (const key of Object.keys(draft) as FieldKey[]) {
      if (draft[key] === saved[key]) continue;
      const hint = fieldError(key, draft[key]);
      if (hint) out[key] = hint;
    }
    return out;
  }, [draft, saved]);

  const startEdit = useCallback(() => {
    setDraft(saved);
    setPhoto(null);
    setIsEdit(true);
  }, [saved]);

  const discard = useCallback(() => {
    setDraft(saved);
    setPhoto(null);
    setIsEdit(false);
  }, [saved]);

  const setField = useCallback((key: FieldKey, text: string) => {
    setDraft((d) => ({ ...d, [key]: sanitizeInput(key, text) }));
  }, []);

  const choosePhoto = useCallback(
    async (source: PhotoSource) => {
      try {
        const picked = await pickImage({ source, allowsEditing: true, quality: 0.8 });
        if (picked) setPhoto(picked);
      } catch (e) {
        toast.error(e instanceof MediaPermissionError ? e.message : 'Could not open the camera or gallery.');
      }
    },
    [toast],
  );

  const saveAction = useAsyncAction(
    async (): Promise<boolean> => {
      const issues = validateChanged(draft, saved);
      if (issues.length > 0) {
        toast.error(`Invalid Input\n${issuesMessage(issues)}`);
        return false;
      }
      await employeeApi.updatePersonalDetails(userId, toUpdateInput(draft));
      let photoFailed = false;
      let uploadedUrl: string | undefined;
      if (photo) {
        try {
          uploadedUrl = await employeeApi.uploadProfilePhoto(userId, { uri: photo.uri, fileName: photo.fileName || 'profile.jpg', mimeType: photo.mimeType || 'image/jpeg' });
        } catch {
          photoFailed = true;
        }
      }
      try {
        const fresh = await employeeApi.getPersonalDetails(userId);
        // v1 kept the URL returned by the upload when the details response carries no photo (so the avatar updates).
        queryClient.setQueryData(queryKeys.staff.personal(userId), uploadedUrl && !fresh.photoUrl ? { ...fresh, photoUrl: uploadedUrl } : fresh);
      } catch {
        void queryClient.invalidateQueries({ queryKey: queryKeys.staff.personal(userId) });
      }
      // The home greeting reads the name from the staff record / session: keep both in step.
      const name = draft.name.trim();
      if (name) {
        queryClient.setQueryData(queryKeys.home.employee(userId, orgId), (old: StaffRecord | undefined) => (old ? { ...old, name } : old));
        patchSession({ name });
      }
      if (photoFailed) toast.error('Your details were saved, but the new photo could not be uploaded. Please try again.');
      return true;
    },
    {
      errorMessage: 'Failed to save',
      onSuccess: (ok) => {
        if (!ok) return;
        setIsEdit(false);
        setPhoto(null);
        setShowSaved(true);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setShowSaved(false), SAVED_MODAL_MS);
      },
    },
  );

  return {
    query,
    details: query.data,
    saved,
    draft,
    errors,
    isEdit,
    dirty,
    photo,
    saving: saveAction.loading,
    showSaved,
    startEdit,
    discard,
    setField,
    setDraftValue: (key: FieldKey, value: string) => setDraft((d) => ({ ...d, [key]: value })),
    choosePhoto,
    save: saveAction.run,
    closeSaved: () => setShowSaved(false),
  };
}

export type PersonalDetailsEditor = ReturnType<typeof usePersonalDetailsEditor>;
