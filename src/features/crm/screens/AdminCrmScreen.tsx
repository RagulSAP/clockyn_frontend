import React, { useState } from 'react';
import { View } from 'react-native';

import { Screen, ResponsiveRow, useBreakpoint } from '@/components/layout';
import { Card, ErrorState, Icon, Reveal, SkeletonList, Tabs, Text, type IconName } from '@/components/ui';
import { routes } from '@/config/routes';
import { useOrgPlan } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { todayIST } from '@/lib/datetime';
import { useAppRouter } from '@/lib/navigation';
import { useSession } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';

import { CfrSection } from '../components/hub/CfrSection';
import { LeadDetailSheet } from '../components/hub/LeadDetailSheet';
import { OverviewSection } from '../components/hub/OverviewSection';
import { PlanBlockedCard } from '../components/PlanBlockedCard';
import { useAdminLeads } from '../hooks/useAdminLeads';
import { usePullRefresh } from '../hooks/usePullRefresh';
import type { CrmLead } from '../types';
import { countForDay, leadsTodayLabel } from '../utils/leads';
import { pendingCfrCount } from '../utils/carryForward';

type HubTab = 'overview' | 'cf_requests';

function MenuCard({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} testID={testID} accessibilityLabel={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: radii.md,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} size={24} color="primary" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title3">{title}</Text>
          <Text variant="callout" color="textSecondary">
            {subtitle}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="textMuted" />
      </View>
    </Card>
  );
}

/** `/admin/crm` - CRM hub: menu cards, work-status overview, per-lead list and carry-forward inbox. */
export default function AdminCrmScreen() {
  const router = useAppRouter();
  const session = useSession();
  const plan = useOrgPlan();
  const { isDesktop } = useBreakpoint();
  const blocked = plan.isBlocked('crm');
  // The plan is checked FIRST (v1): nothing is fetched while the plan loads or when it blocks CRM, and a blocked
  // organisation sees only the lock card (no menu cards).
  const checking = plan.isLoading;
  const { leads, requests, isLoading, isError, error, refetchAll } = useAdminLeads(!blocked && !checking);
  const { refreshing, onRefresh } = usePullRefresh(refetchAll);
  const [tab, setTab] = useState<HubTab>('overview');
  const [detail, setDetail] = useState<CrmLead | null>(null);

  const todayCount = countForDay(leads, todayIST());
  const pending = pendingCfrCount(requests);
  const hasData = leads.length > 0 || requests.length > 0;

  const openAssign = (lead: CrmLead) => router.push(routes.admin.crmLeads.list, { leadId: lead.id });

  let body: React.ReactNode;
  if (checking) {
    body = <SkeletonList count={4} />;
  } else if (blocked) {
    body = <PlanBlockedCard message={plan.panelMessage} onAction={() => router.push(routes.admin.billing.overview)} />;
  } else if (isLoading) {
    body = <SkeletonList count={4} />;
  } else if (isError) {
    body = <ErrorState message={getErrorMessage(error, 'Failed to load leads')} onRetry={() => void refetchAll()} />;
  } else if (!hasData) {
    body = null;
  } else if (isDesktop) {
    body = (
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.xxl,
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1 }}>
          <OverviewSection leads={leads} onOpenDetail={setDetail} onAssign={openAssign} />
        </View>
        <View style={{ flex: 1 }}>
          <CfrSection requests={requests} />
        </View>
      </View>
    );
  } else {
    body = (
      <View style={{ gap: spacing.lg }}>
        <Tabs
          tabs={[
            { key: 'overview', label: 'Work Status Overview' },
            {
              key: 'cf_requests',
              label: 'Carry Forward Requests',
              badge: pending > 0 ? pending : undefined,
            },
          ]}
          active={tab}
          onChange={(k) => setTab(k as HubTab)}
        />
        {tab === 'overview' ? (
          <OverviewSection leads={leads} onOpenDetail={setDetail} onAssign={openAssign} />
        ) : (
          <CfrSection requests={requests} />
        )}
      </View>
    );
  }

  return (
    <Screen
      title={session?.orgName || 'CRM'}
      subtitle="CRM & To-Do"
      hideBack
      edges={['top']}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentStyle={{ gap: spacing.xl }}
      testID="admin-crm"
    >
      {checking || blocked ? null : (
        <Reveal index={0}>
          <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
            <MenuCard
              icon="user-plus"
              title="Enter Leads"
              subtitle="Add new client leads"
              onPress={() => router.push(routes.admin.crmLeads.edit)}
              testID="crm-menu-enter"
            />
            <MenuCard
              icon="clipboard-list"
              title="View / Assign Leads"
              subtitle={leadsTodayLabel(todayCount)}
              onPress={() => router.push(routes.admin.crmLeads.list)}
              testID="crm-menu-assign"
            />
          </ResponsiveRow>
        </Reveal>
      )}
      {body ? <Reveal index={1}>{body}</Reveal> : null}
      <LeadDetailSheet lead={detail} onClose={() => setDetail(null)} />
    </Screen>
  );
}
