/** Add / edit staff form controller: values, validation, employee-id suggestion, photo, submit, dirty tracking. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { authApi, staffApi } from '@/api';
import { routes } from '@/config/routes';
import { useToast } from '@/components/ui';
import { useAuthMode } from '@/features/auth';
import { useAsyncAction, useMounted } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { useAppRouter } from '@/lib/navigation';
import { MediaPermissionError, pickImage, type PickedImage } from '@/lib/platform/media';

import { suggestEmployeeId } from '../utils/employeeId';
import {
  DUPLICATE_EMPLOYEE_ID_MESSAGE,
  EMPTY_STAFF_FORM,
  digitsOnly,
  formFromRecord,
  hasErrors,
  hasMoreDetails,
  isStaffFormDirty,
  staffLimitReached,
  toStaffInput,
  validateStaffForm,
  type StaffFormErrors,
  type StaffFormValues,
  type StaffRequiredField,
} from '../utils/staffForm';
import { orgStructureKeys, useOrgScope } from './useOrgScope';
import { useStaffLimit, useStaffOptions, useStaffRecord } from './useStaffFormData';

type Snapshot = { values: StaffFormValues; photo: string | null };

/** Per-field input normalisation of the v1 form. */
function normalise<K extends keyof StaffFormValues>(key: K, value: StaffFormValues[K]): StaffFormValues[K] {
  if (typeof value !== 'string') return value;
  switch (key) {
    case 'email':
      return value.toLowerCase() as StaffFormValues[K];
    case 'ifsc':
      return value.toUpperCase() as StaffFormValues[K];
    case 'phone':
      return digitsOnly(value, 10) as StaffFormValues[K];
    case 'emergencyContact':
    case 'accNo':
      return digitsOnly(value) as StaffFormValues[K];
    default:
      return value;
  }
}

const REQUIRED_FIELDS: readonly StaffRequiredField[] = ['name', 'empId', 'phone', 'branchName', 'deptName', 'gender'];

