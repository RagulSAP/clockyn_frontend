import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';

import { ResponsiveRow, Screen, useBreakpoint } from '@/components/layout';
import { DateField, EmptyState, ErrorState, IconButton, LoadingOverlay, Reveal, Select, SegmentedControl, Spinner, StatCard, Text } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate, todayIST } from '@/lib/datetime';
import { routes, useAppRouter } from '@/lib/navigation';
import { getCurrentPosition } from '@/lib/platform/location';
import { ClockynMap, type MapMarkerSpec, type MapType } from '@/lib/platform/maps';
import { useSession } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';
import type { StaffLocation } from '@/types/api/location';

import { PlanLockedPanel, StaffPanel, ViewAllButton, type PanelKind } from '../components/LocationParts';
import { useStaffLocation } from '../hooks/useStaffLocation';
import { ALL_BRANCHES, computeStats, filterByBranch, fitViewport, freshnessOf, hasCoordinates, withCoordinates, type Viewport } from '../utils/freshness';

/** v1 default centre until positions (or the admin's own location) are known. */
const DEFAULT_VIEW: Viewport = { latitude: 13.0827, longitude: 80.2707, zoom: 10 };

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');

export default function StaffLocationScreen() {
  const { colors } = useTheme();
  const router = useAppRouter();
  const session = useSession();
  const { isDesktop, width } = useBreakpoint();

  const [date, setDate] = useState(() => todayIST());
  const [branch, setBranch] = useState(ALL_BRANCHES);
  const [mapType, setMapType] = useState<MapType>('standard');
  const [panel, setPanel] = useState<PanelKind | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const data = useStaffLocation(date, selectedId);
  const { live, history, branches } = data;

  const mapHeight = isDesktop ? 560 : 380;
  const mapWidth = isDesktop ? Math.round(width * 0.55) : width;

  // ── derived data (branch filter applies to markers, counters and every list) ──────────────
  const allStaff = live.data;
  const staffInBranch = useMemo(() => filterByBranch(allStaff ?? [], branch), [allStaff, branch]);
  const mapped = useMemo(() => withCoordinates(staffInBranch), [staffInBranch]);
  const stats = useMemo(() => computeStats(staffInBranch, data.now), [staffInBranch, data.now]);
  const selected = useMemo(() => staffInBranch.find((s) => s.userId === selectedId) ?? null, [staffInBranch, selectedId]);

  const branchOptions = useMemo(() => {
    const names = new Set<string>();
    (branches.data ?? []).forEach((b) => names.add(b.name));
    (allStaff ?? []).forEach((s) => s.branch && names.add(s.branch));
    return [{ label: 'ALL', value: ALL_BRANCHES }, ...[...names].sort().map((n) => ({ label: n, value: n }))];
  }, [branches.data, allStaff]);

  const route = useMemo(() => (selectedId ? (history.data ?? []) : []), [selectedId, history.data]);

  // ── viewport: derived from the current context (date / branch / selection / route) ───────────
  // It is (re)computed only when the context changes, never on a poll, so the admin can pan while positions refresh.
  const [vp, setVp] = useState<{ key: string; view: Viewport } | null>(null);
  const [home, setHome] = useState<Viewport | null>(null);
  const ctx = `${date}|${branch}|${selectedId ?? ''}|${route.length > 0 ? 'route' : ''}`;
  let target: Viewport | null = null;
  if (selected && hasCoordinates(selected)) {
    target =
      route.length > 0
        ? fitViewport([...route, { latitude: selected.latitude, longitude: selected.longitude }], mapWidth, mapHeight)
        : { latitude: selected.latitude, longitude: selected.longitude, zoom: 15 };
  } else if (!selectedId && mapped.length > 0) {
    target = fitViewport(mapped.filter(hasCoordinates), mapWidth, mapHeight);
  }
  if (target && (!vp || vp.key !== ctx)) setVp({ key: ctx, view: target });
  const view: Viewport = vp?.view ?? home ?? DEFAULT_VIEW;

  // The admin's own position is only a starting point while nothing else is known (cosmetic, failures ignored).
  useEffect(() => {
    let cancelled = false;
    getCurrentPosition()
      .then((p) => {
        if (!cancelled) setHome({ latitude: p.latitude, longitude: p.longitude, zoom: 13 });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSelection = () => {
    setSelectedId(null);
    setPanel(null);
  };
  const changeDate = (d: string) => {
    if (!d) return;
    setDate(d);
    clearSelection();
  };
  const changeBranch = (b: string) => {
    setBranch(b);
    clearSelection();
  };
  const zoomBy = (delta: number) => setVp({ key: ctx, view: { ...view, zoom: Math.min(19, Math.max(2, view.zoom + delta)) } });

  const select = (s: StaffLocation) => {
    setSelectedId(s.userId);
    setPanel((p) => (p === 'all' ? null : p));
  };

  // ── map content ──────────────────────────────────────────────────────────────────────────
  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = mapped.filter(hasCoordinates).map((s) => ({
      id: s.userId,
      latitude: s.latitude,
      longitude: s.longitude,
      title: s.name,
      description: `${s.empId} • ${s.branch}`,
      label: initials(s.name),
      color: freshnessOf(s, data.now) === 'fresh' ? colors.success : colors.danger,
    }));
    if (route.length > 0) {
      const first = route[0];
      const last = route[route.length - 1];
      const name = selected?.name;
      list.push({
        id: 'route-start',
        latitude: first.latitude,
        longitude: first.longitude,
        title: 'Start',
        description: name ? `${name} - Route Start` : 'Route Start',
        label: 'S',
        color: colors.success,
      });
      if (route.length > 1) {
        list.push({
          id: 'route-end',
          latitude: last.latitude,
          longitude: last.longitude,
          title: 'End',
          description: name ? `${name} - Route End` : 'Route End',
          label: 'E',
          color: colors.danger,
        });
      }
    }
    return list;
  }, [mapped, route, selected, data.now, colors.success, colors.danger]);
  const polylines = useMemo(() => (route.length > 1 ? [{ id: 'route', coords: route, color: colors.primary, width: 4 }] : []), [route, colors.primary]);

  const todayStr = todayIST();
  const noData = !live.isLoading && !!allStaff && mapped.length === 0 && date !== todayStr;

  // ── gates ────────────────────────────────────────────────────────────────────────────────
  const subtitle = session?.orgName || undefined;
  if (data.planChecking) {
    return (
      <Screen title="Staff Location" subtitle={subtitle} testID="staff-location">
        <View style={{ alignItems: 'center', padding: spacing.huge }}>
          <Spinner size="large" />
        </View>
      </Screen>
    );
  }
  if (data.blocked) {
    return (
      <Screen title="Staff Location" subtitle={subtitle} testID="staff-location">
        <PlanLockedPanel
          message={data.blockMessage}
          canBuy={data.plan.audience === 'admin'}
          onRenew={() => router.push(routes.admin.billing.overview)}
        />
      </Screen>
    );
  }

  const panelStaff = panel === 'recent' ? stats.recent : panel === 'outdated' ? stats.outdated : staffInBranch;
  const panelNode = panel ? (
    <StaffPanel
      kind={panel}
      staff={panelStaff}
      now={data.now}
      selectedId={selectedId}
      onSelect={select}
      onClose={() => setPanel(null)}
      maxHeight={isDesktop ? 480 : 300}
    />
  ) : null;

  const mapNode = (
    <View style={{ borderRadius: radii.lg, overflow: 'hidden', height: mapHeight, backgroundColor: colors.surfaceMuted }} testID="location-map">
      <ClockynMap
        height={mapHeight}
        region={{ latitude: view.latitude, longitude: view.longitude, zoom: view.zoom }}
        markers={markers}
        polylines={polylines}
        mapType={mapType}
        showUserLocation
        onMarkerPress={(id) => {
          const s = staffInBranch.find((x) => x.userId === id);
          if (s) select(s);
        }}
      />
      <View style={{ position: 'absolute', top: spacing.sm, right: spacing.sm, gap: spacing.sm, alignItems: 'flex-end' }}>
        <View style={{ width: 190 }}>
          <SegmentedControl<MapType>
            size="sm"
            value={mapType}
            onChange={setMapType}
            options={[
              { label: 'Map', value: 'standard' },
              { label: 'Satellite', value: 'satellite' },
            ]}
          />
        </View>
        {Platform.OS !== 'web' ? (
          <View style={{ gap: spacing.xs }}>
            <IconButton icon="plus" variant="filled" accessibilityLabel="Zoom in" onPress={() => zoomBy(1)} />
            <IconButton icon="minus" variant="filled" accessibilityLabel="Zoom out" onPress={() => zoomBy(-1)} />
          </View>
        ) : null}
      </View>
      {noData ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.sm }}>
            <EmptyState compact icon="map-pin" title="No data available" message={`No staff location data for ${formatDate(date, 'dd/MM/yyyy')}`} />
          </View>
        </View>
      ) : null}
    </View>
  );

  const hasLoadError = live.isError && !live.data;

  return (
    <Screen
      title="Staff Location"
      subtitle={subtitle}
      refreshing={false}
      onRefresh={() => void live.refetch()}
      testID="staff-location"
      overlay={<LoadingOverlay visible={live.isLoading} message={`Loading data... ${formatDate(date, 'dd/MM/yyyy')}`} />}
    >
      <View style={{ gap: spacing.lg }}>
        <Reveal index={0}>
        <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
          <Select<string> label="Branch" value={branch} options={branchOptions} onChange={changeBranch} leftIcon="building" testID="location-branch" />
          <DateField label="Date" value={date} onChange={changeDate} maxDate={todayStr} testID="location-date" />
        </ResponsiveRow>
        </Reveal>

        <Reveal index={1}>
        <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
          <StatCard
            label="UPDATED WITHIN 15 MINS"
            value={stats.recent.length}
            icon="map-pin"
            tone="success"
            onPress={() => setPanel((p) => (p === 'recent' ? null : 'recent'))}
            testID="location-stat-recent"
          />
          <StatCard
            label="UPDATED BEFORE 15 MINS"
            value={stats.outdated.length}
            icon="clock"
            tone="danger"
            onPress={() => setPanel((p) => (p === 'outdated' ? null : 'outdated'))}
            testID="location-stat-outdated"
          />
        </ResponsiveRow>
        </Reveal>

        {hasLoadError ? (
          <ErrorState message={getErrorMessage(live.error, 'Failed to load staff locations')} onRetry={() => void live.refetch()} />
        ) : (
          <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.lg, alignItems: 'flex-start' }}>
            <View style={{ flex: isDesktop ? 3 : undefined, width: isDesktop ? undefined : '100%', gap: spacing.md }}>
              {mapNode}
              {data.today ? (
                <Text variant="caption" color="textMuted">
                  Live: positions refresh every 10 seconds.
                </Text>
              ) : null}
            </View>
            <View style={{ flex: isDesktop ? 2 : undefined, width: isDesktop ? undefined : '100%', gap: spacing.md }}>
              <ViewAllButton count={staffInBranch.length} onPress={() => setPanel('all')} />
              {panelNode}
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}
