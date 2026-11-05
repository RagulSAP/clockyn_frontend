import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { authApi } from '@/api';
import { Screen, useBreakpoint } from '@/components/layout';
import { Avatar, EmptyState, ErrorState, ImageViewer, RefreshableList, SkeletonList } from '@/components/ui';
import { queryKeys } from '@/lib/query/queryKeys';
import { routes, useAppRouter } from '@/lib/navigation';
import { useOrgId, useSession } from '@/store/auth';
import { spacing } from '@/theme';
import type { StaffMember } from '@/types/api/staff';

import { RosterControls } from '../components/RosterControls';
import { StaffRosterRow } from '../components/StaffRosterRow';
import { useStaffRoster } from '../hooks/useStaffRoster';
import { useToggleStaffActive } from '../hooks/useToggleStaffActive';
import { bannerFor, chipCounts, emptyCopy, filterRoster, FILTER_TITLES, type RoleChip } from '../utils/rosterFilters';

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/**
 * Staff roster: searchable / filterable list with live attendance status. Route params (all optional):
 * `filter` (total | late | punched_in | working | punched_out | absent), `branchId`, `date` (IST), `deptId`.
 */
export default function StaffListScreen() {
  const params = useLocalSearchParams<{ filter?: string; branchId?: string; date?: string; deptId?: string }>();
  const router = useAppRouter();
  const session = useSession();
  const orgId = useOrgId();
  const { isDesktop, isTablet } = useBreakpoint();
  const columns = isDesktop ? 2 : 1;

  const roster = useStaffRoster({
    filter: first(params.filter),
    branchId: first(params.branchId),
    date: first(params.date),
    deptId: first(params.deptId),
  });
  const { toggle, pendingIds } = useToggleStaffActive();

  const [role, setRole] = useState<RoleChip>('all');
  const [search, setSearch] = useState('');
  const [photo, setPhoto] = useState<StaffMember | null>(null);

  const logo = useQuery({
    queryKey: queryKeys.company.logo(orgId),
    queryFn: () => authApi.getOrgLogoUrl(orgId),
    enabled: !!orgId,
    retry: false,
  });

  const counts = useMemo(() => chipCounts(roster.members), [roster.members]);
  const visible = useMemo(() => filterRoster(roster.members, { role, search }), [roster.members, role, search]);
  const banner = bannerFor(roster.filter, visible.length);

  const openDetail = useCallback((m: StaffMember) => router.push(routes.admin.staff.detail, { staffId: m.userId }), [router]);
  const onToggle = useCallback((m: StaffMember, active: boolean) => toggle(m.userId, active), [toggle]);
  const onPhoto = useCallback((m: StaffMember) => setPhoto(m), []);

  const header = (
    <RosterControls search={search} onSearchChange={setSearch} role={role} onRoleChange={setRole} counts={counts} banner={banner} />
  );

  let body: React.ReactNode;
  if (roster.scopeMissing) {
    body = <EmptyState icon="building" title="Organisation not available" message="Sign in again to load your staff." />;
  } else if (roster.isLoading) {
    body = (
      <View style={{ gap: spacing.md }}>
        {header}
        <SkeletonList count={6} />
      </View>
    );
  } else if (roster.isError && roster.members.length === 0) {
    body = <ErrorState message={roster.errorMessage} onRetry={() => void roster.refetch()} />;
  } else {
    const copy = emptyCopy(search);
    body = (
      <RefreshableList<StaffMember>
        key={`roster-${columns}`}
        data={visible}
        numColumns={columns}
        keyExtractor={(m) => m.userId}
        refreshing={roster.isRefetching}
        onRefresh={() => void roster.refetch()}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon={search.trim() ? 'search' : 'users'} title={copy.title} message={copy.message} />}
        columnWrapperStyle={columns > 1 ? { gap: spacing.md } : undefined}
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <View style={columns > 1 ? { flex: 1, maxWidth: `${100 / columns}%` } : undefined}>
            <StaffRosterRow
              member={item}
              filter={roster.filter}
              toggling={pendingIds.has(item.userId)}
              onOpen={openDetail}
              onToggleActive={onToggle}
              onPhotoPress={onPhoto}
            />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        testID="roster-list"
      />
    );
  }

  return (
    <Screen
      title={session?.orgName || 'Staff'}
      subtitle={FILTER_TITLES[roster.filter]}
      scroll={false}
      refreshing={roster.isRefetching}
      onRefresh={() => void roster.refetch()}
      right={<Avatar uri={logo.data} name={session?.orgName || 'Clockyn'} size={isTablet || isDesktop ? 40 : 36} />}
      testID="staff-list-screen"
    >
      {body}
      <ImageViewer uri={photo?.photoUrl} visible={!!photo} onClose={() => setPhoto(null)} caption={photo?.name} />
    </Screen>
  );
}