export function useStaffEditor(staffId: string | undefined) {
  const isEdit = !!staffId;
  const emailRequired = useAuthMode().mode === 'email';
  const scope = useOrgScope();
  const router = useAppRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isMounted = useMounted();

  // Add mode always works in the session's org scope; edit mode in the viewer's scope (a manager's own user id).
  const formScope = isEdit ? scope.scopeId : scope.orgId;

  const options = useStaffOptions(formScope, scope.roleId);
  const limitInfo = useStaffLimit(scope.orgId, !isEdit);
  const staff = useStaffRecord(scope.scopeId, staffId);

  const [values, setValues] = useState<StaffFormValues>(EMPTY_STAFF_FORM);
  const [errors, setErrors] = useState<StaffFormErrors>({});
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<PickedImage | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  // ── employee id suggestion (Add mode, once; never overwrites what the user typed) ──────────
  const empIdTouched = useRef(false);
  const suggestionStarted = useRef(false);
  useEffect(() => {
    if (isEdit || suggestionStarted.current || formScope === '' || scope.roleId === 0) return;
    suggestionStarted.current = true;
    setSuggesting(true);
    void suggestEmployeeId({
      getNext: () => staffApi.getNextEmployeeId(formScope, scope.roleId),
      isAvailable: (id) => staffApi.isEmployeeIdAvailable(formScope, scope.roleId, id),
    })
      .then((id) => {
        if (isMounted() && !empIdTouched.current) setValues((v) => ({ ...v, empId: id }));
      })
      .finally(() => {
        if (isMounted()) setSuggesting(false);
      });
  }, [isEdit, formScope, scope.roleId, isMounted]);

  // ── edit mode: hydrate the form once the record (and photo) settled ───────────────────────
  const hydrated = useRef(false);
  const { ready, record, photoUrl } = staff;
  useEffect(() => {
    if (!isEdit || hydrated.current || !ready || !record) return;
    hydrated.current = true;
    const initial = formFromRecord(record);
    setValues(initial);
    setPhoto(photoUrl);
    setShowMore(hasMoreDetails(initial));
    // The snapshot includes the photo (v1 forgot it, so staff with a photo always looked "dirty").
    setSnapshot({ values: initial, photo: photoUrl });
  }, [isEdit, ready, record, photoUrl]);

  const recordFailed = isEdit && staff.error;
  const recordFailureShown = useRef(false);
  useEffect(() => {
    if (recordFailed && !recordFailureShown.current) {
      recordFailureShown.current = true;
      toast.error('Failed to load staff details');
    }
    if (!recordFailed) recordFailureShown.current = false;
  }, [recordFailed, toast]);

  const setField = useCallback(<K extends keyof StaffFormValues>(key: K, value: StaffFormValues[K]) => {
    if (key === 'empId') empIdTouched.current = true;
    setValues((v) => ({ ...v, [key]: normalise(key, value) }));
    setErrors((e) => {
      if (!(REQUIRED_FIELDS as readonly string[]).includes(key) || !e[key as StaffRequiredField]) return e;
      const next = { ...e };
      delete next[key as StaffRequiredField];
      return next;
    });
  }, []);

  const pickPhoto = useCallback(async () => {
    try {
      const image = await pickImage({ source: 'library', allowsEditing: true, quality: 0.8 });
      if (image && isMounted()) {
        setPhoto(image.uri);
        setPhotoFile(image);
      }
    } catch (e) {
      if (e instanceof MediaPermissionError) toast.error('Permission required to access photos');
      else toast.error(getErrorMessage(e, 'Could not open the photo library'));
    }
  }, [toast, isMounted]);

  /** Clears the LOCAL selection only (the server has no endpoint to remove a photo). */
  const removePhoto = useCallback(() => {
    setPhoto(null);
    setPhotoFile(null);
  }, []);

  const limitReached = !isEdit && staffLimitReached(limitInfo);
  const dirty = isEdit && isStaffFormDirty(values, snapshot?.values ?? null, photo, snapshot?.photo ?? null);

  const finish = useCallback(() => {
    router.backOr(scope.roleId === 2 ? routes.staff.settings : routes.admin.staff.list);
  }, [router, scope.roleId]);

  const save = useCallback(async (): Promise<boolean> => {
    const found = validateStaffForm(values, { emailRequired });
    setErrors(found);
    if (hasErrors(found)) {
      toast.error('Please fill all required fields');
      return false;
    }
    if (limitReached) return false;

    if (!isEdit) {
      const available = await staffApi.isEmployeeIdAvailable(formScope, scope.roleId, values.empId.trim());
      if (!available) {
        setErrors({ empId: DUPLICATE_EMPLOYEE_ID_MESSAGE });
        toast.error('Employee ID already exists. Please use a different ID.');
        return false;
      }
    }

    const input = toStaffInput(values, formScope);
    const result = isEdit && staffId ? await staffApi.updateStaff(staffId, input) : await staffApi.addStaff(input);

    // Photo: a second multipart call after the save; only a freshly picked local image is uploaded.
    const uploadId = result.userId || staffId;
    if (photo && photoFile && !photo.startsWith('http') && uploadId) {
      try {
        await authApi.uploadEmployeePhoto(uploadId, { uri: photoFile.uri, fileName: photoFile.fileName, mimeType: photoFile.mimeType });
      } catch (e) {
        toast.error(`Staff saved, but the photo could not be uploaded. ${getErrorMessage(e, '')}`.trim());
      }
    }

    for (const key of orgStructureKeys({ orgId: scope.orgId, scopeId: formScope }, ['staff', 'home', 'shifts'])) {
      void queryClient.invalidateQueries({ queryKey: key }).catch(() => undefined);
    }
    if (uploadId) void queryClient.invalidateQueries({ queryKey: ['company', uploadId] }).catch(() => undefined);
    toast.success(isEdit ? 'Staff updated successfully!' : 'Staff added successfully!');
    return true;
  }, [values, emailRequired, limitReached, isEdit, formScope, scope.roleId, scope.orgId, staffId, photo, photoFile, toast, queryClient]);

  const { run, loading: saving } = useAsyncAction(save, {
    errorMessage: isEdit ? 'Failed to update staff' : 'Failed to add staff',
    onSuccess: (ok) => {
      if (ok) finish();
    },
  });

  return useMemo(
    () => ({
      isEdit,
      emailRequired,
      values,
      errors,
      setField,
      photo,
      pickPhoto,
      removePhoto,
      showMore,
      toggleMore: () => setShowMore((s) => !s),
      options,
      limitInfo,
      limitReached,
      suggesting,
      saving,
      submit: () => void run(),
      dirty,
      finish,
      loadingRecord: isEdit && (staff.loading || (staff.ready && !snapshot)),
      recordError: isEdit && staff.error,
      retryRecord: staff.refetch,
    }),
    [isEdit, emailRequired, values, errors, setField, photo, pickPhoto, removePhoto, showMore, options, limitInfo, limitReached, suggesting, saving, run, dirty, finish, staff, snapshot],
  );
}
