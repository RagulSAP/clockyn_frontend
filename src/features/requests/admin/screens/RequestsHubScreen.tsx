import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { authApi } from '@/api';
import { ActionCard, Avatar, Reveal, Text, type IconName } from '@/components/ui';
import { Screen } from '@/components/layout';
import { usePolling } from '@/hooks';
import { routes, useAppRouter, type AppRoute } from '@/lib/navigation';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useSession } from '@/store/auth';
import { spacing, useTheme } from '@/theme';
import type { RequestType } from '@/types/api/requests';

import { REQUESTS_POLL_MS, useAdminRequestsQuery } from '../hooks/useAdminRequests';
import { useRequestBadges } from '../hooks/useRequestBadges';
import { useScreenFocused } from '../hooks/useScreenFocused';

type Row = { type: RequestType; label: string; icon: IconName; route: AppRoute };

const ROWS: Row[] = [
  { type: 'leave', label: 'Leave Request', icon: 'plane', route: routes.admin.requests.leave },
  { type: 'permission', label: 'Permission Request', icon: 'clock', route: routes.admin.requests.permission },
  { type: 'shift_change', label: 'Shift Change Request', icon: 'refresh', route: routes.admin.requests.shiftChange },
  { type: 'device_change', label: 'Device Change Request', icon: 'smartphone', route: routes.admin.requests.deviceChange },
];

/** Visible height of a card header in the stack, and how far the next card covers the one above (see QuickActions). */
const STRIP = 72;
const COVER = 24;
const LAST_CARD_HEIGHT = 148;

/** Meaning colour of the glow per request type. */
const ACCENTS = (c: ReturnType<typeof useTheme>['colors']): Record<RequestType, string> => ({
  leave: c.statusLeave,
  permission: c.info,
  shift_change: c.warning,
  device_change: c.statusHoliday,
});

export default function RequestsHubScreen() {
  const { colors } = useTheme();
  const session = useSession();
  const orgId = useOrgId();
  const router = useAppRouter();
  const focused = useScreenFocused();
  const badges = useRequestBadges();
  const inbox = useAdminRequestsQuery();
  const [refreshing, setRefreshing] = useState(false);

  // Live badges while the hub is open (10 s); stops when another screen is on top.
  const refetchInbox = inbox.refetch;
  usePolling(async () => {
    await refetchInbox();
  }, REQUESTS_POLL_MS, { enabled: focused });

  const logo = useQuery({
    queryKey: queryKeys.company.logo(orgId),
    queryFn: () => authApi.getOrgLogoUrl(orgId),
    enabled: orgId !== '',
    staleTime: 10 * 60_000,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchInbox();
    } finally {
      setRefreshing(false);
    }
  };

  const orgName = session?.orgName ?? '';
  return (
    <Screen
      title={orgName || 'Requests'}
      subtitle="Manage Staff Requests"
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      right={<Avatar uri={logo.data ?? undefined} name={orgName || 'Clockyn'} size={36} />}
      testID="requests-hub"
    >
      <View style={{ gap: spacing.md }}>
        <Reveal index={0}>
          <Text variant="micro" color="textMuted">
            REQUESTS
          </Text>
        </Reveal>
        <Reveal index={1}>
          <View>
            {ROWS.map((row, i) => (
              // stacked like Quick Actions: later cards sit on top of earlier ones, the last one is shown in full
              <View key={row.type} style={{ marginTop: i === 0 ? 0 : -COVER }}>
                <ActionCard
                  testID={`requests-hub-${row.type}`}
                  icon={row.icon}
                  title={row.label}
                  blurb={badges.pending[row.type] > 0 ? `${badges.pending[row.type]} pending` : 'Nothing pending'}
                  accent={ACCENTS(colors)[row.type]}
                  badge={badges.unread[row.type]}
                  compact={i !== ROWS.length - 1}
                  height={i === ROWS.length - 1 ? LAST_CARD_HEIGHT : STRIP + COVER}
                  onPress={() => router.push(row.route)}
                />
              </View>
            ))}
          </View>
        </Reveal>
      </View>
    </Screen>
  );
}
