import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { Badge, Icon, Text, type IconName } from '@/components/ui';
import { radii, spacing, useTheme, type ColorTokens } from '@/theme';

import type { LeadWorkStatus } from '../types';
import { WORK_STATUS_LABEL } from '../utils/workStatus';

type Size = 'sm' | 'md';

/** Accent colour of a work status (row borders): neutral (pending) / amber / green / violet. */
export function workStatusColor(colors: ColorTokens, status: LeadWorkStatus): string {
  switch (status) {
    case 'working':
      return colors.warning;
    case 'completed':
      return colors.success;
    case 'carry_forward':
      return colors.statusHalfDay;
    default:
      return colors.borderStrong;
  }
}

/** Violet pill = carry-forward / CFR semantics (the one status colour the semantic tones do not cover). */
export function VioletBadge({ label, size = 'md', icon, style }: { label: string; size?: Size; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const small = size === 'sm';
  return (
    <View
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
          backgroundColor: colors.primarySoft,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 11 : 13} color={colors.statusHalfDay} /> : null}
      <Text variant={small ? 'micro' : 'caption'} weight="semibold" color={colors.statusHalfDay} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Work-status pill: Pending (neutral), Working (amber), Completed (green), Carry Forward (violet). */
export function WorkStatusBadge({ status, size = 'md' }: { status: LeadWorkStatus; size?: Size }) {
  const label = WORK_STATUS_LABEL[status];
  if (status === 'carry_forward') return <VioletBadge label={label} size={size} />;
  const tone = status === 'completed' ? 'success' : status === 'working' ? 'warning' : 'primary';
  return <Badge label={label} tone={tone} size={size} />;
}

/** Approved (green) / rejected (red) / anything else (amber) pill of a carry-forward request. */
export function CfrStatusBadge({ status, size = 'md' }: { status: string; size?: Size }) {
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : '';
  const tone = status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning';
  return <Badge label={label} tone={tone} size={size} />;
}
