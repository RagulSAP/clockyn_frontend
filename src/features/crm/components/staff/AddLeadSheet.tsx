import React, { useState } from 'react';

import { BottomSheet, Button, Text, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { useOrgId } from '@/store/auth';

import { SAVE_FAILED_MESSAGE, useSaveLead } from '../../hooks/useLeadWrites';
import { EMPTY_LEAD_FORM, toCreateInput, validateLeadForm, type LeadFormField, type LeadFormValues } from '../../utils/leadForm';
import { LeadForm } from '../LeadForm';

export interface AddLeadSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Staff "Add New Lead" sheet. Errors are shown inline (v1). The lead is created UNASSIGNED, so it will not appear in
 * My Leads until an admin assigns it - the confirmation says so (v1 closed silently).
 */
export function AddLeadSheet({ visible, onClose }: AddLeadSheetProps) {
  const orgId = useOrgId();
  const toast = useToast();
  const save = useSaveLead();
  const [values, setValues] = useState<LeadFormValues>(EMPTY_LEAD_FORM);
  const [errors, setErrors] = useState<Partial<Record<LeadFormField, string>>>({});
  const [formError, setFormError] = useState('');

  const [wasVisible, setWasVisible] = useState(visible);
  // Every open starts with a blank form (state adjusted during render, not in an effect).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setValues(EMPTY_LEAD_FORM);
      setErrors({});
      setFormError('');
    }
  }

  const submit = async () => {
    const result = validateLeadForm(values, 'staff');
    setErrors(result.fields);
    setFormError(result.message);
    if (!result.ok) return;
    try {
      await save.mutateAsync({ leadId: null, input: toCreateInput(values, orgId) });
      toast.success('Lead saved and sent to your admin for assignment');
      onClose();
    } catch (e) {
      setFormError(getErrorMessage(e, `${SAVE_FAILED_MESSAGE.create}.`));
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Add New Lead"
      snap="full"
      testID="crm-add-lead-sheet"
      footer={<Button title="Save Lead" icon="check-circle" fullWidth loading={save.isPending} onPress={() => void submit()} testID="crm-add-lead-save" />}
    >
      <LeadForm
        values={values}
        onChange={(p) => {
          setValues((v) => ({ ...v, ...p }));
          setFormError('');
        }}
        errors={errors}
        disabled={save.isPending}
      />
      {formError ? (
        <Text variant="callout" color="danger" style={{ marginTop: 12 }} testID="crm-add-lead-error">
          {formError}
        </Text>
      ) : null}
    </BottomSheet>
  );
}
