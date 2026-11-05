import React, { useMemo } from 'react';
import { View } from 'react-native';

import { Avatar, BottomSheet, Divider, Text } from '@/components/ui';
import { spacing } from '@/theme';
import { useOrgAdminContact, useStaffDirectory } from '../hooks/useStaffDirectory';
import type { PeerInfo } from '../hooks/useDirectConversation';
import { roleLabelOf } from '../utils/chatLists';

const DASH = '-';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg, paddingVertical: spacing.sm }}>
      <Text variant="callout" color="textMuted">
        {label}
      </Text>
      <Text variant="callout" weight="semibold" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

/** "View Contact": the other person's staff details ("-" for anything missing). */
export function ContactSheet({ visible, onClose, peer }: { visible: boolean; onClose: () => void; peer: PeerInfo }) {
  const staff = useStaffDirectory(visible);
  const admin = useOrgAdminContact(visible);
  const member = useMemo(() => {
    const fromStaff = staff.data?.find((s) => s.userId === peer.userId);
    if (fromStaff) return fromStaff;
    return admin.data && admin.data.userId === peer.userId ? admin.data : undefined;
  }, [staff.data, admin.data, peer.userId]);

  const subtitle = member?.department || peer.roleName || peer.deptName;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Contact" snap="auto" size="sm">
      <View style={{ alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.md }}>
        <Avatar uri={peer.photoUrl ?? member?.photoUrl} name={peer.name} size={72} />
        <Text variant="title3">{peer.name || DASH}</Text>
        {subtitle ? (
          <Text variant="callout" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Divider />
      <Row label="Emp ID" value={member?.empId || DASH} />
      <Row label="Mobile" value={member?.mobile || DASH} />
      <Row label="Email" value={member?.email || DASH} />
      <Row label="Department" value={member?.department || peer.deptName || DASH} />
      <Row label="Branch" value={member?.branch || peer.branchName || DASH} />
      <Row label="Role" value={member ? roleLabelOf(member) : peer.roleName || DASH} />
    </BottomSheet>
  );
}
