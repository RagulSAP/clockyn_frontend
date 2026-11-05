import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { BottomSheet, Card, Icon, ImageViewer, Skeleton, Text, type IconName } from '@/components/ui';
import { withAlpha } from '@/components/ui/internal/color';
import { formatDate, formatTime12 } from '@/lib/datetime';
import { formatDurationMinutes } from '@/lib/format';
import { radii, spacing, useTheme } from '@/theme';
import type { PunchSession } from '@/types/api/attendance';

import { STATUS_COLOR, STATUS_LABEL, type DayView, type ShiftInfo } from '../utils/attendanceCalendar';

/** Coloured status pill (uses the effective status, so a client-derived Half Day reads "Half Day" here too). */
export function StatusTag({ view }: { view: DayView }) {
  const { colors } = useTheme();
  const key = view.isSunday && !view.record ? 'weekoff' : view.status === 'none' ? null : view.status;
  const label = key === null ? '—' : key === 'weekoff' ? 'Weekly Off' : STATUS_LABEL[key];
  const color = key === null ? colors.textMuted : colors[STATUS_COLOR[key]];
  return (
    <View
      testID="day-status"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.pill, backgroundColor: withAlpha(color, 0.14) }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="callout" weight="semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

function InfoRow({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Icon name={icon} size={18} color="textMuted" />
      <Text variant="callout" color="textSecondary" style={{ width: 92 }}>
        {label}
      </Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}

function PunchCard({ kind, time, photo, onView }: { kind: 'in' | 'out'; time?: string; photo?: string; onView: (uri: string) => void }) {
  const { colors } = useTheme();
  const accent = kind === 'in' ? colors.success : colors.danger;
  return (
    <Card variant="outlined" padding={spacing.md} style={{ flex: 1 }} testID={`punch-${kind}-card`}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
          <Text variant="caption" color="textMuted">
            {kind === 'in' ? 'Punch In' : 'Punch Out'}
          </Text>
        </View>
        <Text variant="title3">{time ? formatTime12(time) : '--:--'}</Text>
        {photo ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`View ${kind === 'in' ? 'punch in' : 'punch out'} photo`} onPress={() => onView(photo)}>
            <Image source={{ uri: photo }} style={{ height: 84, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted }} contentFit="cover" />
            <View style={{ position: 'absolute', right: 6, bottom: 6, flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: colors.overlay }}>
              <Icon name="eye" size={12} color="onGradient" />
              <Text variant="micro" color="onGradient">
                View
              </Text>
            </View>
          </Pressable>
        ) : (
          <View style={{ height: 84, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Icon name="camera" size={18} color="textMuted" />
            <Text variant="caption" color="textMuted">
              No Photo
            </Text>
          </View>
        )}
      </View>
    </Card>
  );
}

export interface DayDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  view: DayView | null;
  employeeName: string;
  companyName: string;
  shift?: ShiftInfo;
  sessions: PunchSession[] | undefined;
  sessionsLoading: boolean;
}

/** Bottom sheet of one day: status, shift, every punch session with photos and the total hours. */
export function DayDetailSheet({ visible, onClose, view, employeeName, companyName, shift, sessions, sessionsLoading }: DayDetailSheetProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const record = view?.record;
  // Sessions from the server; when that request fails (or returns none) the single pair of the monthly record.
  const pairs = useMemo<PunchSession[]>(() => {
    if (sessions && sessions.length > 0) return sessions;
    if (record && (record.punchIn || record.punchOut || record.punchInPhoto || record.punchOutPhoto)) {
      return [{ punchIn: record.punchIn, punchOut: record.punchOut, punchInPhoto: record.punchInPhoto, punchOutPhoto: record.punchOutPhoto }];
    }
    return [];
  }, [sessions, record]);

  return (
    <>
      <BottomSheet visible={visible && view !== null} onClose={onClose} title="Attendance Details" snap="tall" testID="day-sheet">
        {view ? (
          <View style={{ gap: spacing.lg }}>
            <Text variant="callout" color="textSecondary" testID="day-date">
              {formatDate(view.date, 'EEEE, dd MMM yyyy')}
            </Text>
            <Card variant="muted" style={{ gap: spacing.md }}>
              <InfoRow icon="user" label="Employee">
                <Text variant="bodyStrong" numberOfLines={1}>{employeeName || '—'}</Text>
              </InfoRow>
              <InfoRow icon="building-2" label="Company">
                <Text variant="bodyStrong" numberOfLines={1}>{companyName || '—'}</Text>
              </InfoRow>
              <InfoRow icon="clipboard-check" label="Status">
                <StatusTag view={view} />
              </InfoRow>
              <InfoRow icon="clock" label="Shift Time">
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyStrong" testID="day-shift">
                    {shift ? `${formatTime12(shift.start)} – ${formatTime12(shift.end)}` : '—'}
                  </Text>
                  {shift?.name ? (
                    <Text variant="caption" color="textMuted">
                      {shift.name}
                    </Text>
                  ) : null}
                </View>
              </InfoRow>
            </Card>

            {sessionsLoading && pairs.length === 0 ? (
              <View style={{ gap: spacing.sm }}>
                <Skeleton height={20} width="40%" />
                <Skeleton height={140} />
              </View>
            ) : (
              pairs.map((s, i) => (
                <View key={i} style={{ gap: spacing.sm }}>
                  <Text variant="micro" color="textMuted">{`SESSION ${i + 1}`}</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.md }}>
                    <PunchCard kind="in" time={s.punchIn} photo={s.punchInPhoto} onView={setPhoto} />
                    <PunchCard kind="out" time={s.punchOut} photo={s.punchOutPhoto} onView={setPhoto} />
                  </View>
                </View>
              ))
            )}

            {record?.totalHours ? (
              <Card variant="muted">
                <InfoRow icon="timer" label="Total Hours">
                  <Text variant="bodyStrong" testID="day-total-hours">
                    {formatDurationMinutes(Math.round(record.totalHours * 60), { zero: '—' })}
                  </Text>
                </InfoRow>
              </Card>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
      <ImageViewer uri={photo} visible={photo !== null} onClose={() => setPhoto(null)} caption="Punch photo" />
    </>
  );
}
