import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { radii, spacing } from '@/theme';

import { ASPECT_PRESETS, type AspectKey, type Corner } from '../utils/cropGeometry';

/** The photo tools sit on the always black / white preview surface, whatever the theme. */
export const TOOL_FG = '#FFFFFF';
const TOOL_BG = '#262626';

/** Pill with an optional icon on the dark preview surface (the "Crop" button of the preview). */
export function PreviewPill({ label, icon, onPress, accessibilityLabel, testID }: { label: string; icon: IconName; onPress: () => void; accessibilityLabel?: string; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      testID={testID}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        height: 36,
        paddingHorizontal: spacing.md,
        borderRadius: radii.pill,
        backgroundColor: pressed ? '#3A3A3A' : TOOL_BG,
      })}
    >
      <Icon name={icon} size={16} color={TOOL_FG} />
      <Text variant="callout" weight="semibold" color={TOOL_FG}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Free / 1:1 / 4:3 / 16:9: the selected preset is a white pill. */
export function AspectChips({ value, onChange }: { value: AspectKey; onChange: (key: AspectKey) => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }} accessibilityRole="radiogroup">
      {ASPECT_PRESETS.map((p) => {
        const selected = p.key === value;
        return (
          <Pressable
            key={p.key}
            accessibilityRole="radio"
            accessibilityLabel={p.key === 'free' ? 'Free aspect ratio' : `Aspect ratio ${p.label}`}
            accessibilityState={{ selected, checked: selected }}
            aria-checked={selected}
            onPress={() => onChange(p.key)}
            testID={`attachment-crop-aspect-${p.key === 'free' ? 'free' : p.key.replace(':', 'x')}`}
            hitSlop={4}
            style={{
              minWidth: 56,
              height: 34,
              paddingHorizontal: spacing.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.pill,
              backgroundColor: selected ? TOOL_FG : TOOL_BG,
            }}
          >
            <Text variant="callout" weight="semibold" color={selected ? '#000000' : TOOL_FG}>
              {p.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Side of the square touch target of a corner handle. */
export const HANDLE_HIT = 44;
const BRACKET = 22;
const BRACKET_W = 4;

/** One L-shaped corner bracket inside a larger (finger sized) touch target centred on the corner. */
export function cornerBracketStyle(corner: Corner): object {
  const inset = HANDLE_HIT / 2 - BRACKET_W / 2; // the bracket hugs the rectangle corner, a hair outside it
  const base = { position: 'absolute' as const, width: BRACKET, height: BRACKET, borderColor: TOOL_FG };
  switch (corner) {
    case 'tl':
      return { ...base, left: inset, top: inset, borderLeftWidth: BRACKET_W, borderTopWidth: BRACKET_W };
    case 'tr':
      return { ...base, right: inset, top: inset, borderRightWidth: BRACKET_W, borderTopWidth: BRACKET_W };
    case 'bl':
      return { ...base, left: inset, bottom: inset, borderLeftWidth: BRACKET_W, borderBottomWidth: BRACKET_W };
    default:
      return { ...base, right: inset, bottom: inset, borderRightWidth: BRACKET_W, borderBottomWidth: BRACKET_W };
  }
}
