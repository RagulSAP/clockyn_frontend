import React, { useMemo, useState } from 'react';

import { BottomSheet, Button } from '@/components/ui';
import { useAsyncAction } from '@/hooks';
import { useUserId } from '@/store/auth';
import type { GroupMember } from '@/types/api/groupChat';
import { useStaffDirectory } from '../hooks/useStaffDirectory';
import { groupCandidates } from '../utils/chatLists';
import { StaffPickerList } from './StaffPickerList';

/** Add staff who are not in the group yet (any member may, as in v1). `onAdd` toasts its own result. */
export function AddStaffSheet({
  visible,
  onClose,
  members,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  members: readonly GroupMember[];
  onAdd: (staffIds: string[]) => Promise<boolean>;
}) {
  const userId = useUserId();
  const staff = useStaffDirectory(visible);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const close = () => {
    setSelected([]);
    setQuery('');
    onClose();
  };

  const candidates = useMemo(
    () => groupCandidates(staff.data ?? [], { selfId: userId, excludeIds: members.map((m) => m.userId), query }),
    [staff.data, userId, members, query],
  );

  const { run: add, loading } = useAsyncAction(async () => onAdd(selected), {
    silentError: true,
    onSuccess: (ok) => {
      if (ok) close();
    },
  });

  return (
    <BottomSheet
      visible={visible}
      onClose={close}
      title="Add Staff"
      snap="tall"
      footer={selected.length > 0 ? <Button title={`Add ${selected.length} Staff`} onPress={() => void add()} loading={loading} fullWidth /> : undefined}
    >
      <StaffPickerList
        candidates={candidates}
        selected={selected}
        onToggle={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Search staff…"
        loading={staff.isLoading}
        error={staff.isError ? staff.error : undefined}
        onRetry={() => void staff.refetch()}
        emptyTitle="All staff are already members"
        height={300}
      />
    </BottomSheet>
  );
}
