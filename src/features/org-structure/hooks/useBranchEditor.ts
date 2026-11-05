/** Add / edit branch form controller: values, validation, GPS lookup + map picker, save. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { branchesApi } from '@/api';
import { routes } from '@/config/routes';
import { useConfirm, useToast } from '@/components/ui';
import { useAsyncAction, useMounted } from '@/hooks';
import { useAppRouter } from '@/lib/navigation';
import { LocationError, getCurrentPosition, requestLocationPermission } from '@/lib/platform/location';
import type { LatLng } from '@/lib/platform/maps';
import { openAppSettings } from '@/lib/platform/permissions';

import { EMPTY_BRANCH_FORM, formFromBranch, hasGps, validateBranchForm, type BranchFormErrors, type BranchFormValues } from '../utils/branchForm';
import type { PickedLocation } from '../components/LocationPickerModal';
import { useBranchList } from './useOrgQueries';
import { orgStructureKeys, useOrgScope } from './useOrgScope';

export function useBranchEditor(branchId: string | undefined) {
  const isEdit = !!branchId;
  const scope = useOrgScope();
  const router = useAppRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const isMounted = useMounted();
  const list = useBranchList(scope.scopeId);

  const branch = isEdit ? list.data?.find((b) => b.id === branchId) : undefined;
  const [values, setValues] = useState<BranchFormValues>(EMPTY_BRANCH_FORM);
  const [errors, setErrors] = useState<BranchFormErrors>({});
  const [locating, setLocating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startPin, setStartPin] = useState<LatLng | null>(null);

  const hydrated = useRef(false);
  useEffect(() => {
    if (!isEdit || hydrated.current || !branch) return;
    hydrated.current = true;
    setValues(formFromBranch(branch));
  }, [isEdit, branch]);

  const setName = useCallback((name: string) => {
    setValues((v) => ({ ...v, name }));
    if (name.trim() !== '') setErrors((e) => ({ ...e, name: undefined }));
  }, []);
  const setAddress = useCallback((address: string) => {
    setValues((v) => ({ ...v, address }));
    if (address.trim() !== '') setErrors((e) => ({ ...e, address: undefined }));
  }, []);
  const setRadius = useCallback((radius: number) => setValues((v) => ({ ...v, radius })), []);

  /** GPS field tapped: permission, then a pin (stored coordinates in edit mode, the current fix otherwise), then the map. */
  const openPicker = useCallback(async () => {
    setErrors((e) => ({ ...e, gps: undefined }));
    setLocating(true);
    try {
      const granted = await requestLocationPermission('foreground');
      if (!granted) {
        const openSettings = await confirm({
          title: 'Location Permission Required',
          message: 'Clockyn needs location access to set the branch location for attendance tracking.',
          confirmText: 'Open Settings',
          cancelText: 'Cancel',
        });
        if (openSettings) openAppSettings();
        // Browsers have no settings deep link and the map works without a GPS fix: let the user pick by hand there.
        if (Platform.OS !== 'web') return;
      }
      let pin: LatLng | null = null;
      if (isEdit && hasGps(values.latitude, values.longitude)) {
        pin = { latitude: values.latitude, longitude: values.longitude };
      } else if (granted) {
        try {
          const fix = await getCurrentPosition({ accuracy: 'high' });
          pin = { latitude: fix.latitude, longitude: fix.longitude };
        } catch (e) {
          if (!(e instanceof LocationError) || e.code !== 'denied') toast.error('Failed to get location');
          // v1 stopped here; the map still opens (at the default centre, no pin) so the location can be set by hand.
        }
      }
      if (!isMounted()) return;
      setStartPin(pin);
      setPickerOpen(true);
    } finally {
      if (isMounted()) setLocating(false);
    }
  }, [confirm, isEdit, values.latitude, values.longitude, toast, isMounted]);

  const confirmLocation = useCallback((loc: PickedLocation) => {
    setValues((v) => ({
      ...v,
      latitude: loc.latitude,
      longitude: loc.longitude,
      // The resolved address only fills an EMPTY address field (v1 showed it but never copied it).
      address: v.address.trim() === '' && loc.address ? loc.address : v.address,
    }));
    setErrors((e) => ({ ...e, gps: undefined, address: e.address && loc.address ? undefined : e.address }));
    setPickerOpen(false);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const found = validateBranchForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return false; // inline messages only (v1: no toast)
    if (!scope.orgId) {
      toast.error('Please login first');
      return false;
    }
    const input = { orgId: scope.orgId, name: values.name, address: values.address, latitude: values.latitude, longitude: values.longitude, radius: values.radius };
    if (isEdit && branchId) await branchesApi.updateBranch(branchId, input);
    else await branchesApi.addBranch(input);
    for (const key of orgStructureKeys(scope, ['branches', 'home'])) {
      void queryClient.invalidateQueries({ queryKey: key }).catch(() => undefined);
    }
    toast.success(isEdit ? 'Branch updated successfully' : 'Branch added successfully');
    return true;
  }, [values, scope, isEdit, branchId, toast, queryClient]);

  const { run, loading: saving } = useAsyncAction(save, {
    errorMessage: isEdit ? 'Failed to update branch' : 'Failed to save branch',
    onSuccess: (ok) => {
      if (ok) router.backOr(routes.admin.branches.list);
    },
  });

  return useMemo(
    () => ({
      isEdit,
      values,
      errors,
      setName,
      setAddress,
      setRadius,
      gpsSet: hasGps(values.latitude, values.longitude),
      locating,
      openPicker: () => void openPicker(),
      pickerOpen,
      closePicker: () => setPickerOpen(false),
      startPin,
      confirmLocation,
      saving,
      submit: () => void run(),
      loading: isEdit && list.isLoading,
      notFound: isEdit && !list.isLoading && !branch && !list.isError,
      loadError: isEdit && list.isError && !branch,
      retry: () => void list.refetch(),
    }),
    [isEdit, values, errors, setName, setAddress, setRadius, locating, openPicker, pickerOpen, startPin, confirmLocation, saving, run, list, branch],
  );
}
