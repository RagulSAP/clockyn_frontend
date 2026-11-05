import React, { useCallback, useContext, useState } from 'react';
import { Platform, TextInput, View, type TextInputKeyPressEvent } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { BottomSheet, IconButton, ListItem, Spinner } from '@/components/ui';
import { fontFamily, radii, spacing, typography, useTheme } from '@/theme';

export interface ComposerProps {
  onSend: (text: string) => void;
  onPhoto: (source: 'camera' | 'library') => void;
  onFile: () => void;
  /** An upload is running: camera / attach are disabled and attach shows a spinner. */
  uploading: boolean;
  /** Accent of the send button (group theme). */
  accent?: string;
  /** Background of the input field (group theme). */
  inputBackground?: string;
  autoFocus?: boolean;
}

/** Message composer: text, camera, attach (photo library / document) and send. Empty text is never sent. */
export function Composer({ onSend, onPhoto, onFile, uploading, accent, inputBackground, autoFocus }: ComposerProps) {
  const { colors } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const [text, setText] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);

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
      <IconButton icon="camera" variant="plain" accessibilityLabel="Take a photo" disabled={uploading} onPress={() => onPhoto('camera')} />
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
            onPhoto('library');
          }}
        />
        <ListItem
          title="Document"
          icon="file-text"
          onPress={() => {
            setAttachOpen(false);
            onFile();
          }}
        />
      </BottomSheet>
    </View>
  );
}
