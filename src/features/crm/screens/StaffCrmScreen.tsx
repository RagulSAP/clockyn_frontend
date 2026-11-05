import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen, ResponsiveRow } from '@/components/layout';
import { Button, EmptyState, ErrorState, FilterChips, SkeletonList } from '@/components/ui';
import { useOrgPlan, useRefreshOnFocus } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { useUserId } from '@/store/auth';
import { spacing } from '@/theme';

import { PlanBlockedCard } from '../components/PlanBlockedCard';
import { SuccessPopup } from '../components/SuccessPopup';
import { AddLeadSheet } from '../components/staff/AddLeadSheet';
import { CfrModal } from '../components/staff/CfrModal';
import { EmpLeadCard } from '../components/staff/EmpLeadCard';
import { WorkStatusSheet } from '../components/staff/WorkStatusSheet';
import { useEmployeeLeads, useRequestCarryForward, useUpdateWorkStatus } from '../hooks/useEmployeeLeads';
import { usePullRefresh } from '../hooks/usePullRefresh';
import { markCrmSeen } from '../seenLeads';
import type { EmployeeStatusFilter, LeadWorkStatus } from '../types';
import { filterEmployeeLeads, type EmployeeLead } from '../utils/employeeLeads';
import { resolveStatusChange } from '../utils/workStatus';

const CHIPS: { label: string; value: EmployeeStatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Working', value: 'working' },
  { label: 'Completed', value: 'completed' },
];

/** `/staff/crm` - My Leads (managers and staff): work status, carry-forward requests and Add Lead. */
export default function StaffCrmScreen() {
  const userId = useUserId();
  const plan = useOrgPlan();
  const blocked = plan.isBlocked('crm');
  // The plan is checked first: no lead fetch while it loads or when it blocks CRM (v1).
  const checking = plan.isLoading;
  const { leads, rows, isLoading, isError, error, refetchAll } = useEmployeeLeads(!blocked && !checking);
  const { refreshing, onRefresh } = usePullRefresh(refetchAll);
  const updateStatus = useUpdateWorkStatus();
  const requestCf = useRequestCarryForward();

  const [filter, setFilter] = useState<EmployeeStatusFilter>('all');
  const [statusTarget, setStatusTarget] = useState<EmployeeLead | null>(null);
  const [cfTarget, setCfTarget] = useState<EmployeeLead | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useRefreshOnFocus(refetchAll);

  // Opening My Leads marks every fetched lead as seen (overwrite) and clears the CRM tab badge.
  const idsKey = useMemo(() => rows.map((r) => r.id).join('|'), [rows]);
  const loaded = !isLoading && !isError && !blocked && !checking;
  useEffect(() => {
    if (!loaded) return;
    void markCrmSeen(userId, idsKey === '' ? [] : idsKey.split('|')).catch(() => undefined);
  }, [loaded, idsKey, userId]);

  const visible = useMemo(() => filterEmployeeLeads(leads, filter), [leads, filter]);
  const updatingId = updateStatus.isPending ? (updateStatus.variables?.leadId ?? null) : null;

  const pickStatus = (status: LeadWorkStatus) => {
    const lead = statusTarget;
    setStatusTarget(null);
    if (!lead) return;
    const change = resolveStatusChange(lead.workStatus, status);
    if (change.kind === 'carry_forward') setCfTarget(lead);
    else if (change.kind === 'update') updateStatus.mutate({ leadId: lead.id, status: change.status });
  };

  const sendRequest = async (reason: string, forwardDate: string) => {
    if (!cfTarget) return;
    try {
      await requestCf.mutateAsync({
        leadId: cfTarget.id,
        description: reason,
        forwardDate,
      });
      setCfTarget(null);
      setRequestSent(true);
    } catch {
      // the mutation toasted the server message (e.g. a pending request already exists); the dialog stays open
    }
  };

  let body: React.ReactNode;
  if (checking) {
    body = <SkeletonList count={4} />;
  } else if (blocked) {
    body = <PlanBlockedCard message={plan.panelMessage} />;
  } else if (isLoading) {
    body = <SkeletonList count={4} />;
  } else if (isError) {
    body = <ErrorState message={getErrorMessage(error, 'Failed to load leads')} onRetry={() => void refetchAll()} />;
  } else if (leads.length === 0) {
    body = (
      <EmptyState icon="users" title="No Leads Assigned" message={"Admin hasn't assigned any leads to you yet.\nPull down to refresh."} />
    );
  } else if (visible.length === 0) {
    body = <EmptyState icon="calendar" title="No Leads Found" message="No leads match the selected status." />;
  } else {
    body = (
      <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
        {visible.map((lead) => (
          <EmpLeadCard key={lead.id} lead={lead} updating={updatingId === lead.id} onOpenStatus={setStatusTarget} />
        ))}
      </ResponsiveRow>
    );
  }

  return (
    <Screen
      title="My Leads"
      subtitle="Assigned to you"
      hideBack
      edges={['top']}
      refreshing={refreshing}
      onRefresh={onRefresh}
      right={<Button title="Add Lead" icon="plus" size="sm" onPress={() => setAddOpen(true)} testID="crm-add-lead" />}
      contentStyle={{ gap: spacing.lg }}
      testID="staff-crm"
    >
      <View>
        <FilterChips<EmployeeStatusFilter> options={CHIPS} value={filter} onChange={setFilter} />
      </View>
      {body}
      <WorkStatusSheet
        visible={statusTarget !== null}
        leadName={statusTarget?.clientName ?? ''}
        current={statusTarget?.displayStatus ?? 'pending'}
        onPick={pickStatus}
        onClose={() => setStatusTarget(null)}
      />
      <CfrModal
        leadName={cfTarget?.clientName ?? null}
        sending={requestCf.isPending}
        onSubmit={(r, d) => void sendRequest(r, d)}
        onClose={() => setCfTarget(null)}
      />
      <AddLeadSheet visible={addOpen} onClose={() => setAddOpen(false)} />
      <SuccessPopup
        visible={requestSent}
        message="Request Sent!"
        detail="Carry forward request sent to admin successfully."
        durationMs={2500}
        onDismiss={() => setRequestSent(false)}
      />
    </Screen>
  );
}
