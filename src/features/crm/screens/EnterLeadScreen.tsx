import React, { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/layout';
import { Button, Card, ErrorState, SkeletonList, useToast } from '@/components/ui';
import { routes } from '@/config/routes';
import { getErrorMessage } from '@/lib/api/errors';
import { useAppRouter } from '@/lib/navigation';
import { useOrgId, useSession } from '@/store/auth';

import { LeadForm } from '../components/LeadForm';
import { SuccessPopup } from '../components/SuccessPopup';
import { useAdminLeads } from '../hooks/useAdminLeads';
import { SAVE_FAILED_MESSAGE, useSaveLead } from '../hooks/useLeadWrites';
import { EMPTY_LEAD_FORM, leadToFormValues, toCreateInput, toUpdateInput, validateLeadForm, type LeadFormField, type LeadFormValues } from '../utils/leadForm';

/** `/admin/crm/leads/edit` - Enter New Lead (no `leadId`) or Edit Lead (`leadId` param, prefilled from the cached list). */
export default function EnterLeadScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const session = useSession();
  const orgId = useOrgId();
  const params = useLocalSearchParams<{ leadId?: string }>();
  const leadId = typeof params.leadId === 'string' && params.leadId !== '' ? params.leadId : null;
  const isEdit = leadId !== null;

  const { leads, isLoading, isError, error, refetchAll } = useAdminLeads(isEdit);
  const save = useSaveLead();
  const [values, setValues] = useState<LeadFormValues>(EMPTY_LEAD_FORM);
  const [errors, setErrors] = useState<Partial<Record<LeadFormField, string>>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Prefill once from the loaded lead - the required date is part of the form values (v1 blanked it).
  const prefilled = useRef(false);
  const lead = isEdit ? (leads.find((l) => l.id === leadId) ?? null) : null;
  useEffect(() => {
    if (!lead || prefilled.current) return;
    prefilled.current = true;
    setValues(leadToFormValues(lead));
  }, [lead]);

  const patch = (p: Partial<LeadFormValues>) => {
    setValues((v) => ({ ...v, ...p }));
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(p) as (keyof LeadFormValues)[]) delete next[key as LeadFormField];
      return next;
    });
  };

  const submit = async () => {
    const result = validateLeadForm(values, 'admin');
    setErrors(result.fields);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    try {
      await save.mutateAsync(leadId === null ? { leadId: null, input: toCreateInput(values, orgId) } : { leadId, input: toUpdateInput(values, orgId) });
      setSuccessMessage(isEdit ? 'Lead Updated!' : 'Lead Saved!');
    } catch (e) {
      toast.error(getErrorMessage(e, isEdit ? SAVE_FAILED_MESSAGE.update : SAVE_FAILED_MESSAGE.create));
    }
  };

  const finish = () => {
    setSuccessMessage(null);
    router.backOr(routes.admin.crm);
  };

  let body: React.ReactNode;
  if (isEdit && isLoading) body = <SkeletonList count={4} />;
  else if (isEdit && isError) body = <ErrorState message={getErrorMessage(error, 'Failed to load lead')} onRetry={() => void refetchAll()} />;
  else if (isEdit && !lead) body = <ErrorState title="Lead not found" message="This lead no longer exists." />;
  else {
    body = (
      <Card>
        <LeadForm values={values} onChange={patch} errors={errors} allowCategoryDelete disabled={save.isPending} />
      </Card>
    );
  }

  const canSave = !(isEdit && !lead);
  return (
    <Screen
      title={isEdit ? 'Edit Lead' : 'Enter New Lead'}
      subtitle={session?.orgName}
      keyboardAware
      footer={canSave ? <Button title={isEdit ? 'Update Lead' : 'Save Lead'} icon={isEdit ? 'check' : 'check-circle'} fullWidth loading={save.isPending} onPress={() => void submit()} testID="crm-lead-save" /> : undefined}
      maxWidth={720}
      testID="enter-lead"
    >
      {body}
      <SuccessPopup visible={successMessage !== null} message={successMessage ?? ''} durationMs={1000} onDismiss={finish} />
    </Screen>
  );
}
