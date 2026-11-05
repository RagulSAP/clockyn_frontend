import React from 'react';
import { View } from 'react-native';

import { Avatar, Button, Text } from '@/components/ui';
import { spacing } from '@/theme';

type Props = {
  uri: string | null;
  name: string;
  disabled?: boolean;
  onPick: () => void;
  onRemove: () => void;
};

/** Profile photo row of the staff form: preview, upload / change and remove (local selection only). */
export function StaffPhotoField({ uri, name, disabled, onPick, onRemove }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      <Avatar uri={uri} name={name} size={72} />
      <View style={{ flex: 1, gap: spacing.sm }}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          Profile Photo
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button
            title={uri ? 'Change Photo' : 'Upload Photo'}
            size="sm"
            variant="secondary"
            icon="camera"
            onPress={onPick}
            disabled={disabled}
            testID="staff-photo-pick"
          />
          {uri ? <Button title="Remove" size="sm" variant="ghost" onPress={onRemove} disabled={disabled} testID="staff-photo-remove" /> : null}
        </View>
      </View>
    </View>
  );
}
