import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';

import { Avatar, Button, Icon, ImageViewer, Modal, StatusPill, Text, type IconName } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

/** Employee row of a review card: avatar, name, date line and the status pill. */
export function ReviewHeader({ name, line, status }: { name: string; line: string; status: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Avatar name={name} size={44} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {line}
        </Text>
      </View>
      <StatusPill status={status} />
    </View>
  );
}

/** Photos + (while pending) Reject / Approve. Decided cards only show the status pill: decisions are final. */
export function ReviewActions({
  pending,
  busy,
  photoLabel,
  onPhotos,
  onReject,
  onApprove,
  testID,
}: {
  pending: boolean;
  busy: boolean;
  photoLabel: string;
  onPhotos: () => void;
  onReject: () => void;
  onApprove: () => void;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
      {/* with the decision buttons Photos takes its own row so "Approve" is never cut to "Appro..." on a phone */}
      <Button title={photoLabel} variant="secondary" icon="image" size="sm" onPress={onPhotos} style={pending ? { flexGrow: 1, flexBasis: '100%' } : { flex: 1 }} testID={testID ? `${testID}-photos` : undefined} />
      {pending ? (
        <>
          <Button title="Reject" variant="danger" icon="x" size="sm" disabled={busy} onPress={onReject} style={{ flex: 1 }} testID={testID ? `${testID}-reject` : undefined} />
          <Button title="Approve" variant="success" icon="check" size="sm" disabled={busy} onPress={onApprove} style={{ flex: 1 }} testID={testID ? `${testID}-approve` : undefined} />
        </>
      ) : null}
    </View>
  );
}

/** A photo that opens the full-screen zoom viewer on tap. */
export function PhotoTile({ uri, label, height = 200, emptyIcon = 'image' }: { uri?: string; label: string; height?: number; emptyIcon?: IconName }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" color="textMuted" weight="semibold">
        {label}
      </Text>
      {uri ? (
        <>
          <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`View ${label} full screen`}>
            <Image source={{ uri }} style={{ width: '100%', height, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }} contentFit="cover" />
          </Pressable>
          <ImageViewer uri={uri} visible={open} onClose={() => setOpen(false)} caption={label} />
        </>
      ) : (
        <View style={{ height: 96, borderRadius: radii.md, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', gap: spacing.xs }}>
          <Icon name={emptyIcon} size={22} color="textMuted" />
          <Text variant="caption" color="textMuted">
            No photo uploaded
          </Text>
        </View>
      )}
    </View>
  );
}

/** Small thumbnail with an icon placeholder (cards). */
export function Thumb({ uri, icon }: { uri?: string; icon: IconName }) {
  const { colors } = useTheme();
  return uri ? (
    <Image source={{ uri }} style={{ width: 56, height: 56, borderRadius: radii.sm, backgroundColor: colors.surfaceMuted }} contentFit="cover" />
  ) : (
    <View style={{ width: 56, height: 56, borderRadius: radii.sm, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={24} color="primary" />
    </View>
  );
}

/** Photo dialog: one or more photos and a name / date / amount summary. */
export function PhotoModal({
  visible,
  onClose,
  title,
  photos,
  summary,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  photos: { label: string; uri?: string }[];
  summary: { name: string; line: string; amount: string };
}) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} onClose={onClose} title={title} size="md">
      <View style={{ gap: spacing.lg }}>
        {photos.map((p) => (
          <PhotoTile key={p.label} uri={p.uri} label={p.label} height={photos.length > 1 ? 200 : 280} />
        ))}
        {photos.every((p) => !p.uri) && photos.length > 1 ? (
          <Text variant="body" color="textSecondary" align="center">
            No photos uploaded
          </Text>
        ) : null}
        <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md, gap: 2 }}>
          <Text variant="bodyStrong">{summary.name}</Text>
          <Text variant="caption" color="textMuted">
            {summary.line}
          </Text>
          <Text variant="title3" color="success">
            {summary.amount}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
