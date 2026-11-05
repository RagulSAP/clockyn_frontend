import React, { useState } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { spacing } from '@/theme';
import { Badge, Button, EmptyState, ErrorState, SectionHeader, SkeletonList, useToast } from '@/components/ui';
import { ResponsiveRow, Screen } from '@/components/layout';
import { useAsyncAction } from '@/hooks';
import { deletePayslipTemplate } from '@/api/payroll';
import { formatINR } from '@/lib/format';
import { routes, useAppRouter } from '@/lib/navigation';
import { queryKeys } from '@/lib/query/queryKeys';
import { PayslipAssignModal } from '../components/PayslipAssignModal';
import { TemplateCard } from '../components/TemplateCard';
import { usePayslipTemplates } from '../hooks/usePayslipTemplates';

/** Salary Payslips: monthly-fixed payslip templates with net salary, assigned-staff count, edit / assign / delete. */
export default function PayslipListScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { orgId, query, templates, deletableId } = usePayslipTemplates();

  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const assignTemplate = templates.find((t) => t.id === assignId) ?? null;

  const deleteAction = useAsyncAction(
    async (id: string) => {
      await deletePayslipTemplate(id);
    },
    {
      errorMessage: 'Failed to delete template',
      onSuccess: () => {
        toast.success('Deleted Successfully!');
        setConfirmId(null);
        setMenuId(null);
        void queryClient.invalidateQueries({ queryKey: queryKeys.payroll.all(orgId) });
      },
    },
  );

  return (
    <Screen
      title="Salary Payslips"
      large
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      right={
        <Button title="Add" icon="plus" size="sm" onPress={() => router.push(routes.admin.payroll.payslipEdit)} testID="payslip-add" />
      }
      testID="payroll-payslips"
    >
      <SectionHeader title="All Payslips" />

      {query.isLoading ? <SkeletonList count={3} /> : null}
      {!query.isLoading && query.isError ? <ErrorState message="Failed to load templates" onRetry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && templates.length === 0 ? (
        <EmptyState
          icon="file-text"
          title="No payslips yet"
          message="Create a payslip template and assign it to your staff."
          action={{ label: 'Add', onPress: () => router.push(routes.admin.payroll.payslipEdit), icon: 'plus' }}
        />
      ) : null}

      {templates.length > 0 ? (
        <View style={{ marginTop: spacing.sm }}>
          <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                testID={`payslip-${t.id}`}
                icon="file-text"
                title={t.name}
                badges={t.netSalary ? <Badge label={formatINR(t.netSalary)} tone="success" /> : null}
                assignedCount={t.assignedCount}
                menuOpen={menuId === t.id}
                confirmingDelete={confirmId === t.id}
                deleting={deleteAction.loading && confirmId === t.id}
                canDelete={deletableId === t.id}
                deleteConfirmText="Delete this template?"
                onToggleMenu={() => {
                  setConfirmId(null);
                  setMenuId((current) => (current === t.id ? null : t.id));
                }}
                onEdit={() => {
                  setMenuId(null);
                  router.push(routes.admin.payroll.payslipEdit, { templateId: t.id });
                }}
                onAssign={() => {
                  setMenuId(null);
                  setAssignId(t.id);
                }}
                onAskDelete={() => setConfirmId(t.id)}
                onCancelDelete={() => setConfirmId(null)}
                onConfirmDelete={() => void deleteAction.run(t.id)}
              />
            ))}
          </ResponsiveRow>
        </View>
      ) : null}

      <PayslipAssignModal visible={assignTemplate !== null} onClose={() => setAssignId(null)} orgId={orgId} template={assignTemplate} />
    </Screen>
  );
}
