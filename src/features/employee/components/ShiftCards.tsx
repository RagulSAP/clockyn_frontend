import React, { memo, useMemo } from 'react';
import { View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { formatTime12 } from '@/lib/datetime';
import { radii, spacing, useTheme, type ColorTokens } from '@/theme';
import type { PunchSession } from '@/types/api/attendance';

import { useLiveClock } from '../hooks/useLiveClock';
import {
  calcRemaining,
  calcWorkingHours,
  istSecondsOfDay,
  progressTone,
  remainDisplay,
  type ProgressTone,
} from '../utils/shiftTime';

type SessionTimes = Pick<PunchSession, 'punchIn' | 'punchOut'>;

export function toneColor(colors: ColorTokens, tone: 'neutral' | 'primary' | 'info' | 'warning' | 'success' | 'danger'): string {
  switch (tone) {
    case 'info':
      return colors.text; // "in progress" is neutral: colour is reserved for success / warning / danger
    case 'warning':
      return colors.warning;
    case 'success':
      return colors.success;
    case 'danger':
      return colors.danger;
    case 'primary':
      return colors.primary;
    default:
      return colors.textMuted;
  }
}

export interface ShiftTimingProps {
  punchIn?: string;
  punchOut?: string;
  shiftStart?: string;
  shiftEnd?: string;
  isPunchedIn: boolean;
  sessions: SessionTimes[];
}

export interface RemainCardProps extends ShiftTimingProps {
  isDone: boolean;
}

/** Remaining time / overtime. Owns a 1 s clock (memoised, so the screen never re-renders every second). */
export const RemainCard = memo(function RemainCard({ punchIn, punchOut, shiftStart, shiftEnd, isDone, isPunchedIn, sessions }: RemainCardProps) {
  const { colors } = useTheme();
  const now = useLiveClock(1000);
  const remain = useMemo(
    () => calcRemaining({ nowS: istSecondsOfDay(now), punchIn, punchOut, shiftStart, shiftEnd, isDone, isPunchedIn, sessions }),
    [now, punchIn, punchOut, shiftStart, shiftEnd, isDone, isPunchedIn, sessions],
  );
  const display = remainDisplay(remain);
  const color = toneColor(colors, display.tone);
  return (
    <View testID="remain-card" accessibilityLabel={`${display.title} ${display.prefix}${remain.hh}:${remain.mm}:${remain.ss}`} style={{ gap: spacing.xs }}>
      <Text variant="micro" color="textMuted" testID="remain-title">
        {display.title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        {display.prefix ? (
          <Text variant="display" style={{ color, fontSize: 56, lineHeight: 60, letterSpacing: -2 }}>
            {display.prefix}
          </Text>
        ) : null}
        <Text variant="display" style={{ color, fontSize: 56, lineHeight: 60, letterSpacing: -2, fontVariant: ['tabular-nums'] }} testID="remain-clock">
          {`${remain.hh}:${remain.mm}`}
        </Text>
        <Text variant="title1" style={{ color, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }} testID="remain-seconds">
          {`:${remain.ss}`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text variant="callout" style={{ color }} testID="remain-label">
          {display.label}
        </Text>
      </View>
    </View>
  );
});

/** Shift name and window (`09:00 AM – 06:00 PM`, `--` when missing). */
export function ShiftCard({ name, start, end }: { name?: string; start?: string; end?: string }) {
  const { colors } = useTheme();
  const window = start && end ? `${formatTime12(start)} – ${formatTime12(end)}` : '--';
  return (
    <View testID="shift-card" style={{ gap: spacing.xs + 2 }}>
      <Text variant="micro" color="textMuted">
        SHIFT
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="briefcase" size={16} color="textSecondary" />
        <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {name || 'Not Assigned'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name="clock" size={16} color="textSecondary" />
        <Text variant="callout" style={{ color: colors.textSecondary }}>
          {window}
        </Text>
      </View>
    </View>
  );
}

function barColor(colors: ColorTokens, tone: ProgressTone): string {
  return tone === 'success' ? colors.success : tone === 'info' ? colors.text : colors.warning;
}

/** Worked / total hours with a progress bar (own 1 s clock). */
export const WorkHoursCard = memo(function WorkHoursCard({ punchIn, punchOut, shiftStart, shiftEnd, isPunchedIn, sessions }: ShiftTimingProps) {
  const { colors } = useTheme();
  const now = useLiveClock(1000);
  const hours = useMemo(
    () => calcWorkingHours({ nowS: istSecondsOfDay(now), punchIn, punchOut, shiftStart, shiftEnd, isPunchedIn, sessions }),
    [now, punchIn, punchOut, shiftStart, shiftEnd, isPunchedIn, sessions],
  );
  const tone = progressTone(hours.pct);
  const fill = barColor(colors, tone);
  return (
    <Card testID="work-hours-card" style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="micro" color="textMuted" style={{ textTransform: 'uppercase' }}>
          Working Hours
        </Text>
        <Text variant="title2" style={{ color: hours.pct >= 1 ? colors.success : colors.text, fontVariant: ['tabular-nums'] }} testID="work-hours-value">
          {`${hours.label} / ${hours.totalLabel}`}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(hours.pct * 100) }}
        style={{ height: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}
      >
        <View testID="work-hours-bar" style={{ width: `${Math.round(hours.pct * 100)}%`, height: '100%', backgroundColor: fill, borderRadius: radii.pill }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="caption" color="textMuted">
          {`Punch In: ${punchIn ? formatTime12(punchIn) : '--'}`}
        </Text>
        <Text variant="caption" color="textMuted">
          {`Shift End: ${shiftEnd ? formatTime12(shiftEnd) : '--'}`}
        </Text>
      </View>
    </Card>
  );
});
