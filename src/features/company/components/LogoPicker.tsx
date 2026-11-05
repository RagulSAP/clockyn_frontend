import React from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, Text } from '@/components/ui';
import { spacing } from '@/theme';

export type LogoPickerProps = {
  /** Local picked image or the existing remote logo; empty = none. */
  uri: string | null;
  name: string;
  disabled?: boolean;
  onPick: () => void;
  onRemove: () => void;
};

/** Company logo field: thumbnail, "Upload Company Logo" / "Logo Selected" with Change and Remove. */
export function LogoPicker({ uri, name, disabled, onPick, onRemove }: LogoPickerProps) {
  return (
    <Card variant="muted" padding={spacing.md} testID="logo-picker">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar uri={uri} name={name || 'Company'} size={56} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="bodyStrong">{uri ? 'Logo Selected' : 'Upload Company Logo'}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button title={uri ? 'Change' : 'Choose image'} size="sm" variant="secondary" icon="image-plus" onPress={onPick} disabled={disabled} testID="logo-pick" />
            {uri ? <Button title="Remove" size="sm" variant="ghost" onPress={onRemove} disabled={disabled} testID="logo-remove" /> : null}
          </View>
        </View>
      </View>
    </Card>
  );
}
