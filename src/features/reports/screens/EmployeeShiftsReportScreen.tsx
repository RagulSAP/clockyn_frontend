import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/layout';
import { Avatar, Badge, Card, EmptyState, ErrorState, Icon, SearchBar, SkeletonList, StatCard, Text, toneColors, type Tone } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { useSession } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';
import type { StaffMember } from '@/types/api/staff';
import { ReportBanner } from '../components/ReportBanner';
import { useShiftReport } from '../hooks/useReportQueries';
import { assignedCount, filterShiftStaff, shiftDuration, shiftTimeRange } from '../utils/shiftReport';

const SHIFT_TONES: Tone[] = ['primary', 'neutral'];

function StaffRow({ staff, tone }: { staff: StaffMember; tone: Tone }) {
  const { colors } = useTheme();
  const t = toneColors(tone, colors);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <Avatar uri={staff.photoUrl} name={staff.name} size={38} />
      <View style={{ flex: 1 }}>
        <Text variant="callout" weight="semibold" numberOfLines={1}>
          {staff.name}
        </Text>
        <Text variant="caption" style={{ color: t.fg }}>
          {staff.empId}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', maxWidth: '40%' }}>
        {staff.department ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {staff.department}
          </Text>
        ) : null}
        {staff.branch ? (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {staff.branch}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function GroupCard({
  title,
  subtitle,
  icon,
  tone,
  count,
  expanded,
  onToggle,
  children,
  testID,
}: {
  title: string;
  subtitle: string;
  icon: 'clock' | 'user-minus';
  tone: Tone;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testID: string;
}) {
  const { colors } = useTheme();
  const t = toneColors(tone, colors);
  return (
    <Card padding={0} testID={testID}>
      <Card variant="muted" padding={spacing.lg} onPress={onToggle} accessibilityLabel={`${title}, ${count} staff`} style={{ backgroundColor: 'transparent' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 42, height: 42, borderRadius: radii.md, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={20} color={t.fg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {title}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
          <Badge label={`${count} staff`} tone={tone} size="sm" />
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="textMuted" />
        </View>
      </Card>
      {expanded ? <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>{children}</View> : null}
    </Card>
  );
}

export default function EmployeeShiftsReportScreen() {
  const report = useShiftReport();
  const orgName = useSession()?.orgName;
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpanded((e) => ({ ...e, [key]: !e[key] }));
  const data = report.data;
  const assigned = useMemo(() => (data ? assignedCount(data) : 0), [data]);

  const emptyMessage = (searching: boolean, none: string) => (
    <Text color="textMuted" align="center" style={{ paddingVertical: spacing.md }}>
      {searching ? 'No matching staff' : none}
    </Text>
  );

  return (
    <Screen
      title="Employee Shift / Timing"
      subtitle={orgName || undefined}
      refreshing={report.isRefetching}
      onRefresh={() => void report.refetch()}
      testID="employee-shifts-report"
    >
      <View style={{ gap: spacing.lg }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, ID, dept, branch..." />
        {report.isLoading ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="callout" color="textSecondary" align="center">
              Loading shift data...
            </Text>
            <SkeletonList count={4} variant="card" />
          </View>
        ) : report.isError || !data ? (
          <ErrorState message={getErrorMessage(report.error, 'Failed to load shift data')} onRetry={() => void report.refetch()} />
        ) : (
          <>
            {data.unknownCount > 0 ? (
              <ReportBanner message={`Shift details could not be loaded for ${data.unknownCount} staff; they are listed under Unassigned.`} />
            ) : null}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatCard style={{ flex: 1 }} label="Total Shifts" value={data.shifts.length} icon="clock" tone="primary" />
              <StatCard style={{ flex: 1 }} label="Assigned" value={assigned} icon="user-check" tone="success" />
              <StatCard style={{ flex: 1 }} label="Unassigned" value={data.unassigned.length} icon="user-minus" tone="warning" />
            </View>
            {data.shifts.length === 0 ? (
              <EmptyState icon="clock" title="No shifts created yet" message="Go to Settings → Shift Settings to create shifts" />
            ) : (
              data.groups.map((g, idx) => {
                const key = String(g.shift.id);
                const visible = filterShiftStaff(g.staff, search);
                const duration = shiftDuration(g.shift);
                const tone = SHIFT_TONES[idx % SHIFT_TONES.length];
                return (
                  <GroupCard
                    key={key}
                    testID={`shift-${key}`}
                    title={g.shift.name}
                    subtitle={`${shiftTimeRange(g.shift)}${duration ? `  ·  ${duration}` : ''}`}
                    icon="clock"
                    tone={tone}
                    count={g.staff.length}
                    expanded={!!expanded[key]}
                    onToggle={() => toggle(key)}
                  >
                    {visible.length === 0
                      ? emptyMessage(search !== '', 'No staff assigned to this shift')
                      : visible.map((s) => <StaffRow key={s.userId} staff={s} tone={tone} />)}
                  </GroupCard>
                );
              })
            )}
            {data.unassigned.length > 0 ? (
              <GroupCard
                testID="shift-unassigned"
                title="Unassigned"
                subtitle="No shift assigned"
                icon="user-minus"
                tone="danger"
                count={data.unassigned.length}
                expanded={!!expanded.unassigned}
                onToggle={() => toggle('unassigned')}
              >
                {(() => {
                  const visible = filterShiftStaff(data.unassigned, search);
                  return visible.length === 0 ? emptyMessage(true, '') : visible.map((s) => <StaffRow key={s.userId} staff={s} tone="danger" />);
                })()}
              </GroupCard>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}
