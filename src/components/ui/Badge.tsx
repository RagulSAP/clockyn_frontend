import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, useTheme, type ColorTokens } from '@/theme';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { Text } from './Text';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

/** Foreground / soft-background pair for a semantic tone. Shared by Badge, StatCard, ListItem icons… */
export function toneColors(tone: Tone, c: ColorTokens): { fg: string; bg: string } {
  switch (tone) {
    case 'primary':
      return { fg: c.primary, bg: c.primarySoft };
    case 'success':
      return { fg: c.success, bg: c.successSoft };
    case 'warning':
      return { fg: c.warning, bg: c.warningSoft };
    case 'danger':
      return { fg: c.danger, bg: c.dangerSoft };
    case 'info':
      return { fg: c.info, bg: c.infoSoft };
    default:
      return { fg: c.textSecondary, bg: c.surfaceMuted };
  }
}

export type BadgeProps = {
  label: string;
  tone?: Tone;
  size?: 'sm' | 'md';
  icon?: IconName;
  /** Show a leading status dot. */
  dot?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Badge({ label, tone = 'neutral', size = 'md', icon, dot, style, testID }: BadgeProps) {
  const { colors } = useTheme();
  const t = toneColors(tone, colors);
  const small = size === 'sm';
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 5,
          paddingHorizontal: small ? spacing.sm : spacing.md - 2,
          paddingVertical: small ? 2 : 4,
          borderRadius: radii.pill,
          backgroundColor: t.bg,
          // Neutral is outlined so it stays distinct from the soft-filled primary tone in dark mode.
          borderWidth: 1,
          borderColor: tone === 'neutral' ? colors.border : 'transparent',
        },
        style,
      ]}
    >
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.fg }} /> : null}
      {icon ? <Icon name={icon} size={small ? 11 : 13} color={t.fg} /> : null}
      <Text variant={small ? 'micro' : 'caption'} weight="semibold" color={t.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  pending: 'warning',
  waiting: 'warning',
  unpaid: 'warning',
  partial: 'warning',
  late: 'warning',
  'in progress': 'info',
  processing: 'info',
  open: 'info',
  new: 'info',
  leave: 'info',
  holiday: 'info',
  approved: 'success',
  present: 'success',
  active: 'success',
  paid: 'success',
  completed: 'success',
  resolved: 'success',
  success: 'success',
  won: 'success',
  verified: 'success',
  rejected: 'danger',
  absent: 'danger',
  failed: 'danger',
  overdue: 'danger',
  expired: 'danger',
  lost: 'danger',
  blocked: 'danger',
  deleted: 'danger',
  'half day': 'primary',
  trial: 'primary',
  'free trial': 'primary',
  'in review': 'primary',
  inactive: 'neutral',
  closed: 'neutral',
  cancelled: 'neutral',
  canceled: 'neutral',
  draft: 'neutral',
  'week off': 'neutral',
  weekoff: 'neutral',
};

const normalise = (s: string) => s.trim().toLowerCase().replace(/[_-]+/g, ' ');

export function statusTone(status: string): Tone {
  return STATUS_TONES[normalise(status)] ?? 'neutral';
}

export function statusLabel(status: string): string {
  const n = normalise(status);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export type StatusPillProps = {
  /** Domain status such as `pending`, `approved`, `half_day`. Unknown values render neutral. */
  status: string;
  /** Override the displayed text. */
  label?: string;
  tone?: Tone;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function StatusPill({ status, label, tone, size = 'md', style, testID }: StatusPillProps) {
  return <Badge label={label ?? statusLabel(status)} tone={tone ?? statusTone(status)} size={size} dot style={style} testID={testID} />;
}

export type CountBadgeProps = {
  count: number;
  /** Counts above this render as `max+` (default 99 -> `99+`). */
  max?: number;
  /** Render even when the count is 0. */
  showZero?: boolean;
  tone?: Tone | 'solid';
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function CountBadge({ count, max = 99, showZero, tone = 'solid', style, testID }: CountBadgeProps) {
  const { colors } = useTheme();
  if (!showZero && !(count > 0)) return null;
  const text = count > max ? `${max}+` : String(Math.max(0, Math.floor(count)));
  const t = tone === 'solid' ? { fg: colors.textInverse, bg: colors.danger } : toneColors(tone, colors);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={text}
      style={[
        {
          minWidth: 18,
          height: 18,
          paddingHorizontal: 5,
          borderRadius: 9,
          backgroundColor: t.bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text variant="micro" weight="bold" color={t.fg} style={{ fontSize: 10.5, lineHeight: 13 }}>
        {text}
      </Text>
    </View>
  );
}
