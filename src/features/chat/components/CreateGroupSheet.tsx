import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { groupChatApi } from '@/api';
import { Avatar, BottomSheet, Button, Icon, Text, TextField } from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useUserId } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';
import type { GroupSummary } from '@/types/api/groupChat';
import { useStaffDirectory } from '../hooks/useStaffDirectory';
import { groupCandidates } from '../utils/chatLists';
import { StaffPickerList } from './StaffPickerList';

export const GROUP_NAME_MAX = 50;

/** Admin: create a group — a name (max 50) and at least one staff member; the API adds the creator. */
export function CreateGroupSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated?: (g: GroupSummary) => void }) {
  const { colors } = useTheme();
  const userId = useUserId();
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const staff = useStaffDirectory(visible);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const close = () => {
    setName('');
    setSelected([]);
    setQuery('');
    onClose();
  };

  const candidates = useMemo(() => groupCandidates(staff.data ?? [], { selfId: userId, query }), [staff.data, userId, query]);
  const selectedStaff = useMemo(() => (staff.data ?? []).filter((s) => selected.includes(s.userId)), [staff.data, selected]);

  const { run: create, loading } = useAsyncAction(
    () => groupChatApi.createGroup({ name, createdBy: userId, memberIds: selected, orgId }),
    {
      successMessage: 'Group created!',
      errorMessage: 'Failed to create group',
      onSuccess: async (group) => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.groupChat.list(userId, orgId) });
        close();
        onCreated?.(group);
      },
    },
  );

  const trimmed = name.trim();
  const canCreate = trimmed !== '' && selected.length > 0 && !loading;
  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title="Create Group"
      snap="tall"
      scrollable
      footer={<Button testID="create-group-submit" title="Create" onPress={() => void create()} loading={loading} disabled={!canCreate} fullWidth />}
    >
      <View style={{ gap: spacing.lg }}>
        <TextField label="Group name" value={name} onChangeText={setName} placeholder="Group name" maxLength={GROUP_NAME_MAX} showCounter autoFocus />
        {selectedStaff.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text variant="callout" color="textSecondary">
              {`${selectedStaff.length} member${selectedStaff.length === 1 ? '' : 's'} selected`}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {selectedStaff.map((s) => (
                <Pressable
                  key={s.userId}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${s.name}`}
                  onPress={() => toggle(s.userId)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.primarySoft, borderRadius: radii.pill, paddingVertical: 4, paddingLeft: 4, paddingRight: spacing.sm }}
                >
                  <Avatar uri={s.photoUrl} name={s.name} size={24} />
                  <Text variant="caption" weight="semibold" color="primary">
                    {s.name.split(' ')[0]}
                  </Text>
                  <Icon name="x" size={14} color="primary" />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <StaffPickerList
          candidates={candidates}
          selected={selected}
          onToggle={toggle}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search staff to add…"
          loading={staff.isLoading}
          error={staff.isError ? staff.error : undefined}
          onRetry={() => void staff.refetch()}
          emptyTitle="No staff found"
          height={260}
        />
      </View>
    </BottomSheet>
  );
}
