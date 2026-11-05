import React from 'react';
import { View } from 'react-native';

import { Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';
import { counterWarn, MESSAGE_MAX, MESSAGE_WARN_AT, TITLE_MAX, TITLE_WARN_AT } from '../targets';

function Counter({ length, max, warnAt, testID }: { length: number; max: number; warnAt: number; testID?: string }) {
  return (
    <Text variant="caption" color={counterWarn(length, warnAt) ? 'warning' : 'textMuted'} align="right" testID={testID}>
      {`${length}/${max}`}
    </Text>
  );
}

export type ComposeFieldsProps = {
  title: string;
  message: string;
  onTitleChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  editable?: boolean;
};

/** Title (<= 100) and message (<= 1000) inputs with live counters that turn to the warning colour near the limit. */
export function ComposeFields({ title, message, onTitleChange, onMessageChange, editable = true }: ComposeFieldsProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <TextField
          label="Title"
          value={title}
          onChangeText={onTitleChange}
          placeholder="What's the announcement about?"
          maxLength={TITLE_MAX}
          editable={editable}
          testID="announcement-title"
        />
        <Counter length={title.length} max={TITLE_MAX} warnAt={TITLE_WARN_AT} testID="announcement-title-counter" />
      </View>
      <View style={{ gap: spacing.xs }}>
        <TextField
          label="Message"
          value={message}
          onChangeText={onMessageChange}
          placeholder="Write your announcement details here..."
          maxLength={MESSAGE_MAX}
          multiline
          numberOfLines={6}
          editable={editable}
          testID="announcement-message"
        />
        <Counter length={message.length} max={MESSAGE_MAX} warnAt={MESSAGE_WARN_AT} testID="announcement-message-counter" />
      </View>
    </View>
  );
}
