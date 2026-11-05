import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/layout';
import { Badge, Card, DateField, EmptyState, ErrorState, Reveal, SkeletonList, Text, useToast } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, todayIST, weekdayOf, WEEKDAY_NAMES } from '@/lib/datetime';
import { useAppRouter } from '@/lib/navigation';
import { useOrgId, useSession } from '@/store/auth';
import { spacing } from '@/theme';
import type { StaffMember } from '@/types/api/staff';

import { StaffAttendanceRow } from '../components/overview/StaffAttendanceRow';
import { StaffDayDetail } from '../components/overview/StaffDayDetail';
import { StatusTiles } from '../components/overview/StatusTiles';
import { useBranches, useDashboardStats } from '../hooks/useDashboardQueries';
import { useOverviewList, useStaffDay } from '../hooks/useOverviewData';
import { clampToToday } from '../utils/dashboardLogic';
import { parseOverviewFilter, punchColumn, tileLabel, type OverviewFilter } from '../utils/overviewLogic';

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

function DetailPane({ orgId, staff, date }: { orgId: string; staff: StaffMember; date: string }) {
  const day = useStaffDay(orgId, staff.userId, date, staff.photoUrl);
  return <StaffDayDetail staff={staff} date={date} day={day} />;
}

/**
 * Overview: attendance drill-down by status for one past/present date (and optional branch), with the punch
 * times of every listed person and a per-person day detail (sessions, photos, total hours).
 * Params: `date` (`YYYY-MM-DD`, default today IST), `branchId` (default all), `filter` (default total).
 */
export default function OverviewScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const orgId = useOrgId();
  const session = useSession();
  const { isDesktop } = useBreakpoint();
  const params = useLocalSearchParams<{ date?: string; branchId?: string; filter?: string }>();
  const today = todayIST();

  const [date, setDateState] = useState(() => clampToToday(first(params.date), todayIST()));
  const [filter, setFilter] = useState<OverviewFilter>(() => parseOverviewFilter(params.filter));
  const [selected, setSelected] = useState<StaffMember | null>(null);
  // The branch filter of the dashboard is honoured (v1 dropped it); an unknown id falls back to all branches.
  const branches = useBranches(orgId);
  const requestedBranch = first(params.branchId) ?? '';
  const branchId = requestedBranch !== '' && branches.data && !branches.data.some((b) => b.id === requestedBranch) ? '' : requestedBranch;
  const branchName = branchId ? branches.data?.find((b) => b.id === branchId)?.name : undefined;

  const stats = useDashboardStats(orgId, date, branchId);
  const list = useOverviewList(orgId, date, branchId, filter);

  useEffect(() => {
    if (list.error) toast.error(getErrorMessage(list.error, 'Failed to load staff'));
  }, [list.error, toast]);

  const setDate = useCallback((d: string) => {
    setDateState(clampToToday(d, todayIST()));
    setSelected(null);
  }, []);

  // Phones / tablets show the detail instead of the list; back closes the detail first.
  const detailReplacesList = selected !== null && !isDesktop;
  const onBack = useCallback(() => {
    if (detailReplacesList) setSelected(null);
    else router.back();
  }, [detailReplacesList, router]);

  useEffect(() => {
    if (!detailReplacesList) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelected(null);
      return true;
    });
    return () => sub.remove();
  }, [detailReplacesList]);

  const label = tileLabel(filter);
  const dayName = WEEKDAY_NAMES[weekdayOf(date)] ?? '';

  const banner = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignItems: 'flex-end' }}>
      <Card variant="gradient" style={{ flexGrow: 1, flexBasis: 220 }} testID="date-banner">
        <Text variant="micro" color="onGradient" style={{ opacity: 0.85 }}>
          {dayName.toUpperCase()}
        </Text>
        <Text variant="title1" color="onGradient" testID="date-banner-text">
          {formatDate(date)}
        </Text>
        {branchName ? (
          <Text variant="caption" color="onGradient" style={{ opacity: 0.85, marginTop: spacing.xs }}>
            {branchName}
          </Text>
        ) : null}
      </Card>
      <View style={{ flexGrow: 1, flexBasis: 200 }}>
        <DateField label="Change Date" value={date} maxDate={today} onChange={setDate} testID="overview-date" />
      </View>
    </View>
  );

  const listSection = (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title3" accessibilityRole="header">
          {label}
        </Text>
        <Badge label={`${list.loading ? '...' : list.rows.length} Staff`} tone="primary" testID="staff-count" />
      </View>
      {list.loading ? (
        <View testID="list-loading">
          <SkeletonList count={5} />
          <Text variant="callout" color="textMuted" align="center" style={{ marginTop: spacing.md }}>
            Loading staff...
          </Text>
        </View>
      ) : list.error && list.rows.length === 0 ? (
        <ErrorState compact message={getErrorMessage(list.error, 'Failed to load staff')} onRetry={list.refetch} />
      ) : list.rows.length === 0 ? (
        <EmptyState compact icon="search" title="No Staff Found" message={`No staff in "${label}" for this date`} />
      ) : (
        <Card padding={0}>
          {list.rows.map((staff, i) => (
            <StaffAttendanceRow
              key={`${staff.userId}-${i}`}
              staff={staff}
              punch={punchColumn(filter, staff.userId, list.maps)}
              divider={i < list.rows.length - 1}
              onPress={setSelected}
            />
          ))}
        </Card>
      )}
    </View>
  );

  const listPane = (
    <View style={{ gap: spacing.xl }}>
      <Reveal index={0}>{banner}</Reveal>
      <Reveal index={1}>
        <StatusTiles stats={stats.data} active={filter} onSelect={setFilter} />
      </Reveal>
      <Reveal index={2}>{listSection}</Reveal>
    </View>
  );

  return (
    <Screen
      title={detailReplacesList ? 'Staff Details' : 'Staff Overview'}
      subtitle={session?.orgName || undefined}
      onBack={onBack}
      testID="admin-overview"
    >
      {isDesktop ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>{listPane}</View>
          <View style={{ flex: 1 }}>
            {selected ? (
              <DetailPane orgId={orgId} staff={selected} date={date} />
            ) : (
              <EmptyState compact icon="user" title="Select a staff member" message="Open anyone from the list to see their punch times and photos for this date." />
            )}
          </View>
        </View>
      ) : detailReplacesList && selected ? (
        <DetailPane orgId={orgId} staff={selected} date={date} />
      ) : (
        listPane
      )}
    </Screen>
  );
}
