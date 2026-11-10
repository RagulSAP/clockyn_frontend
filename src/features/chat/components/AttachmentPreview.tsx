import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Modal as RNModal, Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Button, Icon, IconButton, Text } from '@/components/ui';
import { radii, spacing, useTheme } from '@/theme';

import type { PickedAttachment } from '../hooks/usePickAttachment';
import { canCropAttachment } from '../utils/cropImage';
import { AttachmentCrop } from './AttachmentCrop';
import { PreviewPill } from './CropControls';

/** The preview surface is always black / white (like the photo viewer), whatever the theme. */
const PREVIEW_BG = '#000000';
const PREVIEW_FG = '#FFFFFF';

export interface AttachmentPreviewProps {
  /** The picked photo / file; `null` hides the preview. */
  attachment: PickedAttachment | null;
  onCancel: () => void;
  onSend: () => void;
  /** Replaces the pending attachment (the cropped photo, or the original again). Without it there is no Crop button. */
  onChange?: (next: PickedAttachment) => void;
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
 * (web) all discard the pick. Photos can be cropped first (Crop): the cropped photo replaces the pick via `onChange`.
 */
export function AttachmentPreview({ attachment, onCancel, onSend, onChange }: AttachmentPreviewProps) {
  if (!attachment) return null;
  // Keyed by the pick, not by the file: a crop changes `uri` but must keep the modal (and a crop step) alive; the
  // "could not load" state is tracked per uri inside.
  return <PreviewContent key={(attachment.original ?? attachment).uri} attachment={attachment} onCancel={onCancel} onSend={onSend} onChange={onChange} />;
}

function PreviewContent({ attachment, onCancel, onSend, onChange }: { attachment: PickedAttachment; onCancel: () => void; onSend: () => void; onChange?: (next: PickedAttachment) => void }) {
  const { colors } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const failed = failedUri === attachment.uri;
  const isImage = attachment.type === 'image' && !failed;
  const canCrop = !!onChange && isImage && canCropAttachment(attachment);
  const inCrop = cropping && canCrop;

  // Escape / back inside the crop step only closes the crop step; otherwise it discards the pick.
  const dismiss = useCallback(() => {
    if (inCrop) setCropping(false);
    else onCancel();
  }, [inCrop, onCancel]);

  // Web: the RN modal only hears Escape while focus is inside it, and the composer usually keeps focus.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismiss]);

  return (
    <RNModal visible animationType="fade" onRequestClose={dismiss} statusBarTranslucent presentationStyle="overFullScreen" transparent={false}>
      <View style={{ flex: 1, backgroundColor: PREVIEW_BG }} testID="attachment-preview">
        {inCrop ? (
          <AttachmentCrop
            key={attachment.uri}
            attachment={attachment}
            onCancel={() => setCropping(false)}
            onApply={(next) => {
              setCropping(false);
              onChange?.(next);
            }}
            onResetToOriginal={() => attachment.original && onChange?.(attachment.original)}
          />
        ) : (
          <>
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
              {canCrop ? <PreviewPill label="Crop" icon="crop" accessibilityLabel="Crop photo" onPress={() => setCropping(true)} testID="attachment-preview-crop" /> : null}
            </View>

            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
              {isImage ? (
                <Image
                  source={{ uri: attachment.uri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="contain"
                  onError={() => setFailedUri(attachment.uri)}
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
          </>
        )}
      </View>
    </RNModal>
  );
}
