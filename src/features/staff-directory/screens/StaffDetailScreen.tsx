import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Screen, useBreakpoint } from '@/components/layout';
import { EmptyState, ErrorState, ImageViewer, Reveal, SkeletonList, Tabs, useConfirm, type MonthYear } from '@/components/ui';
import { currentMonthIST, todayIST } from '@/lib/datetime';
import { routes, useAppRouter } from '@/lib/navigation';
import { useRole } from '@/store/auth';
import { spacing } from '@/theme';

import { AdvanceTab } from '../components/detail/AdvanceTab';
import { AssignSheet } from '../components/detail/AssignSheet';
import { AttendanceTableTab } from '../components/detail/AttendanceTableTab';
import { CalendarTab } from '../components/detail/CalendarTab';
import { DayDetailSheet } from '../components/detail/DayDetailSheet';
import { DeleteStaffDialog } from '../components/detail/DeleteStaffDialog';
import { LocationsTab } from '../components/detail/LocationsTab';
import { OverviewTab } from '../components/detail/OverviewTab';
import { ProfileCard } from '../components/detail/ProfileCard';
import { ProfileSheet } from '../components/detail/ProfileSheet';
import { PunchEditSheet } from '../components/detail/PunchEditSheet';
import { directoryKeys } from '../hooks/keys';
import { useMonthAttendance } from '../hooks/useMonthAttendance';
import { useReturnFromEdit } from '../hooks/useReturnFromEdit';
import { useStaffDetailData } from '../hooks/useStaffDetailData';
import { useEditPunch, usePermanentDelete, useSetActive } from '../hooks/useStaffMutations';
import type { DayCell, DayRow } from '../utils/attendanceDerive';
import { canPermanentlyDelete, type AssignTarget } from '../utils/staffActions';

type TabKey = 'overview' | 'calendar' | 'table' | 'locations' | 'advance';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'table', label: 'Day-Wise' },
  { key: 'locations', label: 'Location' },
  { key: 'advance', label: 'Advance' },
];

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim();

/**
 * Staff detail (route param `staffId`): profile card, month calendar, day-wise attendance with punch correction,
 * punch locations, advance salary, full profile, Assign hub, edit, active toggle and permanent delete (role 1).
 */
