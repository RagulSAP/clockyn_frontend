import React, { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout';
import { Badge, Card, EmptyState, ErrorState, ListItem, Reveal, SectionHeader, SkeletonList, useConfirm } from '@/components/ui';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getErrorMessage } from '@/lib/api/errors';
import { currentMonthIST } from '@/lib/datetime';
import { useSession } from '@/store/auth';
import { spacing } from '@/theme';
import type { Holiday } from '@/types/api/system';

import { ActionMenu } from '../components/ActionMenu';
import { SelectedDatesCard, ScopeSelects } from '../components/HolidayForms';
import { HolidayGroupCard } from '../components/HolidayGroupCard';
import { CalendarLegend, HolidayMonthGrid } from '../components/HolidayMonthGrid';
import { AddDatesModal, HolidayEditModal, OffDaysModal } from '../components/HolidayModals';
import { useHolidayActions } from '../hooks/useHolidayActions';
import { useHolidays, useScopeNames, useWeeklyOffs } from '../hooks/useHolidayData';
import {
  filterHolidays,
  groupHolidays,
  holidayDateLabel,
  holidayDateSet,
  holidayYearRange,
  monthTitle,
  offDaysSubtitle,
  plural,
  toggleDate,
  type HolidayGroup,
} from '../utils/holidayLogic';

const DEFAULT_OFF_DAYS: readonly number[] = [6];

