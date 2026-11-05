import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import * as companyApi from '@/api/company';
import { ResponsiveRow, Screen } from '@/components/layout';
import { Avatar, Badge, Button, Card, Divider, EmptyState, ErrorState, IconButton, LoadingOverlay, Reveal, SectionHeader, SkeletonList, StatCard, Text, useConfirm, useToast } from '@/components/ui';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getErrorMessage } from '@/lib/api/errors';
import { routes, useAppRouter } from '@/lib/navigation';
import { queryKeys } from '@/lib/query/queryKeys';
import { resetQueryCache } from '@/lib/query/queryClient';
import { patchSession, useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { InfoRow } from '../components/InfoRow';
import { useCompanyBranches, useCompanyDepartments, useCompanyDetails, useCompanyList } from '../hooks/useCompanyQueries';
import { MSG_NO_SESSION, canDeleteCompany, nextActiveCompany } from '../utils/companyForm';

/** Read-only company profile with Edit and (when the admin owns several companies) Delete (route `/admin/company`). */
export default function CompanyViewScreen() {
  const params = useLocalSearchParams<{ orgId?: string }>();
  const session = useSession();
  const router = useAppRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { isDesktop } = useBreakpoint();

  const orgId = typeof params.orgId === 'string' && params.orgId !== '' ? params.orgId : (session?.orgId ?? '');
  const userId = session?.userId ?? '';

  // After a successful delete the screen stops querying the removed company.
  const [leaving, setLeaving] = useState(false);
  const details = useCompanyDetails(orgId, !leaving);
  const companies = useCompanyList(userId, !leaving);
  const branches = useCompanyBranches(orgId, !leaving);
  const departments = useCompanyDepartments(orgId, !leaving);

  const company = details.data;
  const canDelete = canDeleteCompany(companies.data?.length ?? 0);
  const branchCount = branches.data?.length ?? 0;
  const deptCount = departments.data?.length ?? 0;

  const del = useAsyncAction(
    async () => {
      if (!userId || !orgId) throw new Error(MSG_NO_SESSION);
      const result = await companyApi.deleteCompany(orgId, userId);
      const next = nextActiveCompany(result.remaining, orgId, session?.orgId ?? '');
      setLeaving(true);
      if (next) {
        patchSession({ orgId: next.orgId, orgName: next.name });
        await resetQueryCache();
      } else {
        queryClient.removeQueries({ predicate: (q) => q.queryKey[1] === orgId });
        void queryClient.invalidateQueries({ queryKey: queryKeys.company.list(userId) });
      }
      router.replace(routes.admin.home);
      return result;
    },
    { successMessage: (r) => r.message, errorMessage: 'Failed to delete' },
  );

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Delete Company',
      message: 'Are you sure you want to delete this company? This action cannot be undone.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) await del.run();
  };

  const onEdit = () => {
    if (!company) {
      toast.info('Company details are not loaded yet');
      return;
    }
    router.push(routes.admin.company.edit, { orgId });
  };

  const hasLegal = !!(company?.gstNumber || company?.pan || company?.cin || company?.tan || company?.msme);

  const hero = company ? (
    <Card testID="company-hero">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Avatar uri={company.logoUrl} name={company.name} size={72} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="title2" numberOfLines={2}>
            {company.name}
          </Text>
          {company.businessCategory ? <Badge label={company.businessCategory} tone="primary" /> : null}
        </View>
      </View>
    </Card>
  ) : null;

  const contact = company ? (
    <Card testID="company-contact">
      <SectionHeader title="Contact Information" />
      <InfoRow icon="phone" label="Mobile" value={company.mobile ?? ''} />
      <Divider />
      <InfoRow icon="mail" label="Email" value={company.email ?? ''} />
      {company.website ? (
        <>
          <Divider />
          <InfoRow icon="globe" label="Website" value={company.website} />
        </>
      ) : null}
      {company.address ? (
        <>
          <Divider />
          <InfoRow icon="map-pin" label="Address" value={company.address} />
        </>
      ) : null}
      {company.state ? (
        <>
          <Divider />
          <InfoRow icon="map" label="State" value={company.state} />
        </>
      ) : null}
      {company.district ? (
        <>
          <Divider />
          <InfoRow icon="map-pin" label="District" value={company.district} />
        </>
      ) : null}
      {company.pincode ? (
        <>
          <Divider />
          <InfoRow icon="hash" label="Pincode" value={String(company.pincode)} />
        </>
      ) : null}
    </Card>
  ) : null;

  const legalRows: { label: string; value: string | undefined }[] = [
    { label: 'GST', value: company?.gstNumber },
    { label: 'PAN', value: company?.pan },
    { label: 'CIN', value: company?.cin },
    { label: 'TAN', value: company?.tan },
    { label: 'MSME', value: company?.msme },
  ];
  const legal =
    company && hasLegal ? (
      <Card testID="company-legal">
        <SectionHeader title="Legal & Compliance" />
        {legalRows
          .filter((r) => !!r.value)
          .map((r, i) => (
            <React.Fragment key={r.label}>
              {i > 0 ? <Divider /> : null}
              <InfoRow icon="file-text" label={r.label} value={r.value as string} />
            </React.Fragment>
          ))}
      </Card>
    ) : null;

  const structure =
    company && (branchCount > 0 || deptCount > 0) ? (
      <View style={{ gap: spacing.md }} testID="company-structure">
        <SectionHeader title="Structure" />
        <ResponsiveRow columns={2} gap={spacing.md}>
          <StatCard label="Branches" value={branchCount} icon="building" tone="primary" />
          <StatCard label="Departments" value={deptCount} icon="layers" tone="primary" />
        </ResponsiveRow>
      </View>
    ) : null;

  const actions = company ? (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Button title="Edit Company" icon="edit" onPress={onEdit} style={{ flex: 1 }} testID="company-edit" />
      {canDelete ? <Button title="Delete" icon="trash" variant="danger" onPress={() => void onDelete()} testID="company-delete" /> : null}
    </View>
  ) : null;

  return (
    <Screen
      title="View Company"
      subtitle={company?.name || session?.orgName || undefined}
      refreshing={details.isRefetching && !details.isLoading}
      onRefresh={() => {
        void details.refetch();
        void companies.refetch();
        void branches.refetch();
        void departments.refetch();
      }}
      right={company ? <IconButton icon="edit" variant="tonal" accessibilityLabel="Edit company" onPress={onEdit} testID="company-edit-icon" /> : undefined}
      testID="company-view-screen"
    >
      {details.isLoading ? (
        <SkeletonList count={4} />
      ) : details.isError ? (
        <ErrorState message={getErrorMessage(details.error, 'Failed to load company')} onRetry={() => void details.refetch()} />
      ) : !company ? (
        <EmptyState icon="building" title="No company details found" />
      ) : (
        isDesktop ? (
          <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: spacing.lg }}>
              <Reveal index={0}>{hero}</Reveal>
              <Reveal index={2}>{structure}</Reveal>
              <Reveal index={3}>{actions}</Reveal>
            </View>
            <View style={{ flex: 1, gap: spacing.lg }}>
              <Reveal index={1}>{contact}</Reveal>
              <Reveal index={2}>{legal}</Reveal>
            </View>
          </View>
        ) : (
          <View style={{ gap: spacing.lg }}>
            <Reveal index={0}>{hero}</Reveal>
            <Reveal index={1}>{contact}</Reveal>
            <Reveal index={2}>{legal}</Reveal>
            <Reveal index={3}>{structure}</Reveal>
            <Reveal index={4}>{actions}</Reveal>
          </View>
        )
      )}
      <LoadingOverlay visible={del.loading} message="Deleting Company..." />
    </Screen>
  );
}
