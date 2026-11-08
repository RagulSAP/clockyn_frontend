import React from 'react';
import { Linking, View } from 'react-native';

import { Button, Icon, Modal, Text } from '@/components/ui';
import { env } from '@/config/env';
import { spacing, useTheme } from '@/theme';

import { EMPLOYEE_MOBILE_ONLY_MESSAGE, EMPLOYEE_MOBILE_ONLY_TITLE } from '../utils/employeeAccess';

export type EmployeeMobileOnlyModalProps = { visible: boolean; onClose: () => void };

const FULL = { alignSelf: 'stretch' } as const;
const open = (url: string) => void Linking.openURL(url).catch(() => undefined);

/** Shown when someone opens Employee Access in a browser: it is available in the Android / iOS app only. */
export function EmployeeMobileOnlyModal({ visible, onClose }: EmployeeMobileOnlyModalProps) {
  const { colors } = useTheme();
  const stores = [
    { label: 'Get it on Google Play', url: env.androidStoreUrl, testID: 'employee-store-android' },
    { label: 'Download on the App Store', url: env.iosStoreUrl, testID: 'employee-store-ios' },
  ].filter((s) => s.url);

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      size="sm"
      testID="employee-mobile-only-modal"
      footer={
        <View style={{ gap: spacing.sm, paddingBottom: spacing.xs, alignSelf: 'stretch' }}>
          {stores.map((s) => (
            <Button
              key={s.testID}
              title={s.label}
              icon="external-link"
              variant="secondary"
              onPress={() => open(s.url)}
              testID={s.testID}
              style={FULL}
            />
          ))}
          <Button title="Got it" onPress={onClose} testID="employee-mobile-only-ok" style={FULL} />
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm }}>
        <View
          style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSoft }}
        >
          <Icon name="smartphone" size={28} color="success" />
        </View>
        <Text variant="title3" align="center" accessibilityRole="header">
          {EMPLOYEE_MOBILE_ONLY_TITLE}
        </Text>
        <Text variant="body" color="textSecondary" align="center" testID="employee-mobile-only-message">
          {EMPLOYEE_MOBILE_ONLY_MESSAGE}
        </Text>
      </View>
    </Modal>
  );
}
