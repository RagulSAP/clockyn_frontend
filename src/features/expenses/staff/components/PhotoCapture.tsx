import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { Button, Icon, Text, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { MediaPermissionError, pickImage, type PickedImage } from '@/lib/platform/media';
import { radii, spacing, useTheme } from '@/theme';

export type PhotoCaptureProps = {
  photo: PickedImage | null;
  onChange: (photo: PickedImage | null) => void;
  title: string;
  subtitle: string;
  disabled?: boolean;
  testID?: string;
};

/** Camera-only photo box: dashed "take a photo" target, then a preview with Retake / Remove. */
export function PhotoCapture({ photo, onChange, title, subtitle, disabled, testID = 'photo' }: PhotoCaptureProps) {
  const { colors } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const picked = await pickImage({ source: 'camera', allowsEditing: true, quality: 0.8 });
      if (picked) onChange(picked); // cancelling keeps the current photo
    } catch (e) {
      toast.error(e instanceof MediaPermissionError ? 'Camera permission is required' : getErrorMessage(e, 'Could not open the camera'));
    } finally {
      setBusy(false);
    }
  };

  if (!photo) {
    return (
      <Pressable
        testID={`${testID}-add`}
        onPress={() => void capture()}
        disabled={disabled || busy}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => ({
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.xxl,
          borderRadius: radii.lg,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceMuted,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        <View style={{ width: 52, height: 52, borderRadius: radii.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="camera" size={26} color="primary" />
        </View>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="caption" color="textSecondary" align="center">
          {subtitle}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Image
        testID={`${testID}-preview`}
        source={{ uri: photo.uri }}
        accessibilityLabel="Photo preview"
        resizeMode="cover"
        style={{ width: '100%', height: 220, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted }}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button title="Retake" icon="camera" variant="secondary" size="sm" onPress={() => void capture()} disabled={disabled || busy} style={{ flex: 1 }} testID={`${testID}-retake`} />
        <Button title="Remove" icon="trash" variant="danger" size="sm" onPress={() => onChange(null)} disabled={disabled} style={{ flex: 1 }} testID={`${testID}-remove`} />
      </View>
    </View>
  );
}
