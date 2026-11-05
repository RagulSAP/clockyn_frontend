import React, { useMemo, useRef, useState } from 'react';
import { Keyboard, View } from 'react-native';

import { Button, Icon, SegmentedControl, Text, useToast } from '@/components/ui';
import { Screen, useBreakpoint } from '@/components/layout';
import { radii, spacing, useTheme } from '@/theme';
import { AnnouncementHistory } from '../components/AnnouncementHistory';
import { ComposeFields } from '../components/ComposeFields';
import { ComposeHistoryLayout, type AnnouncementTab } from '../components/ComposeHistoryLayout';
import { SelectionChip, StaffPickerModal } from '../components/StaffPickerModal';
import { SuccessDialog, useSuccessDialog } from '../components/SuccessDialog';
import { useAnnouncementAdmin, useAnnouncementHistory, useAnnouncementStaff, useSendAnnouncement } from '../hooks/useAdminAnnouncements';
import { chipLabel, isSendDisabled, sendLabel, successSubtitle, toCreateInput, toggleId, validateCompose, type ComposeAudience } from '../targets';

type Kind = 'all' | 'selected';

/** Admin: compose an announcement to ALL staff or selected staff, and review / delete the history. */
export default function AnnouncementsScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { isDesktop } = useBreakpoint();
  const { orgId, userId } = useAnnouncementAdmin();

  const [tab, setTab] = useState<AnnouncementTab>('compose');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  const history = useAnnouncementHistory();
  const staff = useAnnouncementStaff(kind === 'selected');
  const send = useSendAnnouncement();
  const success = useSuccessDialog();
  const inFlight = useRef(false); // a fast double tap fires twice before `isPending` re-renders

  const audience: ComposeAudience = kind === 'all' ? { kind: 'all' } : { kind: 'selected', userIds: selectedIds };
  const disabled = isSendDisabled(title, message, audience, send.isPending);
  const names = useMemo(() => new Map((staff.data ?? []).map((s) => [s.userId, s.name])), [staff.data]);

  const changeKind = (next: Kind) => {
    setKind(next);
    if (next === 'all') setSelectedIds([]);
    else setPickerOpen(true);
  };

  const changeTab = (next: AnnouncementTab) => {
    setTab(next);
    if (next === 'history') void history.refetch(); // reload on every entry (v1)
  };

  const handleSend = async () => {
    const problem = validateCompose(title, message, audience);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (inFlight.current) return;
    Keyboard.dismiss();
    const subtitle = successSubtitle(audience); // capture BEFORE the form resets
    inFlight.current = true;
    try {
      await send.mutateAsync(toCreateInput({ orgId, sentById: userId, title, message, audience }));
    } catch {
      return; // error toast already shown by the mutation
    } finally {
      inFlight.current = false;
    }
    setTitle('');
    setMessage('');
    setKind('all');
    setSelectedIds([]);
    success.show(subtitle);
  };

  const sendButton = (
    <Button
      title={sendLabel(audience)}
      icon="send"
      size="lg"
      fullWidth
      loading={send.isPending}
      disabled={disabled}
      onPress={() => void handleSend()}
      testID="announcement-send"
    />
  );

  const compose = (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="megaphone" size={22} color="primary" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title3">New Announcement</Text>
          <Text variant="caption" color="textMuted">
            Broadcast to your team
          </Text>
        </View>
      </View>

      <ComposeFields title={title} message={message} onTitleChange={setTitle} onMessageChange={setMessage} editable={!send.isPending} />

      <View style={{ gap: spacing.sm }}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          Send To
        </Text>
        <SegmentedControl<Kind>
          options={[
            { label: 'All Staff', value: 'all' },
            { label: 'Select Staff', value: 'selected' },
          ]}
          value={kind}
          onChange={changeKind}
          testID="announcement-target"
        />
      </View>

      {kind === 'selected' && selectedIds.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="callout" color="textSecondary" testID="announcement-selected-count">
              {`${selectedIds.length} ${selectedIds.length === 1 ? 'member' : 'members'} selected`}
            </Text>
            <Button title="Edit" variant="ghost" size="sm" onPress={() => setPickerOpen(true)} testID="announcement-edit-selection" />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {selectedIds.map((id) => (
              <SelectionChip key={id} label={chipLabel(names.get(id))} onRemove={() => setSelectedIds((cur) => toggleId(cur, id))} />
            ))}
          </View>
        </View>
      ) : null}

      {isDesktop ? sendButton : null}
    </View>
  );

  const historyNode = (
    <AnnouncementHistory
      items={history.data ?? []}
      loading={history.isLoading}
      error={history.error}
      onRetry={() => void history.refetch()}
      searchPlaceholder="Search announcements…"
      emptyHint="Compose your first announcement to notify your team"
      deleteMessage="This announcement will be permanently removed and staff will no longer see it."
      onCompose={() => changeTab('compose')}
    />
  );

  return (
    <Screen
      title="Announcement"
      large
      refreshing={history.isRefetching}
      onRefresh={() => void history.refetch()}
      footer={!isDesktop && tab === 'compose' ? sendButton : undefined}
      testID="announcements-screen"
    >
      <ComposeHistoryLayout tab={tab} onTabChange={changeTab} historyCount={(history.data ?? []).length} compose={compose} history={historyNode} />
      <StaffPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        staff={staff.data ?? []}
        loading={staff.isLoading}
        error={staff.error}
        onRetry={() => void staff.refetch()}
        selected={selectedIds}
        onChange={setSelectedIds}
      />
      <SuccessDialog subtitle={success.subtitle} onClose={success.hide} />
    </Screen>
  );
}
