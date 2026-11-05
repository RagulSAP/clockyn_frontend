import React from 'react';
import { Linking, Pressable } from 'react-native';

import { Text } from '@/components/ui';
import { env } from '@/config/env';

/** "Need help? Contact support at …" — hidden when no support e-mail is configured. */
export function SupportNote({ prefix = 'Need help? Contact support at' }: { prefix?: string }) {
  const email = env.supportEmail;
  if (!email) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Email support at ${email}`}
      onPress={() => {
        void Linking.openURL(`mailto:${email}`).catch(() => undefined);
      }}
      testID="support-note"
    >
      <Text variant="callout" color="textSecondary" align="center">
        {`${prefix} `}
        <Text variant="callout" color="primary" weight="semibold">
          {email}
        </Text>
      </Text>
    </Pressable>
  );
}
