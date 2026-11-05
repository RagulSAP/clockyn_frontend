import React from 'react';
import { StyleSheet, View } from 'react-native';

import { BrandMark, GradientView, Spinner } from '@/components/ui';

/**
 * In-app splash shown while fonts and the persisted session load (the native splash image stays up until it is
 * hidden; this covers the web, where there is no native splash, and the hand-over on native).
 */
export function BrandSplash() {
  return (
    <GradientView style={styles.fill} testID="brand-splash">
      <View style={styles.center}>
        <BrandMark size={96} variant="stacked" tone="light" />
      </View>
      <View style={styles.footer}>
        <Spinner color="onGradient" />
      </View>
    </GradientView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', paddingBottom: 64 },
});
