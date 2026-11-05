/**
 * WebPage — NATIVE implementation: `react-native-webview` showing an external page with a loading indicator.
 */
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/theme';
import type { WebPageProps } from './WebPage';

export type { WebPageProps } from './WebPage';

export function WebPage({ url, style, testID }: WebPageProps): React.JSX.Element {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  return (
    <View testID={testID} style={[{ flex: 1, minHeight: 320, backgroundColor: colors.background }, style]}>
      <WebView
        source={{ uri: url }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        onLoadEnd={() => setLoading(false)}
        startInLoadingState={false}
        javaScriptEnabled
        domStorageEnabled
      />
      {loading ? (
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}