/** Holiday calendar, per-date holidays with branch/department scope and weekly off days (route `/admin/holidays`). */
export default function HolidaysScreen() {
  const { isDesktop } = useBreakpoint();
  const session = useSession();
  const confirm = useConfirm();

  const [{ month, year }, setMonthYear] = useState(() => currentMonthIST());
  const holidaysQuery = useHolidays(year, month);
  const offQuery = useWeeklyOffs();
  const scope = useScopeNames();

  const offDays = offQuery.data ?? DEFAULT_OFF_DAYS;
  const holidays = useMemo<Holiday[]>(() => holidaysQuery.data ?? [], [holidaysQuery.data]);
  const branches = scope.branches.data ?? [];
  const departments = scope.departments.data ?? [];

  const [filterBranch, setFilterBranch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const filtered = useMemo(() => filterHolidays(holidays, filterBranch, filterDept), [holidays, filterBranch, filterDept]);
  const groups = useMemo(() => groupHolidays(filtered), [filtered]);
  const holidayDates = useMemo(() => [...holidayDateSet(filtered)], [filtered]);

  // New-holiday form
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [block, setBlock] = useState(true);
  const [selBranch, setSelBranch] = useState('');
  const [selDept, setSelDept] = useState('');

  // Row UI state
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [addKey, setAddKey] = useState<string | null>(null);
  const [offOpen, setOffOpen] = useState(false);

  const actions = useHolidayActions(holidays);
  const findGroup = (key: string | null): HolidayGroup | null => (key ? (groups.find((g) => g.key === key) ?? null) : null);
  const menuGroup = findGroup(menuKey);
  const editGroup = findGroup(editKey);
  const addGroup = findGroup(addKey);

  const resetForm = () => {
    setSelected([]);
    setName('');
    setBlock(true);
    setSelBranch('');
    setSelDept('');
  };

  /** Changing the month clears the picked dates (v1 kept them and re-applied the day numbers to the new month). */
  const onMonthChange = (v: { month: number; year: number }) => {
    setMonthYear({ month: v.month, year: v.year });
    setSelected([]);
    setExpandedKey(null);
    setMenuKey(null);
    setEditKey(null);
    setAddKey(null);
  };

  const onSaveHoliday = async () => {
    const outcome = await actions.addHolidays({ name, dates: selected, branchName: selBranch, deptName: selDept, blockAttendance: block });
    if (outcome.ok) resetForm();
    else if (outcome.remaining.length > 0) setSelected(outcome.remaining);
  };

  const onDeleteGroup = async (g: HolidayGroup) => {
    const ok = await confirm({
      title: 'Delete Holiday?',
      message: `Delete all ${g.entries.length} dates for "${g.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) await actions.deleteEntries(g.entries);
  };

  const onDeleteDate = async (g: HolidayGroup, entry: Holiday) => {
    const ok = await confirm({
      title: 'Delete Holiday?',
      message: `Remove "${g.name}" on ${holidayDateLabel(entry.date)}? This action cannot be undone.`,
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok) await actions.deleteEntries([entry]);
  };

  const refreshing = (holidaysQuery.isRefetching || offQuery.isRefetching) && !holidaysQuery.isLoading;
  const onRefresh = () => {
    void holidaysQuery.refetch();
    void offQuery.refetch();
  };

  const calendarCard = (
    <Card testID="holiday-calendar-card">
      <HolidayMonthGrid
        year={year}
        month={month}
        onMonthChange={onMonthChange}
        yearRange={holidayYearRange(currentMonthIST().year)}
        offDays={offDays}
        holidayDates={holidayDates}
        selected={selected}
        onToggle={(d) => setSelected((cur) => toggleDate(cur, d))}
        testID="holiday-grid"
      />
      <CalendarLegend />
      <View style={{ marginTop: spacing.lg }}>
        <Card variant="muted" padding={0}>
          <ListItem
            icon="calendar-clock"
            iconTone="primary"
            title="Configure Off Days"
            subtitle={offQuery.isError ? 'Could not load off days' : offDaysSubtitle(offDays)}
            onPress={() => setOffOpen(true)}
            testID="configure-off-days"
          />
        </Card>
      </View>
    </Card>
  );

  const listSection = (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionHeader title={monthTitle(year, month)} style={{ flex: 1 }} />
        <Badge label={plural(groups.length, 'Holiday', 'Holidays')} tone="primary" testID="holiday-count" />
      </View>
      {holidaysQuery.isLoading ? (
        <SkeletonList count={3} />
      ) : holidaysQuery.isError ? (
        <ErrorState message={getErrorMessage(holidaysQuery.error, 'Failed to load holidays')} onRetry={() => void holidaysQuery.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState icon="party-popper" title="No Holidays" message="Tap any date on the calendar above to add a holiday" compact />
      ) : (
        groups.map((g) => (
          <HolidayGroupCard
            key={g.key}
            group={g}
            expanded={expandedKey === g.key}
            onToggleExpand={() => setExpandedKey((k) => (k === g.key ? null : g.key))}
            onMenu={() => setMenuKey(g.key)}
            onDeleteDate={(entry) => void onDeleteDate(g, entry)}
          />
        ))
      )}
    </View>
  );

  const filters = (
    <ScopeSelects
      variant="filter"
      branches={branches}
      departments={departments}
      branch={filterBranch}
      dept={filterDept}
      onBranch={setFilterBranch}
      onDept={setFilterDept}
    />
  );

  const selectedCard =
    selected.length > 0 ? (
      <SelectedDatesCard
        dates={selected}
        name={name}
        onName={setName}
        branch={selBranch}
        dept={selDept}
        onBranch={setSelBranch}
        onDept={setSelDept}
        branches={branches}
        departments={departments}
        block={block}
        onBlock={setBlock}
        saving={actions.busy.add}
        onCancel={resetForm}
        onSave={() => void onSaveHoliday()}
      />
    ) : null;

  return (
    <Screen
      title="Holiday Management"
      subtitle={session?.orgName || undefined}
      refreshing={refreshing}
      onRefresh={onRefresh}
      testID="holidays-screen"
    >
      {isDesktop ? (
        <View style={{ flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: spacing.lg }}>
            <Reveal index={0}>{filters}</Reveal>
            <Reveal index={1}>{calendarCard}</Reveal>
            {selectedCard}
          </View>
          <View style={{ flex: 1 }}>
            <Reveal index={2}>{listSection}</Reveal>
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Reveal index={0}>{filters}</Reveal>
          <Reveal index={1}>{calendarCard}</Reveal>
          {selectedCard}
          <Reveal index={2}>{listSection}</Reveal>
        </View>
      )}

      <ActionMenu
        visible={!!menuGroup}
        onClose={() => setMenuKey(null)}
        title={menuGroup?.name}
        testID="holiday-menu"
        items={
          menuGroup
            ? [
                { key: 'edit', label: 'Edit', icon: 'edit', onPress: () => setEditKey(menuGroup.key) },
                { key: 'delete', label: 'Delete', icon: 'trash', destructive: true, onPress: () => void onDeleteGroup(menuGroup) },
                { key: 'add-dates', label: 'Add Dates', icon: 'calendar-plus', onPress: () => setAddKey(menuGroup.key) },
              ]
            : []
        }
      />

      <HolidayEditModal
        group={editGroup}
        year={year}
        month={month}
        offDays={offDays}
        holidayDates={holidayDates}
        saving={actions.busy.edit}
        onClose={() => setEditKey(null)}
        onSave={async (v) => {
          if (editGroup && (await actions.saveEdit(editGroup, v))) setEditKey(null);
        }}
      />
      <AddDatesModal
        group={addGroup}
        year={year}
        month={month}
        offDays={offDays}
        holidayDates={holidayDates}
        saving={actions.busy.addDates}
        onClose={() => setAddKey(null)}
        onAdd={async (dates) => {
          if (addGroup && (await actions.addDatesToGroup(addGroup, dates)).ok) setAddKey(null);
        }}
      />
      <OffDaysModal
        visible={offOpen}
        offDays={offDays}
        saving={actions.busy.offDays}
        onClose={() => setOffOpen(false)}
        onSave={async (days) => {
          if (await actions.saveOffDays(days)) setOffOpen(false);
        }}
      />
    </Screen>
  );
}
