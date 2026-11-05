import React from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Badge, Button, Card, CountBadge, Icon, Modal, Spinner, Text, type IconName } from '@/components/ui';
import { formatTime12, greeting } from '@/lib/datetime';
import { hapticImpact } from '@/lib/platform/haptics';
import { elevation, radii, spacing, useTheme } from '@/theme';
import { withAlpha } from '@/components/ui/internal/color';
import { useBreakpoint } from '@/hooks/useBreakpoint';

import type { PunchButtonState, StatusChip } from '../utils/punchState';
import { toneColor } from './ShiftCards';

const GREETING_ICON: Record<string, IconName> = {
  'Good Morning': 'sunrise',
  'Good Afternoon': 'sun',
  'Good Evening': 'sunset',
  'Good Night': 'moon',
};

export interface HomeHeaderProps {
  companyName: string;
  logoUrl?: string;
  username: string;
  chip: StatusChip;
}

/** Company logo + name, IST greeting with the user's name and the status chip. */
export function HomeHeader({ companyName, logoUrl, username, chip }: HomeHeaderProps) {
  const greet = greeting();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Avatar uri={logoUrl} name={companyName} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title3" numberOfLines={1} testID="home-company">
          {companyName}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
          <Icon name={GREETING_ICON[greet] ?? 'sun'} size={14} color="textMuted" />
          <Text variant="callout" color="textSecondary" numberOfLines={2} testID="home-greeting" style={{ flexShrink: 1 }}>
            {`${greet}, `}
            <Text variant="callout" weight="bold" testID="home-username">
              {username}
            </Text>
          </Text>
        </View>
      </View>
      <Badge label={chip.label} tone={chip.tone === 'info' ? 'primary' : chip.tone} dot testID="home-status-chip" />
    </View>
  );
}

/** Round punch button (SETUP FACE / PUNCH IN / PUNCH OUT / LIMIT REACHED / CHECKING…): the hero of the app. A tactile disc with a lit top edge, soft glow and two halo rings in the state colour. */
export function PunchButton({ state, onPress }: { state: PunchButtonState; onPress: () => void }) {
  const { colors } = useTheme();
  const limit = state.key === 'limit';
  const bg = limit ? colors.surfaceMuted : toneColor(colors, state.tone);
  const fg = limit ? colors.textMuted : colors.textInverse;
  const ring = limit ? colors.border : bg;
  return (
    <View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 1, borderColor: withAlpha(ring, limit ? 1 : 0.22), backgroundColor: withAlpha(ring, limit ? 0 : 0.05) }}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', width: 176, height: 176, borderRadius: 88, borderWidth: 1, borderColor: withAlpha(ring, limit ? 1 : 0.4), backgroundColor: withAlpha(ring, limit ? 0 : 0.09) }}
      />
      <Pressable
        testID="punch-button"
        accessibilityRole="button"
        accessibilityLabel={state.label}
        accessibilityState={{ disabled: state.disabled, busy: state.key === 'checking' }}
        disabled={state.disabled}
        onPress={() => {
          hapticImpact('medium');
          onPress();
        }}
        style={({ pressed }) => [
          {
            width: 152,
            height: 152,
            borderRadius: 76,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
            backgroundColor: bg,
            borderWidth: 1,
            borderColor: withAlpha(colors.textInverse, 0.14),
            borderTopColor: withAlpha(colors.onGradient, limit ? 0 : 0.45),
            opacity: limit ? 0.7 : pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
          limit ? null : { ...elevation.lg(bg), shadowOpacity: 0.55, shadowRadius: 30 },
        ]}
      >
        {state.icon === 'spinner' ? <Spinner color={fg} /> : <Icon name={state.icon} size={40} color={fg} />}
        <Text variant="bodyStrong" style={{ color: fg, letterSpacing: 1.2 }} testID="punch-label">
          {state.label}
        </Text>
      </Pressable>
    </View>
  );
}

/** Punch In / Punch Out time cards. */
export function TimeCards({ punchIn, punchOut }: { punchIn?: string; punchOut?: string }) {
  const { colors } = useTheme();
  const items = [
    { key: 'in', label: 'Punch In', value: punchIn, done: 'Checked in', accent: colors.success },
    { key: 'out', label: 'Punch Out', value: punchOut, done: 'Checked out', accent: colors.danger },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {items.map((it) => (
        <Card key={it.key} padding={spacing.md} style={{ flex: 1 }} testID={`time-card-${it.key}`}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: it.accent }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="caption" color="textMuted">
                {it.label}
              </Text>
              <Text variant="title3" testID={`time-value-${it.key}`}>
                {it.value ? formatTime12(it.value) : '--:--'}
              </Text>
              <Text variant="caption" color="textSecondary">
                {it.value ? it.done : 'Not yet'}
              </Text>
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

export interface QuickAction {
  key: string;
  title: string;
  subtitle: string;
  icon: IconName;
  badge?: number;
  onPress: () => void;
}

/** 2x2 grid (4 across on wide screens) of shortcuts with a request-count badge. */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  const { isPhone } = useBreakpoint();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="micro" color="textMuted" style={{ textTransform: 'uppercase' }}>
        Quick Actions
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {actions.map((a) => (
          <Card
            key={a.key}
            testID={`quick-${a.key}`}
            onPress={a.onPress}
            accessibilityLabel={a.badge ? `${a.title}, ${a.badge} pending` : a.title}
            style={{ flexBasis: isPhone ? '47%' : '23%', flexGrow: 1 }}
          >
            <View style={{ gap: spacing.md }}>
              <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={a.icon} size={22} color="primary" />
                {a.badge && a.badge > 0 ? <CountBadge count={a.badge} style={{ position: 'absolute', top: -6, right: -6 }} testID={`quick-${a.key}-badge`} /> : null}
              </View>
              <View style={{ gap: 2 }}>
                <Text variant="bodyStrong">{a.title}</Text>
                <Text variant="caption" color="textMuted">
                  {a.subtitle}
                </Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

/** Popup listing the colleagues with a birthday today. */
export function BirthdayModal({ visible, names, onClose }: { visible: boolean; names: string[]; onClose: () => void }) {
  return (
    <Modal visible={visible} onClose={onClose} size="sm" footer={<Button title="Close" onPress={onClose} fullWidth testID="birthday-close" />}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <Icon name="party-popper" size={44} color="primary" />
        {names.map((n) => (
          <Text key={n} variant="body" align="center" testID="birthday-line">
            {`Today is ${n}'s birthday. Wish them a wonderful birthday!`}
          </Text>
        ))}
      </View>
    </Modal>
  );
}