export default function StaffDetailScreen() {
  const params = useLocalSearchParams<{ staffId?: string | string[] }>();
  const staffId = first(params.staffId);
  const router = useAppRouter();
  const role = useRole();
  const confirm = useConfirm();
  const client = useQueryClient();
  const { isDesktop } = useBreakpoint();

  const [tab, setTab] = useState<TabKey>('calendar');
  const [period, setPeriod] = useState<MonthYear>(() => currentMonthIST());
  const [locationDate, setLocationDate] = useState<string | null>(() => todayIST());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayCell, setDayCell] = useState<DayCell | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [edit, setEdit] = useState<{ row: DayRow; field: 'in' | 'out' } | null>(null);
  const reopenProfile = useRef(false);

  const data = useStaffDetailData(staffId, { profileEnabled: profileOpen });
  const attendance = useMonthAttendance(staffId, period.year, period.month);
  const detail = data.detail;
  const name = detail?.name ?? '';

  const yearRange = useMemo<[number, number]>(() => {
    const y = currentMonthIST().year;
    return [y - 5, y + 4];
  }, []);

  const goBack = useCallback(() => router.backOr(routes.admin.staff.list), [router]);

  const editPunch = useEditPunch(staffId, () => setEdit(null));
  const setActive = useSetActive(staffId, (active) => {
    if (!active) goBack();
  });
  const remove = usePermanentDelete(staffId, () => {
    setDeleteOpen(false);
    goBack();
  });

  const { scope, refetchProfile } = data;
  const { markLeaving } = useReturnFromEdit(() => {
    void client.invalidateQueries({ queryKey: directoryKeys.staff(scope, staffId) });
    if (reopenProfile.current) {
      reopenProfile.current = false;
      setProfileOpen(true);
      void refetchProfile();
    }
  });

  const onPeriodChange = (value: MonthYear) => {
    const now = currentMonthIST();
    setPeriod(value);
    // Location date resets to today for the current month, otherwise none (v1 rule). The day highlight is cleared.
    setLocationDate(value.year === now.year && value.month === now.month ? todayIST() : null);
    setSelectedDate(null);
  };

  const goEdit = () => {
    reopenProfile.current = profileOpen;
    markLeaving();
    setProfileOpen(false);
    router.push(routes.admin.staff.edit, { staffId });
  };

  const onAssign = (target: AssignTarget) => {
    setAssignOpen(false);
    router.push(target.route, { staffId });
  };

  const onToggleActive = async (active: boolean) => {
    if (!active) {
      const ok = await confirm({
        title: `Deactivate ${name || 'this staff member'}?`,
        message: 'They will no longer be able to punch in. You can reactivate them from the staff list.',
        confirmText: 'Deactivate',
        destructive: true,
      });
      if (!ok) return;
    }
    setActive.mutate(active);
  };

  const refresh = () => {
    void attendance.refetch();
    data.refetch();
  };

  let body: React.ReactNode;
  if (!staffId) {
    body = <EmptyState icon="user-x" title="Staff member not found" message="No staff member was selected." action={{ label: 'Back to staff', onPress: goBack }} />;
  } else if (data.isLoading) {
    body = <SkeletonList count={4} />;
  } else if (data.isError || !detail) {
    body = <ErrorState message={data.errorMessage || 'Failed to load staff details'} onRetry={data.refetch} />;
  } else {
    const isActive = detail.status !== 'inactive';
    const tabBody = (
      <View style={{ gap: spacing.lg }}>
        <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as TabKey)} />
        {tab === 'overview' ? (
          <OverviewTab
            detail={detail}
            attendance={attendance}
            period={period}
            isActive={isActive}
            togglingActive={setActive.isPending}
            onToggleActive={(v) => void onToggleActive(v)}
          />
        ) : null}
        {tab === 'calendar' ? (
          <CalendarTab
            attendance={attendance}
            period={period}
            onPeriodChange={onPeriodChange}
            yearRange={yearRange}
            selectedDate={selectedDate}
            onSelectDay={(cell) => {
              setSelectedDate(cell.date);
              setDayCell(cell);
            }}
          />
        ) : null}
        {tab === 'table' ? (
          <AttendanceTableTab
            attendance={attendance}
            period={period}
            onPeriodChange={onPeriodChange}
            yearRange={yearRange}
            selectedDate={selectedDate}
            onEdit={(row, field) => setEdit({ row, field })}
          />
        ) : null}
        {tab === 'locations' ? (
          <LocationsTab
            staffId={staffId}
            staffName={detail.name}
            attendance={attendance}
            period={period}
            onPeriodChange={onPeriodChange}
            yearRange={yearRange}
            date={locationDate}
            onDateChange={setLocationDate}
          />
        ) : null}
        {tab === 'advance' ? <AdvanceTab staffId={staffId} staffName={detail.name} /> : null}
      </View>
    );
    const card = (
      <ProfileCard
        detail={detail}
        photoUrl={data.photoUrl}
        canDelete={canPermanentlyDelete(role)}
        onPhotoPress={() => setPhotoOpen(true)}
        onProfile={() => setProfileOpen(true)}
        onAssign={() => setAssignOpen(true)}
        onEdit={goEdit}
        onDelete={() => setDeleteOpen(true)}
      />
    );
    body = isDesktop ? (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl }}>
        <Reveal index={0} style={{ width: 380 }}>
          {card}
        </Reveal>
        <View style={{ flex: 1 }}>{tabBody}</View>
      </View>
    ) : (
      <View style={{ gap: spacing.lg }}>
        <Reveal index={0}>{card}</Reveal>
        {tabBody}
      </View>
    );
  }

  return (
    <Screen title="Staff Details" refreshing={attendance.isRefetching} onRefresh={staffId ? refresh : undefined} testID="staff-detail-screen">
      {body}

      {detail ? (
        <>
          <ImageViewer uri={data.photoUrl} visible={photoOpen} onClose={() => setPhotoOpen(false)} caption={detail.name} />
          <DayDetailSheet
            staffId={staffId}
            staffName={detail.name}
            branch={detail.branch}
            photoUrl={data.photoUrl}
            cell={dayCell}
            onClose={() => setDayCell(null)}
          />
          {edit ? (
            <PunchEditSheet
              key={`${edit.row.date}-${edit.field}`}
              date={edit.row.date}
              seedIn={edit.row.seedIn}
              seedOut={edit.row.seedOut}
              initialField={edit.field}
              saving={editPunch.isPending}
              onClose={() => setEdit(null)}
              onSave={(punchIn, punchOut) => editPunch.mutate({ date: edit.row.date, punchIn: punchIn || undefined, punchOut: punchOut || undefined })}
            />
          ) : null}
          <ProfileSheet
            visible={profileOpen}
            profile={data.profile}
            loading={data.profileLoading}
            failed={data.profileError}
            refreshing={data.profileRefreshing}
            onRetry={() => void refetchProfile()}
            onClose={() => setProfileOpen(false)}
            onEdit={goEdit}
          />
          <AssignSheet visible={assignOpen} staffName={detail.name} onClose={() => setAssignOpen(false)} onSelect={onAssign} />
          <DeleteStaffDialog
            visible={deleteOpen}
            staffName={detail.name}
            deleting={remove.isPending}
            onClose={() => setDeleteOpen(false)}
            onConfirm={() => {
              if (role !== null) remove.mutate(role);
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}
