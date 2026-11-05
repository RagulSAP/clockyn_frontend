import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen, ResponsiveRow } from '@/components/layout';
import { EmptyState, ErrorState, LoadingOverlay, SkeletonList, useConfirm, useToast } from '@/components/ui';
import type { StaffPickerItem } from '@/api/staff';
import { routes } from '@/config/routes';
import { getErrorMessage } from '@/lib/api/errors';
import { useAppRouter } from '@/lib/navigation';
import { useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { AssignView } from '../components/assign/AssignView';
import { LeadCard } from '../components/assign/LeadCard';
import { DateChipBar } from '../components/DateChipBar';
import { DatePickerModal } from '../components/DatePickerModal';
import { SuccessPopup } from '../components/SuccessPopup';
import { useAdminLeads } from '../hooks/useAdminLeads';
import { useAssignOptions } from '../hooks/useAssignOptions';
import { useAssignLead, useDeleteLead } from '../hooks/useLeadWrites';
import { usePullRefresh } from '../hooks/usePullRefresh';
import type { CrmLead, DateFilterKey } from '../types';
import { assignViewTitle } from '../utils/carryForward';
import { resolveFilterDate } from '../utils/dates';
import { filterByDate, sortCompletedLast, uniqueByUserId } from '../utils/leads';
import { isLeadLocked } from '../utils/workStatus';

/** `/admin/crm/leads` - View / Assign Leads (also reached by managers with the Leads Management permission). */
export default function AssignLeadsScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const session = useSession();
  const params = useLocalSearchParams<{ leadId?: string }>();
  const { leads, isLoading, isError, error, refetchAll } = useAdminLeads();
  const { refreshing, onRefresh } = usePullRefresh(refetchAll);
  const deleteLead = useDeleteLead();
  const assignLead = useAssignLead();
  const assigning = useRef(false);

  const [dateFilter, setDateFilter] = useState<DateFilterKey>('today');
  const [customDate, setCustomDate] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [manual, setManual] = useState<{ param: string; id: string | null } | null>(null);
  const [branchId, setBranchId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // `leadId` param (the hub's Unassigned / Assign pill) opens that lead's assign view once the list is loaded; the
  // user's own navigation (open another lead / back to the list) takes over for that param value.
  const paramLeadId = typeof params.leadId === 'string' ? params.leadId : '';
  const paramLead = paramLeadId === '' ? null : (leads.find((l) => l.id === paramLeadId) ?? null);
  const manualActive = manual !== null && manual.param === paramLeadId;
  const selectedId = manualActive ? manual.id : paramLead && !isLeadLocked(paramLead) ? paramLead.id : null;
  const setSelectedId = useCallback((id: string | null) => setManual({ param: paramLeadId, id }), [paramLeadId]);
  const selected = useMemo(() => leads.find((l) => l.id === selectedId) ?? null, [leads, selectedId]);
  const options = useAssignOptions(selected !== null, branchId, deptId);

  const openAssign = useCallback(
    (lead: CrmLead) => {
      // Filters are reset every time the assign view opens (v1 kept the previous lead's choices).
      setBranchId('');
      setDeptId('');
      setSelectedId(lead.id);
    },
    [setSelectedId],
  );

  // Tell the user when the deep-linked lead cannot be opened (once per param value).
  const notified = useRef<string | null>(null);
  useEffect(() => {
    if (paramLeadId === '' || isLoading || notified.current === paramLeadId) return;
    if (leads.length === 0 && !isError) return;
    notified.current = paramLeadId;
    if (!paramLead) toast.info('Lead not found');
    else if (isLeadLocked(paramLead)) toast.info('Completed leads cannot be assigned');
  }, [paramLeadId, paramLead, isLoading, isError, leads.length, toast]);

  // Android hardware back leaves the assign view first (v1 left the screen).
  useEffect(() => {
    if (selectedId === null) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedId(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedId, setSelectedId]);

  const day = resolveFilterDate(dateFilter, customDate);
  const visible = useMemo(() => sortCompletedLast(filterByDate(leads, day)), [leads, day]);

  const employees = useMemo(
    () => uniqueByUserId(options.employees.data ?? [], selected?.assignedUserId),
    [options.employees.data, selected?.assignedUserId],
  );

  const handleDelete = async (lead: CrmLead) => {
    if (isLeadLocked(lead)) return;
    const ok = await confirm({ title: 'Delete Lead', message: 'Are you sure you want to delete this lead?', confirmText: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await deleteLead.mutateAsync(lead.id);
    } catch {
      // the mutation already toasted the server message
    }
  };

  const handleAssign = async (employee: StaffPickerItem) => {
    if (!selected || assigning.current) return; // a fast double tap fires twice before `isPending` re-renders
    assigning.current = true;
    const reassign = !!selected.assignedUserId;
    try {
      await assignLead.mutateAsync({
        leadId: selected.id,
        userId: employee.userId,
        branchId: employee.branchId || null,
        deptId: employee.deptId || null,
        reassign,
      });
      setSuccessMessage(reassign ? 'Lead Reassigned!' : 'Lead Assigned!');
    } catch {
      // toasted by the mutation; stay in the assign view
    } finally {
      assigning.current = false;
    }
  };

  const finishAssign = () => {
    setSuccessMessage(null);
    setSelectedId(null);
  };

  const employeesError = options.employees.isError ? getErrorMessage(options.employees.error, 'Failed to load employees') : null;
  const busy = deleteLead.isPending;

  let body: React.ReactNode;
  if (selected) {
    body = (
      <AssignView
        lead={selected}
        branches={(options.branches.data ?? []).map((b) => ({ id: b.id, name: b.name }))}
        departments={(options.departments.data ?? []).map((d) => ({ id: d.id, name: d.name }))}
        branchId={branchId}
        deptId={deptId}
        onBranchChange={setBranchId}
        onDeptChange={setDeptId}
        employees={employees}
        employeesLoading={options.employees.isLoading}
        employeesError={employeesError}
        onRetryEmployees={() => void options.employees.refetch()}
        assigning={assignLead.isPending}
        onAssign={(e) => void handleAssign(e)}
      />
    );
  } else {
    let list: React.ReactNode;
    if (isLoading) list = <SkeletonList count={4} />;
    else if (isError) list = <ErrorState message={getErrorMessage(error, 'Failed to load leads')} onRetry={() => void refetchAll()} />;
    else if (visible.length === 0) list = <EmptyState icon="calendar" title="No Leads" message="No leads found for this date" />;
    else {
      list = (
        <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
          {visible.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onEdit={(l) => !isLeadLocked(l) && router.push(routes.admin.crmLeads.edit, { leadId: l.id })}
              onDelete={(l) => void handleDelete(l)}
              onAssign={(l) => !isLeadLocked(l) && openAssign(l)}
            />
          ))}
        </ResponsiveRow>
      );
    }
    body = (
      <View style={{ gap: spacing.lg }}>
        <DateChipBar
          value={dateFilter}
          customDate={customDate}
          onChange={(v) => setDateFilter(v as DateFilterKey)}
          onPickDate={() => setCalendarOpen(true)}
          onClearCustom={() => {
            setCustomDate('');
            setDateFilter('today');
          }}
        />
        {list}
      </View>
    );
  }

  return (
    <Screen
      title={selected ? assignViewTitle(selected) : 'View & Assign Leads'}
      subtitle={session?.orgName}
      onBack={() => (selected ? setSelectedId(null) : router.backOr(routes.admin.crm))}
      refreshing={refreshing}
      onRefresh={selected ? undefined : onRefresh}
      testID="assign-leads"
    >
      {body}
      <DatePickerModal
        visible={calendarOpen}
        value={customDate}
        onClose={() => setCalendarOpen(false)}
        onSelect={(d) => {
          setCustomDate(d);
          setDateFilter('custom');
        }}
        onClear={() => {
          setCustomDate('');
          setDateFilter('today');
        }}
      />
      <SuccessPopup visible={successMessage !== null} message={successMessage ?? ''} durationMs={2000} onDismiss={finishAssign} />
      <LoadingOverlay visible={busy || assignLead.isPending} message={assignLead.isPending ? 'Assigning lead...' : 'Processing...'} />
    </Screen>
  );
}
