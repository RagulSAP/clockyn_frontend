import React, { useCallback, useContext, useState } from 'react';
import { Platform, TextInput, View, type TextInputKeyPressEvent } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { BottomSheet, IconButton, ListItem, Spinner } from '@/components/ui';
import { fontFamily, radii, spacing, typography, useTheme } from '@/theme';
import { usePickAttachment, type PickedAttachment } from '../hooks/usePickAttachment';
import { AttachmentPreview } from './AttachmentPreview';

export interface ComposerProps {
  onSend: (text: string) => void;
  /** A photo / file the person picked AND confirmed in the preview (Send). Nothing is passed on before that. */
  onAttach: (attachment: PickedAttachment) => void;
  /** An upload is running: camera / attach are disabled and attach shows a spinner. */
  uploading: boolean;
  /** Accent of the send button (group theme). */
  accent?: string;
  /** Background of the input field (group theme). */
  inputBackground?: string;
  autoFocus?: boolean;
}

/**
 * Message composer: text, camera, attach (photo library / document) and send. Empty text is never sent. A picked photo or
 * file first opens a preview (like WhatsApp) with Cancel and Send; only Send hands it to `onAttach`.
 */
export function Composer({ onSend, onAttach, uploading, accent, inputBackground, autoFocus }: ComposerProps) {
  const { colors } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const [text, setText] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const [pending, setPending] = useState<PickedAttachment | null>(null);
  const { pickPhoto, pickFile } = usePickAttachment();

  const pickFrom = useCallback(
    async (source: 'camera' | 'library' | 'file') => {
      const picked = source === 'file' ? await pickFile() : await pickPhoto(source);
      if (picked) setPending(picked);
    },
    [pickPhoto, pickFile],
  );
  const confirmAttachment = useCallback(() => {
    const picked = pending;
    setPending(null);
    if (picked) onAttach(picked);
  }, [pending, onAttach]);

  const submit = useCallback(() => {
    const value = text.trim();
    if (value === '') return;
    setText('');
    onSend(value);
  }, [text, onSend]);

  const onKeyPress = useCallback(
    (e: TextInputKeyPressEvent) => {
      if (Platform.OS !== 'web') return;
      const native = e.nativeEvent as { key: string; shiftKey?: boolean };
      if (native.key === 'Enter' && !native.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const canSend = text.trim() !== '';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: Math.max(insets?.bottom ?? 0, spacing.sm),
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      <IconButton icon="camera" variant="plain" accessibilityLabel="Take a photo" disabled={uploading} onPress={() => void pickFrom('camera')} />
      {uploading ? (
        <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Spinner />
        </View>
      ) : (
        <IconButton icon="paperclip" variant="plain" accessibilityLabel="Attach a file" onPress={() => setAttachOpen(true)} />
      )}
      <TextInput
        testID="chat-input"
        value={text}
        onChangeText={setText}
        placeholder="Type a message..."
        placeholderTextColor={colors.textMuted}
        multiline
        autoFocus={autoFocus}
        returnKeyType="send"
        submitBehavior="submit"
        onSubmitEditing={submit}
        onKeyPress={onKeyPress}
        accessibilityLabel="Message"
        style={[
          typography.body,
          {
            flex: 1,
            minHeight: 44,
            maxHeight: 140,
            borderRadius: radii.lg,
            paddingHorizontal: spacing.lg,
            paddingTop: Platform.OS === 'ios' ? 12 : 10,
            paddingBottom: Platform.OS === 'ios' ? 12 : 10,
            backgroundColor: inputBackground ?? colors.surfaceMuted,
            color: colors.text,
            fontFamily: fontFamily.regular,
          },
          Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
        ]}
      />
      <IconButton
        icon="send"
        variant="filled"
        accessibilityLabel="Send message"
        disabled={!canSend}
        onPress={submit}
        style={accent ? { backgroundColor: accent } : undefined}
      />

      <BottomSheet visible={attachOpen} onClose={() => setAttachOpen(false)} title="Attach" snap="auto" size="sm">
        <ListItem
          title="Photo library"
          icon="image"
          onPress={() => {
            setAttachOpen(false);
            void pickFrom('library');
          }}
        />
        <ListItem
          title="Document"
          icon="file-text"
          onPress={() => {
            setAttachOpen(false);
            void pickFrom('file');
          }}
        />
      </BottomSheet>

      <AttachmentPreview attachment={pending} onCancel={() => setPending(null)} onSend={confirmAttachment} />
    </View>
  );
}
