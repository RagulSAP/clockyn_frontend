import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { Avatar, BottomSheet, Card, Icon, ImageViewer, Spinner, Text } from '@/components/ui';
import { formatDate, formatTime12 } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';
import type { PunchSession } from '@/types/api/attendance';

import { useDaySessions } from '../../hooks/useStaffExtras';
import { formatWorkHours, rawTotalHours, type DayCell } from '../../utils/attendanceDerive';

export interface DayDetailSheetProps {
  staffId: string;
  staffName: string;
  branch: string;
  photoUrl: string | undefined;
  /** The tapped day (null closes the sheet). */
  cell: DayCell | null;
  onClose: () => void;
}

function TimeCard({ label, value, tone }: { label: string; value: string; tone: 'success' | 'danger' | 'neutral' }) {
  const { colors } = useTheme();
  const soft = tone === 'success' ? colors.successSoft : tone === 'danger' ? colors.dangerSoft : colors.surfaceMuted;
  const fg = tone === 'neutral' ? colors.text : colors[tone];
  return (
    <View style={{ flex: 1, minWidth: 96, borderRadius: radii.md, backgroundColor: soft, padding: spacing.md, gap: 2 }}>
      <Text variant="micro" color={fg}>
        {label.toUpperCase()}
      </Text>
      <Text variant="title3" color={fg}>
        {value}
      </Text>
    </View>
  );
}

function PhotoCard({ label, uri, onOpen }: { label: string; uri: string | undefined; onOpen: (uri: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 140, gap: spacing.xs }}>
      <Text variant="caption" color="textMuted" weight="semibold">
        {label}
      </Text>
      {uri ? (
        <Pressable accessibilityRole="imagebutton" accessibilityLabel={`${label}, tap to enlarge`} onPress={() => onOpen(uri)}>
          <Image source={{ uri }} style={{ height: 150, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }} contentFit="cover" />
          <Text variant="caption" color="textMuted" align="center" style={{ marginTop: 4 }}>
            Tap to enlarge
          </Text>
        </Pressable>
      ) : (
        <View style={{ height: 150, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
          <Icon name="camera" size={26} color="textMuted" />
          <Text variant="caption" color="textMuted">
            No photo
          </Text>
        </View>
      )}
    </View>
  );
}

/** Punch times, hours and photos of one calendar day (multiple sessions supported). */
export function DayDetailSheet({ staffId, staffName, branch, photoUrl, cell, onClose }: DayDetailSheetProps) {
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const record = cell?.record;
  // Sessions are only requested for days that have an attendance row (v1).
  const { sessions, isLoading } = useDaySessions(staffId, record?.date ? cell?.date ?? null : null);

  const list: PunchSession[] =
    sessions.length > 0
      ? sessions
      : [{ punchIn: record?.punchIn, punchOut: record?.punchOut, punchInPhoto: record?.punchInPhoto, punchOutPhoto: record?.punchOutPhoto }];
  const totalHours = rawTotalHours(record);

  return (
    <BottomSheet visible={!!cell} onClose={onClose} title={cell ? `Staff Details · ${formatDate(cell.date)}` : 'Staff Details'} snap="full">
      <View style={{ gap: spacing.lg }} testID="day-detail">
        <Card variant="muted" padding={spacing.md}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar uri={photoUrl} name={staffName} size={48} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{staffName}</Text>
              {branch ? (
                <Text variant="caption" color="textMuted">
                  {branch}
                </Text>
              ) : null}
            </View>
          </View>
        </Card>

        {isLoading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Spinner />
            <Text variant="callout" color="textMuted">
              Loading sessions...
            </Text>
          </View>
        ) : (
          list.map((s, i) => (
            <View key={i} style={{ gap: spacing.md }}>
              {list.length > 1 ? (
                <Text variant="micro" color="primary">
                  {`SESSION ${i + 1}`}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                <TimeCard label="Punch In" value={formatTime12(s.punchIn)} tone="success" />
                <TimeCard label="Punch Out" value={formatTime12(s.punchOut)} tone="danger" />
                {i === 0 && totalHours ? <TimeCard label="Hours" value={formatWorkHours(totalHours)} tone="neutral" /> : null}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                <PhotoCard label="Punch In Photo" uri={s.punchInPhoto} onOpen={setEnlarged} />
                <PhotoCard label="Punch Out Photo" uri={s.punchOutPhoto} onOpen={setEnlarged} />
              </View>
            </View>
          ))
        )}
      </View>
      <ImageViewer uri={enlarged} visible={!!enlarged} onClose={() => setEnlarged(null)} />
    </BottomSheet>
  );
}
