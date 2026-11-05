import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import * as authApi from '@/api/auth';
import * as companyApi from '@/api/company';
import { FormSection, Screen } from '@/components/layout';
import { Button, ErrorState, LoadingOverlay, SkeletonList, TextField, useToast } from '@/components/ui';
import { useAuthMode } from '@/features/auth';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { getErrorMessage } from '@/lib/api/errors';
import { routes, useAppRouter } from '@/lib/navigation';
import { pickImage } from '@/lib/platform/media';
import type { PickedImage } from '@/lib/platform/media';
import { queryKeys } from '@/lib/query/queryKeys';
import { patchSession, useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { LogoPicker } from '../components/LogoPicker';
import { OtpContactField } from '../components/OtpContactField';
import { TextListEditor } from '../components/TextListEditor';
import { useCompanyDepartments, useCompanyDetails } from '../hooks/useCompanyQueries';
import { useContactVerification } from '../hooks/useContactVerification';
import {
  MAX_LENGTH,
  MSG_NO_SESSION,
  MSG_VERIFY_EMAIL,
  MSG_VERIFY_MOBILE,
  buildCompanyInput,
  canRequestEmailOtp,
  canRequestMobileOtp,
  cinError,
  contactNeedsVerification,
  digitsOnly,
  emptyCompanyForm,
  formFromDetails,
  hasMoreDetails,
  panError,
  tanError,
  validateCompanyForm,
  type CompanyFormValues,
  type CompanyMode,
} from '../utils/companyForm';

/** Add a company (no `orgId`) or edit one (`orgId`): route `/admin/company/edit`. */
export default function CompanyEditScreen() {
  const params = useLocalSearchParams<{ orgId?: string }>();
  const editOrgId = typeof params.orgId === 'string' ? params.orgId : '';
  const mode: CompanyMode = editOrgId ? 'edit' : 'add';
  const isEdit = mode === 'edit';

  const session = useSession();
  const router = useAppRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const userId = session?.userId ?? '';

  const details = useCompanyDetails(editOrgId, isEdit);
  const departments = useCompanyDepartments(editOrgId, isEdit);

  const [values, setValues] = useState<CompanyFormValues>(emptyCompanyForm);
  const [showMore, setShowMore] = useState(false);
  const [pincodeError, setPincodeError] = useState('');
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [existingLogo, setExistingLogo] = useState<string | null>(null);
  const [logoCleared, setLogoCleared] = useState(false);
  const [ready, setReady] = useState(!isEdit);

  // E-mail sign-in deployments never send SMS: the mobile number is plain data there, only the e-mail is verified.
  const { mode: authMode } = useAuthMode();
  const mobileV = useContactVerification('mobile');
  const emailV = useContactVerification('email');

  const original = useMemo(
    () => ({ mobile: details.data?.mobile ?? '', email: (details.data?.email ?? '').toLowerCase() }),
    [details.data?.mobile, details.data?.email],
  );

  // Edit pre-fill, once the profile and the department names are in.
  const prefilled = useRef(false);
  useEffect(() => {
    if (!isEdit || prefilled.current || !details.data || departments.isLoading) return;
    prefilled.current = true;
    const form = formFromDetails(details.data, (departments.data ?? []).map((d) => d.name));
    setValues(form);
    setShowMore(hasMoreDetails(form));
    setExistingLogo(details.data.logoUrl ?? null);
    setReady(true);
  }, [isEdit, details.data, departments.data, departments.isLoading]);

  const patch = (p: Partial<CompanyFormValues>) => setValues((v) => ({ ...v, ...p }));

  const logoUri = logoCleared ? null : (picked?.uri ?? existingLogo);

  const pickLogo = async () => {
    try {
      const img = await pickImage({ source: 'library', allowsEditing: true, quality: 0.8 });
      if (img) {
        setPicked(img);
        setLogoCleared(false);
      }
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not open the photo library'));
    }
  };

  const save = useAsyncAction(
    async () => {
      const check = validateCompanyForm(values, mode);
      setPincodeError(check.fieldErrors.pincode ?? '');
      if (check.message) {
        toast.error(check.message);
        return false;
      }
      if (authMode === 'otp' && contactNeedsVerification(mode, values.mobile, original.mobile, mobileV.state === 'verified')) {
        toast.error(MSG_VERIFY_MOBILE);
        return false;
      }
      if (contactNeedsVerification(mode, values.email, original.email, emailV.state === 'verified')) {
        toast.error(MSG_VERIFY_EMAIL);
        return false;
      }
      if (!userId) {
        toast.error(MSG_NO_SESSION);
        return false;
      }

      const input = buildCompanyInput(values, { userId, mode, legacyGst: details.data?.gst });
      const result = isEdit ? await companyApi.updateCompany(editOrgId, input) : await companyApi.addCompany(input);
      const targetOrg = isEdit ? editOrgId : (result.orgId ?? '');

      // The company is saved; a logo problem must be reported (v1 swallowed it) but must not undo the save.
      let logoFailed = false;
      if (picked && targetOrg) {
        const file = { uri: picked.uri, fileName: picked.fileName, mimeType: picked.mimeType };
        try {
          if (isEdit) await companyApi.updateCompanyLogo(targetOrg, file);
          else await authApi.uploadOrgLogo(targetOrg, file);
        } catch {
          logoFailed = true;
        }
      }

      void queryClient.invalidateQueries({ queryKey: queryKeys.company.all(targetOrg || session?.orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.company.list(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.departments.all(targetOrg) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all(targetOrg) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home.orgAdmin(targetOrg) });
      if (isEdit && editOrgId === session?.orgId) patchSession({ orgName: input.name });

      toast.success(isEdit ? 'Company Updated!' : 'Company Added Successfully!');
      if (logoFailed) toast.error('The company was saved, but the logo could not be uploaded. Try again from Edit Company.');
      router.backOr(routes.admin.company.view, isEdit ? { orgId: editOrgId } : undefined);
      return true;
    },
    { errorMessage: 'Failed to save company' },
  );

  const busy = save.loading;
  const title = isEdit ? 'Edit Company' : 'Add Company';
  const loadingProfile = isEdit && !ready && !details.isError;

  return (
    <Screen
      title={title}
      subtitle={isEdit ? details.data?.name : session?.orgName || undefined}
      maxWidth={760}
      footer={
        <Button
          title={busy ? (isEdit ? 'Updating...' : 'Adding...') : isEdit ? 'Update Company' : 'Add Company'}
          icon="check"
          size="lg"
          fullWidth
          loading={busy}
          disabled={loadingProfile || (isEdit && !details.data)}
          onPress={() => void save.run()}
          testID="company-submit"
        />
      }
      testID="company-edit-screen"
    >
      {isEdit && details.isError ? (
        <ErrorState message={getErrorMessage(details.error, 'Failed to load company')} onRetry={() => void details.refetch()} />
      ) : loadingProfile ? (
        <SkeletonList count={5} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          <FormSection title="Company">
            <LogoPicker uri={logoUri} name={values.name} disabled={busy} onPick={() => void pickLogo()} onRemove={() => { setPicked(null); setLogoCleared(true); }} />
            <TextField label="Company Name" value={values.name} onChangeText={(name) => patch({ name })} placeholder="Enter company name" required editable={!busy} testID="company-name" />
            <TextField label="Company Address" value={values.address} onChangeText={(address) => patch({ address })} placeholder="Enter company address" multiline numberOfLines={3} required editable={!busy} testID="company-address" />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TextField label="State" value={values.state} onChangeText={(state) => patch({ state })} placeholder="State" required editable={!busy} style={{ flex: 1 }} testID="company-state" />
              <TextField label="District" value={values.district} onChangeText={(district) => patch({ district })} placeholder="District" required editable={!busy} style={{ flex: 1 }} testID="company-district" />
            </View>
            <TextField
              label="Pincode"
              value={values.pincode}
              onChangeText={(t) => {
                patch({ pincode: digitsOnly(t) });
                setPincodeError('');
              }}
              placeholder="Pincode"
              keyboardType="number-pad"
              maxLength={MAX_LENGTH.pincode}
              error={pincodeError}
              required
              editable={!busy}
              testID="company-pincode"
            />
            <TextField label="GST Number" value={values.gstNumber} onChangeText={(gstNumber) => patch({ gstNumber: gstNumber.toUpperCase() })} placeholder="Enter GST number" maxLength={MAX_LENGTH.gst} autoCapitalize="characters" editable={!busy} testID="company-gst" />
          </FormSection>

          <FormSection title="Contact" description={isEdit ? (authMode === 'otp' ? 'A changed mobile number or email must be verified with an OTP.' : 'A changed email must be verified with an OTP.') : undefined}>
            <OtpContactField
              label="Mobile Number"
              placeholder="Enter mobile number"
              keyboardType="number-pad"
              maxLength={MAX_LENGTH.mobile}
              value={values.mobile}
              onChange={(t) => patch({ mobile: digitsOnly(t) })}
              canRequest={authMode === 'otp' && canRequestMobileOtp(values.mobile, original.mobile)}
              verification={mobileV}
              disabled={busy}
              testID="company-mobile"
            />
            <OtpContactField
              label="Email ID"
              placeholder="Enter email address"
              keyboardType="email-address"
              value={values.email}
              onChange={(t) => patch({ email: t.toLowerCase() })}
              canRequest={canRequestEmailOtp(values.email, original.email)}
              verification={emailV}
              disabled={busy}
              testID="company-email"
            />
          </FormSection>

          <FormSection title="Structure">
            {isEdit ? null : <TextListEditor noun="Branch" values={values.branches} onChange={(branches) => patch({ branches })} required disabled={busy} testID="company-branches" />}
            <TextListEditor noun="Department" values={values.departments} onChange={(departmentsList) => patch({ departments: departmentsList })} disabled={busy} testID="company-departments" />
          </FormSection>

          <FormSection title="Attendance Settings" description="Controls how many times staff can punch in per day.">
            <TextField
              label="Max Daily Punch Sessions"
              value={values.maxSessionsPerDay}
              onChangeText={(t) => patch({ maxSessionsPerDay: digitsOnly(t) })}
              placeholder="3"
              keyboardType="number-pad"
              maxLength={2}
              editable={!busy}
              testID="company-max-sessions"
            />
          </FormSection>

          <FormSection title="Additional details">
            <Button
              title={showMore ? 'Hide Additional Details' : 'Add More Details'}
              variant="secondary"
              size="sm"
              iconRight={showMore ? 'chevron-up' : 'chevron-down'}
              onPress={() => setShowMore((s) => !s)}
              style={{ alignSelf: 'flex-start' }}
              testID="company-more-toggle"
            />
            {showMore ? (
              <View style={{ gap: spacing.lg }}>
                <TextField label="PAN Number" value={values.pan} onChangeText={(t) => patch({ pan: t.toUpperCase() })} placeholder="Enter PAN number" maxLength={MAX_LENGTH.pan} autoCapitalize="characters" error={panError(values.pan)} editable={!busy} testID="company-pan" />
                <TextField label="Company Website" value={values.website} onChangeText={(website) => patch({ website })} placeholder="Enter company website" keyboardType="url" autoCapitalize="none" editable={!busy} testID="company-website" />
                <TextField label="CIN Number" value={values.cin} onChangeText={(t) => patch({ cin: t.toUpperCase() })} placeholder="Enter CIN number" maxLength={MAX_LENGTH.cin} autoCapitalize="characters" error={cinError(values.cin)} editable={!busy} testID="company-cin" />
                <TextField label="TAN Number" value={values.tan} onChangeText={(t) => patch({ tan: t.toUpperCase() })} placeholder="Enter TAN number" maxLength={MAX_LENGTH.tan} autoCapitalize="characters" error={tanError(values.tan)} editable={!busy} testID="company-tan" />
                <TextField label="MSME Number" value={values.msme} onChangeText={(msme) => patch({ msme })} placeholder="Enter MSME number" editable={!busy} testID="company-msme" />
                <TextField label="Business Category" value={values.businessCategory} onChangeText={(businessCategory) => patch({ businessCategory })} placeholder="Enter business category" editable={!busy} testID="company-category" />
              </View>
            ) : null}
          </FormSection>
        </View>
      )}
      <LoadingOverlay visible={busy} message={isEdit ? 'Updating Company...' : 'Adding Company...'} />
    </Screen>
  );
}
