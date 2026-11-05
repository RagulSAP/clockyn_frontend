import React from 'react';
import { Image, Pressable, View } from 'react-native';

import { Badge, Card, IconButton, Text, TextField } from '@/components/ui';
import { formatDate, formatDateTime } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';
import type { SupportTicket } from '@/types/api/support';

import { TICKET_STATUS_LABEL, TICKET_STATUS_TONE, replyAuthorLabel } from '../utils/support';

export type TicketCardProps = {
  ticket: SupportTicket;
  draft: string;
  sending: boolean;
  onDraftChange: (text: string) => void;
  onSend: () => void;
  onOpenPhoto: (uri: string) => void;
};

/** A ticket: subject, status, message, optional photo, the reply thread and a reply box (replying reopens resolved tickets). */
export function TicketCard({ ticket, draft, sending, onDraftChange, onSend, onOpenPhoto }: TicketCardProps) {
  const { colors } = useTheme();
  const resolved = ticket.status === 'resolved';
  const canSend = !sending && draft.trim() !== '';

  return (
    <Card
      variant="outlined"
      testID={`ticket-${ticket.id}`}
      style={{ gap: spacing.md, borderColor: resolved ? colors.success : colors.border, backgroundColor: resolved ? colors.successSoft : colors.surface }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <Text variant="bodyStrong" style={{ flex: 1 }}>
          {ticket.subject}
        </Text>
        <Badge label={TICKET_STATUS_LABEL[ticket.status]} tone={TICKET_STATUS_TONE[ticket.status]} testID={`ticket-status-${ticket.id}`} />
      </View>
      <Text color="textSecondary">{ticket.message}</Text>
      {ticket.photoUrl ? (
        <Pressable onPress={() => onOpenPhoto(ticket.photoUrl as string)} accessibilityRole="imagebutton" accessibilityLabel="Open attached photo">
          <Image source={{ uri: ticket.photoUrl }} style={{ height: 140, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }} resizeMode="cover" />
        </Pressable>
      ) : null}
      <Text variant="caption" color="textMuted">
        {formatDate(ticket.createdAt)}
      </Text>

      {ticket.replies.length > 0 ? (
        <View style={{ gap: spacing.sm }} testID={`thread-${ticket.id}`}>
          {ticket.replies.map((r, i) => (
            <View
              key={`${i}-${r.createdAt ?? ''}`}
              style={{
                padding: spacing.md,
                borderRadius: radii.md,
                gap: 2,
                backgroundColor: r.isAdmin ? colors.surfaceMuted : 'transparent',
                borderWidth: 1,
                borderColor: r.isAdmin ? colors.borderStrong : colors.border,
              }}
            >
              <Text variant="caption" weight="semibold" color={r.isAdmin ? 'text' : 'textSecondary'}>
                {replyAuthorLabel(r)}
                {r.createdAt ? `  ·  ${formatDateTime(r.createdAt)}` : ''}
              </Text>
              <Text variant="callout">{r.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField
            value={draft}
            onChangeText={onDraftChange}
            placeholder={resolved ? 'Reply to reopen this ticket...' : 'Type a reply...'}
            multiline
            numberOfLines={2}
            accessibilityLabel="Reply"
            testID={`reply-input-${ticket.id}`}
          />
        </View>
        <IconButton icon="send" variant="filled" accessibilityLabel="Send reply" disabled={!canSend} onPress={onSend} testID={`reply-send-${ticket.id}`} />
      </View>
    </Card>
  );
}
