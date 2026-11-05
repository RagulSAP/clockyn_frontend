import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { SidebarNav } from './SidebarNav';
import { useIsWideShell } from './useShellNav';

/**
 * Persistent app chrome for the role areas. Wide web windows and tablets get a sidebar next to the content;
 * phones render the content only (the bottom `TabBar` is attached by the `(tabs)` layouts, so stack screens
 * hide it). Mounted once per area (`admin/_layout`, `staff/_layout`) so the sidebar stays visible on stack
 * screens too.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const wide = useIsWideShell();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {wide ? <SidebarNav /> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  content: { flex: 1, minWidth: 0 },
});
