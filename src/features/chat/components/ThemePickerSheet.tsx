import React from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';
import { CHAT_THEME_COUNT, chatThemeLabel, resolveChatTheme } from '../utils/chatThemes';

/** Group chat theme picker: eight tiles with a mini bubble preview; the choice is remembered per group. */
export function ThemePickerSheet({ visible, onClose, active, onPick }: { visible: boolean; onClose: () => void; active: number; onPick: (index: number) => void }) {
  const { colors } = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Chat Theme" snap="auto" size="sm">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {Array.from({ length: CHAT_THEME_COUNT }, (_, i) => {
          const t = resolveChatTheme(i, colors);
          const isActive = i === active;
          return (
            <Pressable
              key={i}
              testID={`chat-theme-${i}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${chatThemeLabel(i)} theme`}
              onPress={() => onPick(i)}
              style={{ width: '22%', minWidth: 72, alignItems: 'center', gap: spacing.xs }}
            >
              <View
                style={{
                  width: '100%',
                  height: 64,
                  borderRadius: radii.md,
                  backgroundColor: t.background,
                  borderWidth: 2,
                  borderColor: isActive ? colors.primary : colors.border,
                  padding: spacing.sm,
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ alignSelf: 'flex-start', width: '60%', height: 14, borderRadius: radii.xs, backgroundColor: t.otherBubble }} />
                <View style={{ alignSelf: 'flex-end', width: '60%', height: 14, borderRadius: radii.xs, backgroundColor: t.myBubble }} />
                {isActive ? (
                  <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.primary, borderRadius: radii.pill, padding: 2 }}>
                    <Icon name="check" size={12} color="onPrimary" />
                  </View>
                ) : null}
              </View>
              <Text variant="caption" color={isActive ? 'primary' : 'textSecondary'}>
                {chatThemeLabel(i)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
