import React, { useMemo, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { withAlpha } from './internal/color';

export type AvatarStatus = 'online' | 'offline' | 'away' | 'busy' | boolean;

export type AvatarProps = {
  uri?: string | null;
  name?: string;
  size?: number;
  /** Presence dot. `true` = online. */
  status?: AvatarStatus;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Up to two initials from a display name. */
export function getInitials(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

/**
 * Presigned image URLs carry a rotating signature in the query string. Using the URL without the query as the
 * cache key keeps the same picture cached (no flicker / re-download) while the signature changes.
 */
export function stableImageKey(uri: string): string {
  const q = uri.indexOf('?');
  return q === -1 ? uri : uri.slice(0, q);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ uri, name, size = 40, status, style, testID }: AvatarProps) {
  const { colors } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const failed = !!uri && failedUri === uri;

  const tone = useMemo(() => {
    // Monochrome with one meaningful accent (colour is reserved for meaning in the CRED look).
    const palette = [colors.primary, colors.textSecondary, colors.success];
    return palette[hash(name ?? '?') % palette.length];
  }, [colors, name]);

  const source = useMemo(() => (uri ? { uri, cacheKey: stableImageKey(uri) } : null), [uri]);
  const showImage = !!source && !failed;
  const dotColor =
    status === true || status === 'online'
      ? colors.success
      : status === 'away'
        ? colors.warning
        : status === 'busy'
          ? colors.danger
          : colors.textMuted;
  const dot = Math.max(10, Math.round(size * 0.26));

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name ? `${name}${status ? (status === 'offline' ? ', offline' : ', online') : ''}` : 'Avatar'}
      style={[{ width: size, height: size }, style]}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: showImage ? colors.surfaceMuted : withAlpha(tone, 0.15),
        }}
      >
        {showImage ? (
          <Image
            source={source}
            style={{ width: size, height: size }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={source.cacheKey}
            onError={() => setFailedUri(uri ?? null)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text variant="bodyStrong" weight="bold" color={tone} style={{ fontSize: Math.max(11, size * 0.38), lineHeight: size }}>
            {getInitials(name) || '?'}
          </Text>
        )}
      </View>
      {status ? (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: dotColor,
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        />
      ) : null}
    </View>
  );
}
