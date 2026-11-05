import React from 'react';
import { Linking, View } from 'react-native';

import { Button, EmptyState } from '@/components/ui';
import { env } from '@/config/env';
import { WebPage } from '@/lib/platform/WebPage';
import { radii, spacing, useTheme } from '@/theme';

/** The privacy policy page (iframe on web, WebView on native) with a graceful state when no URL is configured. */
export function PrivacyPolicyView() {
  const { colors } = useTheme();
  const url = env.privacyPolicyUrl;

  if (!url) {
    return (
      <View testID="privacy-not-configured" style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState icon="shield" title="Privacy policy unavailable" message="The privacy policy link has not been configured for this app yet." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, gap: spacing.sm }}>
      <View style={{ flex: 1, minHeight: 360, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
        <WebPage url={url} title="Privacy Policy" testID="privacy-webpage" />
      </View>
      <Button
        title="Open in browser"
        variant="ghost"
        size="sm"
        icon="external-link"
        onPress={() => {
          void Linking.openURL(url).catch(() => undefined);
        }}
        testID="privacy-open-browser"
      />
    </View>
  );
}
