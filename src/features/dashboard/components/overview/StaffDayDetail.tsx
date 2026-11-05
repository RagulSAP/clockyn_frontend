import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { ResponsiveRow } from '@/components/layout';
import { Avatar, Badge, Card, ErrorState, Icon, ImageViewer, Spinner, Text } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';
import type { StaffMember } from '@/types/api/staff';

import type { StaffDay } from '../../hooks/useOverviewData';
import { formatHours, formatPunchTime, statusTone, type DaySession } from '../../utils/overviewLogic';

function TimeCard({ label, value, tone }: { label: string; value: string; tone: 'success' | 'danger' }) {
  return (
    <Card padding={spacing.md} variant="outlined">
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="title2" color={tone} style={{ marginTop: spacing.xs }}>
        {value}
      </Text>
    </Card>
  );
}

function PhotoCard({ label, uri, onOpen }: { label: string; uri: string | undefined; onOpen: (uri: string) => void }) {
  const { colors } = useTheme();
  return (
    <Card padding={spacing.md} variant="outlined">
      <Text variant="caption" color="textMuted" style={{ marginBottom: spacing.sm }}>
        {label}
      </Text>
      {uri ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}, tap to enlarge`} onPress={() => onOpen(uri)} testID={`photo-${label}`}>
          <Image source={{ uri }} style={{ width: '100%', height: 140, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }} contentFit="cover" />
          <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.xs }}>
            Tap to enlarge
          </Text>
        </Pressable>
      ) : (
        <View style={{ height: 140, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
          <Icon name="camera" size={28} color="textMuted" />
          <Text variant="caption" color="textMuted">
            No photo
          </Text>
        </View>
      )}
    </Card>
  );
}

function SessionBlock({ session, index, count, onOpenPhoto }: { session: DaySession; index: number; count: number; onOpenPhoto: (uri: string) => void }) {
  return (
    <View style={{ gap: spacing.md }} testID={`session-${index + 1}`}>
      {count > 1 ? (
        <Text variant="micro" color="textMuted">
          {`SESSION ${index + 1}`}
        </Text>
      ) : null}
      <ResponsiveRow columns={2} gap={spacing.md}>
        <TimeCard label="Punch In" value={formatPunchTime(session.punchIn)} tone="success" />
        <TimeCard label="Punch Out" value={formatPunchTime(session.punchOut)} tone="danger" />
      </ResponsiveRow>
      <ResponsiveRow columns={2} gap={spacing.md}>
        <PhotoCard label="Punch In Photo" uri={session.punchInPhoto} onOpen={onOpenPhoto} />
        <PhotoCard label="Punch Out Photo" uri={session.punchOutPhoto} onOpen={onOpenPhoto} />
      </ResponsiveRow>
    </View>
  );
}

export type StaffDayDetailProps = {
  staff: StaffMember;
  /** `YYYY-MM-DD` (IST). */
  date: string;
  day: StaffDay;
};

/** One staff member's day: profile hero, total hours and every punch session with photos. */
export function StaffDayDetail({ staff, date, day }: StaffDayDetailProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const statusLabel = staff.statusLabel;
  return (
    <View style={{ gap: spacing.lg }} testID="staff-detail">
      <Card>
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Avatar uri={day.photoUrl} name={staff.name} size={84} />
          <Text variant="title2" align="center">
            {staff.name}
          </Text>
          {staff.empId ? (
            <Text variant="callout" color="textMuted">
              {staff.empId}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
            <Badge icon="building-2" label={staff.branch || 'N/A'} />
            <Badge icon="tag" label={staff.department || 'N/A'} />
            {statusLabel ? <Badge label={statusLabel} tone={statusTone(staff.status, statusLabel)} dot /> : null}
            <Badge icon="calendar" label={formatDate(date)} tone="primary" />
          </View>
        </View>
      </Card>

      {day.loading ? (
        <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
          <Spinner />
          <Text variant="callout" color="textMuted">
            Loading attendance...
          </Text>
        </View>
      ) : day.failed ? (
        <ErrorState compact message="Failed to load attendance" onRetry={day.refetch} />
      ) : (
        <>
          {day.totalHours ? (
            <Card variant="muted" padding={spacing.md}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text variant="bodyStrong">Total Hours</Text>
                <Text variant="title2" color="primary" testID="total-hours">
                  {formatHours(day.totalHours)}
                </Text>
              </View>
            </Card>
          ) : null}
          {day.sessions.map((s, i) => (
            <SessionBlock key={i} session={s} index={i} count={day.sessions.length} onOpenPhoto={setPhoto} />
          ))}
        </>
      )}
      <ImageViewer visible={photo !== null} uri={photo} onClose={() => setPhoto(null)} caption="Punch photo" />
    </View>
  );
}
