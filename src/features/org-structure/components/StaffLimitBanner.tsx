import React from 'react';
import { Platform, View } from 'react-native';

import { Button, Card, Icon, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import { staffLimitReached, staffLimitSubtitle, staffLimitTitle, type StaffLimitInfo } from '../utils/staffForm';

type Props = {
  info: StaffLimitInfo;
  /** Opens the billing screen. */
  onUpgrade: () => void;
};

/** "Staff: X / Y" banner of the Add Staff form; red with an upgrade path when the plan limit is reached. */
export function StaffLimitBanner({ info, onUpgrade }: Props) {
  const { colors } = useTheme();
  const full = staffLimitReached(info);
  return (
    <Card
      variant="outlined"
      padding={spacing.lg}
      testID="staff-limit-banner"
      style={{ backgroundColor: full ? colors.dangerSoft : colors.successSoft, borderColor: full ? colors.danger : colors.success }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
          }}
        >
          <Icon name={full ? 'lock' : 'users'} size={20} color={full ? 'danger' : 'success'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" color={full ? 'danger' : 'success'}>
            {staffLimitTitle(info)}
          </Text>
          <Text variant="callout" color="textSecondary">
            {staffLimitSubtitle(info)}
          </Text>
        </View>
        {full ? (
          <Button
            // iOS shows a status view instead of a purchase prompt (store payment rules).
            title={Platform.OS === 'ios' ? 'View Status' : 'Upgrade'}
            size="sm"
            variant="danger"
            onPress={onUpgrade}
            testID="staff-limit-upgrade"
          />
        ) : null}
      </View>
    </Card>
  );
}
