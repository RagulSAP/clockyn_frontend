import React, { useContext, useEffect, useState } from 'react';
import { Modal as RNModal, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Button, Icon, IconButton, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { PickedAttachment } from '../hooks/usePickAttachment';

/** The preview surface is always black / white (like the photo viewer), whatever the theme. */
const PREVIEW_BG = '#000000';
const PREVIEW_FG = '#FFFFFF';

export interface AttachmentPreviewProps {
  /** The picked photo / file; `null` hides the preview. */
  attachment: PickedAttachment | null;
  onCancel: () => void;
  onSend: () => void;
}

/** "PDF document", "Word document", ... for the file card; falls back to the extension. */
export function describeAttachment(fileName: string, mimeType: string): string {
  const mime = mimeType.toLowerCase();
  const ext = (fileName.split('.').pop() ?? '').toLowerCase();
  if (mime.startsWith('image/')) return 'Photo';
  if (mime === 'application/pdf' || ext === 'pdf') return 'PDF document';
  if (mime.includes('word') || ext === 'doc' || ext === 'docx') return 'Word document';
  if (mime.includes('sheet') || mime.includes('excel') || ext === 'xls' || ext === 'xlsx' || ext === 'csv') return 'Spreadsheet';
  if (mime.includes('presentation') || mime.includes('powerpoint') || ext === 'ppt' || ext === 'pptx') return 'Presentation';
  if (mime.startsWith('text/') || ext === 'txt') return 'Text file';
  if (mime.startsWith('video/')) return 'Video';
  if (mime.startsWith('audio/')) return 'Audio';
  return ext && ext.length <= 5 && ext !== fileName.toLowerCase() ? `${ext.toUpperCase()} file` : 'File';
}

/**
 * WhatsApp-style check before an attachment goes out: a full-screen preview of the photo (or a card for any other file)
 * with Cancel and Send. Nothing is uploaded until Send is pressed; Cancel, the close button, hardware back and Escape
 * (web) all discard the pick.
 */
export function AttachmentPreview({ attachment, onCancel, onSend }: AttachmentPreviewProps) {
  if (!attachment) return null;
  // keyed so the "could not load" state starts fresh for every pick
  return <PreviewContent key={attachment.uri} attachment={attachment} onCancel={onCancel} onSend={onSend} />;
}

function PreviewContent({ attachment, onCancel, onSend }: { attachment: PickedAttachment; onCancel: () => void; onSend: () => void }) {
  const { colors } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const [failed, setFailed] = useState(false);
  const isImage = attachment.type === 'image' && !failed;

  // Web: the RN modal only hears Escape while focus is inside it, and the composer usually keeps focus.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <RNModal visible animationType="fade" onRequestClose={onCancel} statusBarTranslucent presentationStyle="overFullScreen" transparent={false}>
      <View style={{ flex: 1, backgroundColor: PREVIEW_BG }} testID="attachment-preview">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingTop: (insets?.top ?? 0) + spacing.sm,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <IconButton icon="x" variant="plain" color={PREVIEW_FG} accessibilityLabel="Close preview" onPress={onCancel} />
          <Text variant="bodyStrong" color={PREVIEW_FG} numberOfLines={1} style={{ flex: 1 }} testID="attachment-preview-name">
            {attachment.fileName}
          </Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
          {isImage ? (
            <Image
              source={{ uri: attachment.uri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              onError={() => setFailed(true)}
              accessibilityLabel="Photo to send"
              testID="attachment-preview-image"
            />
          ) : (
            <View style={{ alignItems: 'center', gap: spacing.md, maxWidth: 320 }} testID="attachment-preview-file">
              <View style={{ width: 112, height: 112, borderRadius: radii.xl, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="file-text" size={52} color={PREVIEW_FG} />
              </View>
              <Text variant="title3" color={PREVIEW_FG} align="center" numberOfLines={3}>
                {attachment.fileName}
              </Text>
              <Text variant="callout" color="#B5B5B5" align="center">
                {describeAttachment(attachment.fileName, attachment.mimeType)}
              </Text>
            </View>
          )}
        </View>

        <View
          style={{
            flexDirection: 'row',
            gap: spacing.md,
            paddingTop: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingBottom: Math.max(insets?.bottom ?? 0, spacing.md),
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flex: 1 }}>
            <Button title="Cancel" variant="secondary" fullWidth onPress={onCancel} testID="attachment-preview-cancel" />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Send" icon="send" fullWidth accessibilityLabel="Send attachment" onPress={onSend} testID="attachment-preview-send" />
          </View>
        </View>
      </View>
    </RNModal>
  );
}
