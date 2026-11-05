import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { employeeApi } from '@/api';
import { Card, Divider, Reveal, Text } from '@/components/ui';
import { Screen } from '@/components/layout';
import { formatDate, todayIST } from '@/lib/datetime';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { routes, useAppRouter } from '@/lib/navigation';
import { queryKeys } from '@/lib/query/queryKeys';
import { spacing } from '@/theme';

import { HomeOverlays } from '../components/HomeOverlays';
import { HomeHeader, PunchButton, QuickActions, TimeCards, type QuickAction } from '../components/HomeParts';
import { RemainCard, ShiftCard, WorkHoursCard } from '../components/ShiftCards';
import { useEmployeeHome } from '../hooks/useEmployeeHome';
import { useFieldTracking } from '../hooks/useFieldTracking';
import { usePunchFlow } from '../hooks/usePunchFlow';
import { useRequestBadge } from '../hooks/useRequestBadge';
import { derivePunchState, punchButtonState, statusChip } from '../utils/punchState';

/** `Sun, Oct 18, 2026` */
const HOME_DATE_FORMAT = 'EEE, MMM d, yyyy';

/**
 * Staff / manager home: today's shift, live remaining time / overtime, worked hours and the face punch button
 * (see `usePunchFlow` for the ordered pre-checks), plus quick actions with the request badge.
 */
export default function EmployeeHomeScreen() {
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const { isWide } = useBreakpoint();
  const home = useEmployeeHome();
  const punch = usePunchFlow(home);
  const requestBadge = useRequestBadge();
  const [refreshing, setRefreshing] = React.useState(false);

  useFieldTracking({
    isFieldStaff: home.isFieldStaff,
    userId: home.userId,
    orgId: home.orgId,
    attendanceLoaded: home.attendanceLoaded,
    isPunchedIn: home.today.isPunchedIn,
  });

  // Warm the personal-details cache so the profile opens instantly (silent; the profile screen shows its own errors).
  const { userId } = home;
  useEffect(() => {
    if (!userId) return;
    void queryClient
      .prefetchQuery({ queryKey: queryKeys.staff.personal(userId), queryFn: () => employeeApi.getPersonalDetails(userId) })
      .catch(() => undefined);
  }, [userId, queryClient]);

  const { today } = home;
  const stateInput = useMemo(
    () => ({
      isFaceRegistered: home.isFaceRegistered,
      isPunchedIn: today.isPunchedIn,
      punchIn: today.punchIn,
      punchOut: today.punchOut,
      punchCount: today.punchCount,
    }),
    [home.isFaceRegistered, today.isPunchedIn, today.punchIn, today.punchOut, today.punchCount],
  );
  const { isDone } = derivePunchState(stateInput);
  const chip = statusChip(stateInput);
  const button = punchButtonState({ ...stateInput, isChecking: punch.checking });

  const actions: QuickAction[] = [
    { key: 'profile', title: 'Personal Details', subtitle: 'Profile', icon: 'user', onPress: () => router.push(routes.staff.profile) },
    { key: 'expenses', title: 'Expenses', subtitle: 'Claims', icon: 'receipt', onPress: () => router.push(routes.staff.expenses.hub) },
    { key: 'requests', title: 'Requests', subtitle: 'Leave & More', icon: 'clipboard-list', badge: requestBadge, onPress: () => router.push(routes.staff.requests.hub) },
    { key: 'attendance', title: 'Attendance', subtitle: 'Calendar', icon: 'calendar-days', onPress: () => router.push(routes.staff.attendance) },
  ];

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await home.refreshAll();
    } finally {
      setRefreshing(false);
    }
  };

  const shiftProps = { shiftStart: home.shift?.start, shiftEnd: home.shift?.end, sessions: today.sessions };

  const hero = (
    <Card style={{ gap: spacing.lg }} testID="punch-hero">
      <Text variant="caption" color="textMuted" testID="home-date">
        {formatDate(todayIST(), HOME_DATE_FORMAT)}
      </Text>
      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: spacing.xl, alignItems: isWide ? 'center' : 'stretch' }}>
        <View style={{ flex: 1, gap: spacing.lg }}>
          <RemainCard
            punchIn={today.punchIn}
            punchOut={today.punchOut}
            isDone={isDone}
            isPunchedIn={today.isPunchedIn}
            shiftStart={shiftProps.shiftStart}
            shiftEnd={shiftProps.shiftEnd}
            sessions={shiftProps.sessions}
          />
          <Divider />
          <ShiftCard name={home.shift?.name} start={home.shift?.start} end={home.shift?.end} />
        </View>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <Text variant="callout" color="textSecondary" testID="punch-state-label">
            {button.stateLabel}
          </Text>
          <PunchButton state={button} onPress={() => void punch.start()} />
        </View>
      </View>
    </Card>
  );

  const details = (
    <View style={{ gap: spacing.lg }}>
      <TimeCards punchIn={today.punchIn} punchOut={today.punchOut} />
      <WorkHoursCard
        punchIn={today.punchIn}
        punchOut={today.punchOut}
        isPunchedIn={today.isPunchedIn}
        shiftStart={shiftProps.shiftStart}
        shiftEnd={shiftProps.shiftEnd}
        sessions={shiftProps.sessions}
      />
    </View>
  );

  return (
    <Screen hideBack edges={['top']} refreshing={refreshing} onRefresh={onRefresh} testID="employee-home">
      <View style={{ gap: spacing.xl }}>
        <Reveal index={0}>
          <HomeHeader companyName={home.companyName} logoUrl={home.logoUrl} username={home.username} chip={chip} />
        </Reveal>
        {isWide ? (
          <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
            <Reveal index={1} style={{ flex: 1.1 }}>
              {hero}
            </Reveal>
            <Reveal index={2} style={{ flex: 1 }}>
              {details}
            </Reveal>
          </View>
        ) : (
          <>
            <Reveal index={1}>{hero}</Reveal>
            <Reveal index={2}>{details}</Reveal>
          </>
        )}
        <Reveal index={3}>
          <QuickActions actions={actions} />
        </Reveal>
      </View>
      <HomeOverlays home={home} punch={punch} />
    </Screen>
  );
}
