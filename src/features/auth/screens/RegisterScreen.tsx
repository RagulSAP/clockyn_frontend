import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen, ResponsiveRow, FormSection } from '@/components/layout';
import { Button, LoadingOverlay, Spinner, TextField } from '@/components/ui';
import type { UserAuthMode } from '@/types/api/auth';
import { routes, useAppRouter } from '@/lib/navigation';
import { spacing } from '@/theme';

import { ContactOtpField } from '../components/ContactOtpField';
import { DynamicStringList } from '../components/DynamicStringList';
import { LogoPicker } from '../components/LogoPicker';
import { useAuthMode } from '../hooks/useAuthMode';
import { useRegistration } from '../hooks/useRegistration';
import { PIN_LENGTH } from '../utils/validation';

type Params = { mobileNumber?: string; emailAddress?: string; verifiedContact?: string };

/**
 * Company registration: details, contact verification (mobile + e-mail by OTP, or only the e-mail when the deployment signs
 * in by e-mail), branches / departments, optional statutory details, logo.
 */
export default function RegisterScreen() {
  const { mode, loading } = useAuthMode();
  if (loading) {
    return (
      <Screen title="Register Company" testID="register-screen">
        <Spinner />
      </Screen>
    );
  }
  return <RegisterForm key={mode} mode={mode} />;
}

function RegisterForm({ mode }: { mode: UserAuthMode }) {
  const params = useLocalSearchParams<Params>();
  const router = useAppRouter();
  const reg = useRegistration(
    { mobileNumber: first(params.mobileNumber), emailAddress: first(params.emailAddress), verifiedContact: first(params.verifiedContact) },
    mode,
  );
  const [showMore, setShowMore] = useState(false);
  const { values, fieldErrors, statutoryErrors } = reg;

  const submitButton = (
    <Button
      title={reg.loading ? 'Registering...' : 'Register Company'}
      size="lg"
      fullWidth
      loading={reg.loading}
      disabled={!reg.ready || reg.loading}
      onPress={reg.submit}
      testID="register-submit"
    />
  );

  return (
    <Screen
      title="Register Company"
      subtitle="Fill in your company details to get started"
      onBack={() => router.backOr(routes.adminLogin)}
      footer={submitButton}
      overlay={<LoadingOverlay visible={reg.loading} message="Setting up your company..." />}
      testID="register-screen"
    >
      <ResponsiveRow columns={{ phone: 1, tablet: 1, desktop: 2 }} gap={spacing.lg}>
        <FormSection title="Company details">
          <LogoPicker uri={reg.logo?.uri ?? null} onPick={reg.pickLogo} />
          <TextField
            label="Company Name"
            required
            value={values.orgName}
            onChangeText={(t) => reg.setField('orgName', t)}
            onBlur={() => reg.touch('orgName')}
            placeholder="Company Name"
            error={fieldErrors.orgName}
            testID="reg-org-name"
          />
          <TextField
            label="Company Address"
            required
            value={values.address}
            onChangeText={(t) => reg.setField('address', t)}
            onBlur={() => reg.touch('address')}
            placeholder="Company Address"
            multiline
            numberOfLines={3}
            error={fieldErrors.address}
            testID="reg-address"
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <TextField
              style={{ flex: 1 }}
              label="State"
              required
              value={values.state}
              onChangeText={(t) => reg.setField('state', t)}
              onBlur={() => reg.touch('state')}
              placeholder="State"
              error={fieldErrors.state}
              testID="reg-state"
            />
            <TextField
              style={{ flex: 1 }}
              label="District"
              required
              value={values.district}
              onChangeText={(t) => reg.setField('district', t)}
              onBlur={() => reg.touch('district')}
              placeholder="District"
              error={fieldErrors.district}
              testID="reg-district"
            />
          </View>
          <TextField
            label="Pincode"
            required
            value={values.pincode}
            onChangeText={(t) => reg.setField('pincode', t)}
            onBlur={() => reg.touch('pincode')}
            placeholder="Pincode"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={PIN_LENGTH}
            error={fieldErrors.pincode}
            testID="reg-pincode"
          />
          <TextField
            label="GST Number"
            value={values.gst}
            onChangeText={(t) => reg.setField('gst', t)}
            placeholder="GST Number"
            autoCapitalize="characters"
            maxLength={15}
            error={statutoryErrors.gst}
            testID="reg-gst"
          />
        </FormSection>

        <FormSection title="Contact verification" description={reg.mobile.needsOtp ? 'We verify your mobile number and e-mail with a one-time code.' : 'We verify your e-mail with a one-time code. You will sign in with it.'}>
          <ContactOtpField contact={reg.mobile} label="Mobile Number" placeholder="Mobile Number" testID="reg-mobile" />
          <ContactOtpField contact={reg.email} label="Email ID" placeholder="Email ID" testID="reg-email" />
        </FormSection>

        <FormSection title="Branches & departments">
          <DynamicStringList
            label="Branch"
            required
            itemLabel="Branch"
            addLabel="Add Branch"
            values={values.branches}
            onChange={(i, t) => reg.updateInList('branches', i, t)}
            onAdd={() => reg.addToList('branches')}
            onRemove={(i) => reg.removeFromList('branches', i)}
            error={fieldErrors.branches}
            testID="reg-branches"
          />
          <DynamicStringList
            label="Department"
            itemLabel="Department"
            addLabel="Add Department"
            values={values.departments}
            onChange={(i, t) => reg.updateInList('departments', i, t)}
            onAdd={() => reg.addToList('departments')}
            onRemove={(i) => reg.removeFromList('departments', i)}
            testID="reg-departments"
          />
        </FormSection>

        <FormSection title="More details" description="Optional statutory and business information.">
          {showMore ? (
            <View style={{ gap: spacing.lg }} testID="reg-more-details">
              <TextField label="PAN Number" value={values.pan} onChangeText={(t) => reg.setField('pan', t)} placeholder="PAN Number" autoCapitalize="characters" maxLength={10} error={statutoryErrors.pan} testID="reg-pan" />
              <TextField label="Company Website" value={values.website} onChangeText={(t) => reg.setField('website', t)} placeholder="Company Website" keyboardType="url" autoCapitalize="none" autoCorrect={false} testID="reg-website" />
              <TextField label="CIN Number" value={values.cin} onChangeText={(t) => reg.setField('cin', t)} placeholder="CIN Number" autoCapitalize="characters" maxLength={21} error={statutoryErrors.cin} testID="reg-cin" />
              <TextField label="TAN Number" value={values.tan} onChangeText={(t) => reg.setField('tan', t)} placeholder="TAN Number" autoCapitalize="characters" maxLength={10} error={statutoryErrors.tan} testID="reg-tan" />
              <TextField label="MSME Number" value={values.msme} onChangeText={(t) => reg.setField('msme', t)} placeholder="MSME Number" testID="reg-msme" />
              <TextField label="Business Category" value={values.businessCategory} onChangeText={(t) => reg.setField('businessCategory', t)} placeholder="Business Category" testID="reg-category" />
            </View>
          ) : null}
          <Button
            title={showMore ? 'Hide Additional Details' : 'Add More Details'}
            variant="secondary"
            size="sm"
            icon={showMore ? 'chevron-up' : 'chevron-down'}
            onPress={() => setShowMore((v) => !v)}
            testID="reg-toggle-more"
          />
        </FormSection>
      </ResponsiveRow>
    </Screen>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
