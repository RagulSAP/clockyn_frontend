import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { supportApi } from '@/api';
import { Screen, useBreakpoint } from '@/components/layout';
import { Button, Card, ErrorState, IconButton, ImageViewer, Reveal, Select, SectionHeader, SkeletonList, Text, TextField, useToast } from '@/components/ui';
import { useRefreshOnFocus } from '@/hooks';
import { getErrorMessage } from '@/lib/api/errors';
import { useAppRouter } from '@/lib/navigation';
import { MediaPermissionError, pickImage, type PickedImage } from '@/lib/platform/media';
import { queryKeys } from '@/lib/query/queryKeys';
import { useSession } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';

import { TicketCard } from '../components/TicketCard';
import { useSupportSubjects, useTickets } from '../hooks/useSupport';
import { TICKET_REDIRECT_DELAY_MS, ticketSubmitError, validateTicket } from '../utils/support';

/** Support: raise a ticket (subject, message, optional photo) and follow the organisation's tickets and reply threads. */
export default function SupportScreen() {
  const { colors } = useTheme();
  const router = useAppRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const session = useSession();
  const { isDesktop } = useBreakpoint();

  const subjects = useSupportSubjects();
  const tickets = useTickets();
  useRefreshOnFocus(tickets.refetch);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  const orgId = session?.orgId ?? '';
  const userId = session?.userId ?? '';
  const authorName = session?.name?.trim() || 'You';

  const choosePhoto = async () => {
    try {
      const picked = await pickImage({ source: 'library', quality: 0.7 });
      if (picked) setPhoto(picked);
    } catch (e) {
      toast.error(e instanceof MediaPermissionError ? 'Please allow photo library access.' : getErrorMessage(e, 'Could not pick the photo'));
    }
  };

  const submit = async () => {
    if (submitting) return;
    const problem = validateTicket(subject, message);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSubmitting(true);
    try {
      await supportApi.submitTicket({
        userId,
        orgId,
        subject,
        message: message.trim(),
        photo: photo ? { uri: photo.uri, fileName: photo.fileName, mimeType: photo.mimeType } : null,
      });
      toast.success('Support request submitted!');
      setSubject('');
      setMessage('');
      setPhoto(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.support.requests(orgId) });
      leaveTimer.current = setTimeout(() => router.back(), TICKET_REDIRECT_DELAY_MS);
    } catch (e) {
      toast.error(ticketSubmitError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async (ticketId: string) => {
    const text = (drafts[ticketId] ?? '').trim();
    if (text === '' || sendingId !== null) return;
    setSendingId(ticketId);
    try {
      await supportApi.replyToTicket(ticketId, { text, authorName, isAdmin: false });
      setDrafts((d) => ({ ...d, [ticketId]: '' }));
      toast.success('Reply sent!');
      await tickets.refetch();
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to send reply'));
    } finally {
      setSendingId(null);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([tickets.refetch(), subjects.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [tickets, subjects]);

  const subjectOptions = (subjects.data ?? []).map((s) => ({ label: s.name, value: s.name }));
  const list = tickets.data ?? [];

  const form = (
    <Card style={{ gap: spacing.lg }} testID="support-form">
      <Select
        label="Subject"
        required
        value={subject || null}
        options={subjectOptions}
        onChange={setSubject}
        placeholder="Select a subject"
        hint={subjects.isError ? 'Could not load subjects. Pull down to retry.' : undefined}
        testID="support-subject"
      />
      <TextField
        label="Message"
        required
        value={message}
        onChangeText={setMessage}
        placeholder="Describe your issue or question..."
        multiline
        numberOfLines={5}
        testID="support-message"
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          Attach Photo (optional)
        </Text>
        {photo ? (
          <View testID="support-photo-preview">
            <Image source={{ uri: photo.uri }} style={{ height: 180, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }} resizeMode="cover" />
            <View style={{ position: 'absolute', top: spacing.sm, right: spacing.sm }}>
              <IconButton icon="x" variant="filled" size="sm" accessibilityLabel="Remove photo" onPress={() => setPhoto(null)} testID="support-photo-remove" />
            </View>
          </View>
        ) : (
          <Button title="Upload Photo" variant="secondary" icon="image-plus" onPress={() => void choosePhoto()} testID="support-photo-add" />
        )}
      </View>
      <Button title="Submit Request" icon="send" fullWidth loading={submitting} onPress={() => void submit()} testID="support-submit" />
    </Card>
  );

  const hideTickets = !tickets.isLoading && !tickets.isError && list.length === 0;
  const ticketList = hideTickets ? null : (
    <Reveal index={1} style={{ gap: spacing.md, flex: isDesktop ? 1 : undefined, width: '100%' }}>
      <SectionHeader title="My Tickets" />
      {tickets.isLoading ? (
        <SkeletonList count={2} />
      ) : tickets.isError && !tickets.data ? (
        <ErrorState message={getErrorMessage(tickets.error, 'Could not load your tickets.')} onRetry={() => void tickets.refetch()} compact />
      ) : (
        list.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            draft={drafts[t.id] ?? ''}
            sending={sendingId === t.id}
            onDraftChange={(text) => setDrafts((d) => ({ ...d, [t.id]: text }))}
            onSend={() => void sendReply(t.id)}
            onOpenPhoto={setViewerUri}
          />
        ))
      )}
    </Reveal>
  );

  return (
    <Screen title="Support" subtitle="We're here to help" refreshing={refreshing} onRefresh={onRefresh} testID="support-screen">
      <View style={{ flexDirection: isDesktop ? 'row' : 'column', gap: spacing.xl, alignItems: 'flex-start' }}>
        <Reveal index={0} style={{ flex: isDesktop ? 1 : undefined, width: '100%' }}>
          {form}
        </Reveal>
        {ticketList}
      </View>
      <ImageViewer visible={viewerUri !== null} uri={viewerUri ?? ''} onClose={() => setViewerUri(null)} />
    </Screen>
  );
}
