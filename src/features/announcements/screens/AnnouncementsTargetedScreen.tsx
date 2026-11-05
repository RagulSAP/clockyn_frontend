import React, { useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';

import { filterTargeted } from '@/api/announcements';
import { Button, EmptyState, ErrorState, Icon, SegmentedControl, Skeleton, Text, useToast, type IconName } from '@/components/ui';
import { Screen, useBreakpoint } from '@/components/layout';
import { getErrorMessage } from '@/lib/api/errors';
import { radii, spacing, useTheme } from '@/theme';
import { AnnouncementHistory } from '../components/AnnouncementHistory';
import { ComposeFields } from '../components/ComposeFields';
import { ComposeHistoryLayout, type AnnouncementTab } from '../components/ComposeHistoryLayout';
import { SuccessDialog, useSuccessDialog } from '../components/SuccessDialog';
import { useAnnouncementAdmin, useAnnouncementHistory, useBranchDeptOptions, useSendAnnouncement } from '../hooks/useAdminAnnouncements';
import { isSendDisabled, sendLabel, successSubtitle, toCreateInput, validateCompose, type ComposeAudience } from '../targets';

type Kind = 'branch' | 'dept';

type Option = { id: string; name: string };

function OptionPills({ options, selectedId, icon, onToggle }: { options: Option[]; selectedId: string | null; icon: IconName; onToggle: (id: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map((o) => {
        const active = o.id === selectedId;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.name}
            onPress={() => onToggle(o.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingVertical: spacing.sm + 2,
              paddingHorizontal: spacing.lg,
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primary : colors.surface,
            }}
            testID={`target-option-${o.id}`}
          >
            <Icon name={icon} size={16} color={active ? 'onPrimary' : 'textSecondary'} />
            <Text variant="callout" weight="semibold" color={active ? 'onPrimary' : 'text'}>
              {o.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Admin: send an announcement to ONE branch or ONE department, and review / delete those announcements. */
export default function AnnouncementsTargetedScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { isDesktop } = useBreakpoint();
  const { orgId, userId } = useAnnouncementAdmin();

  const [tab, setTab] = useState<AnnouncementTab>('compose');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [kind, setKind] = useState<Kind>('branch');
  const [branchId, setBranchId] = useState<string | null>(null);
  const [deptId, setDeptId] = useState<string | null>(null);

  const history = useAnnouncementHistory();
  const { branches, departments } = useBranchDeptOptions();
  const send = useSendAnnouncement();
  const success = useSuccessDialog();
  const inFlight = useRef(false); // a fast double tap fires twice before `isPending` re-renders

  const branchOptions = useMemo<Option[]>(() => (branches.data ?? []).map((b) => ({ id: b.id, name: b.name })), [branches.data]);
  const deptOptions = useMemo<Option[]>(() => (departments.data ?? []).map((d) => ({ id: d.id, name: d.name })), [departments.data]);
  const branchName = branchOptions.find((o) => o.id === branchId)?.name;
  const deptName = deptOptions.find((o) => o.id === deptId)?.name;
  const items = useMemo(() => filterTargeted(history.data ?? []), [history.data]);

  const audience: ComposeAudience = kind === 'branch' ? { kind: 'branch', branchId } : { kind: 'dept', deptId };
  const names = { branchName, deptName };
  const disabled = isSendDisabled(title, message, audience, send.isPending);

  const changeKind = (next: Kind) => {
    setKind(next);
    // Exactly one of branch / department: the other choice is cleared (title and message are kept).
    if (next === 'branch') setDeptId(null);
    else setBranchId(null);
  };

  const changeTab = (next: AnnouncementTab) => {
    setTab(next);
    if (next === 'history') void history.refetch();
  };

  const handleSend = async () => {
    const problem = validateCompose(title, message, audience);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (inFlight.current) return;
    Keyboard.dismiss();
    const subtitle = successSubtitle(audience, names); // capture BEFORE the selection resets
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
    setBranchId(null);
    setDeptId(null);
    success.show(subtitle);
  };

  const sendButton = (
    <Button title={sendLabel(audience, names)} icon="send" size="lg" fullWidth loading={send.isPending} disabled={disabled} onPress={() => void handleSend()} testID="announcement-send" />
  );

  const query = kind === 'branch' ? branches : departments;
  const options = kind === 'branch' ? branchOptions : deptOptions;
  const selectedId = kind === 'branch' ? branchId : deptId;
  const selectedName = kind === 'branch' ? branchName : deptName;

  let picker: React.ReactNode;
  if (query.isLoading) {
    picker = (
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Skeleton width={110} height={36} radius={radii.pill} />
        <Skeleton width={90} height={36} radius={radii.pill} />
        <Skeleton width={130} height={36} radius={radii.pill} />
      </View>
    );
  } else if (query.isError && options.length === 0) {
    picker = (
      <ErrorState
        compact
        message={getErrorMessage(query.error, kind === 'branch' ? 'Failed to load branches' : 'Failed to load departments')}
        onRetry={() => void query.refetch()}
      />
    );
  } else if (options.length === 0) {
    picker = <EmptyState compact icon={kind === 'branch' ? 'building' : 'layers'} title={kind === 'branch' ? 'No branches found' : 'No departments found'} />;
  } else {
    const setter = kind === 'branch' ? setBranchId : setDeptId;
    picker = (
      <OptionPills
        options={options}
        selectedId={selectedId}
        icon={kind === 'branch' ? 'building' : 'layers'}
        onToggle={(id) => setter((cur) => (cur === id ? null : id))} // tap again to deselect (v1 could not)
      />
    );
  }

  const compose = (
    <View style={{ gap: spacing.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="building" size={22} color="primary" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title3">Targeted Announcement</Text>
          <Text variant="caption" color="textMuted">
            Send to a specific branch or department
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          Target Type
        </Text>
        <SegmentedControl<Kind>
          options={[
            { label: 'Branch', value: 'branch' },
            { label: 'Department', value: 'dept' },
          ]}
          value={kind}
          onChange={changeKind}
          testID="announcement-target"
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="callout" weight="semibold" color="textSecondary">
          {kind === 'branch' ? 'Select Branch' : 'Select Department'}
        </Text>
        {picker}
        {selectedName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }} testID="announcement-sending-to">
            <Icon name="check-circle" size={16} color="success" />
            <Text variant="callout" color="textSecondary">
              Sending to:{' '}
              <Text variant="callout" weight="bold">
                {selectedName}
              </Text>
            </Text>
          </View>
        ) : null}
      </View>

      <ComposeFields title={title} message={message} onTitleChange={setTitle} onMessageChange={setMessage} editable={!send.isPending} />

      {isDesktop ? sendButton : null}
    </View>
  );

  const historyNode = (
    <AnnouncementHistory
      items={items}
      loading={history.isLoading}
      error={history.error}
      onRetry={() => void history.refetch()}
      searchPlaceholder="Search by title, branch, dept…"
      searchNames
      emptyHint="Send your first branch or department announcement"
      deleteMessage="This announcement will be permanently removed."
      onCompose={() => changeTab('compose')}
    />
  );

  return (
    <Screen
      title="Branch & Dept"
      large
      refreshing={history.isRefetching}
      onRefresh={() => void history.refetch()}
      footer={!isDesktop && tab === 'compose' ? sendButton : undefined}
      testID="announcements-targeted-screen"
    >
      <ComposeHistoryLayout tab={tab} onTabChange={changeTab} historyCount={items.length} compose={compose} history={historyNode} />
      <SuccessDialog subtitle={success.subtitle} onClose={success.hide} />
    </Screen>
  );
}
