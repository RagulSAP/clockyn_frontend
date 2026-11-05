import React from 'react';
import { FlatList, View } from 'react-native';

import { Avatar, Badge, BottomSheet, EmptyState, ErrorState, Icon, SkeletonList, Text } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { useUserId } from '@/store/auth';
import { spacing } from '@/theme';
import type { GroupMember } from '@/types/api/groupChat';

/** Members of a group: name ("You" for me), Admin tag (creator), department, branch and role. */
export function MembersSheet({
  visible,
  onClose,
  members,
  loading,
  error,
  onRetry,
  groupName,
}: {
  visible: boolean;
  onClose: () => void;
  members: readonly GroupMember[];
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  groupName: string;
}) {
  const userId = useUserId();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={groupName || 'Members'} snap="tall" scrollable={false}>
      <Text variant="callout" color="textMuted" style={{ marginBottom: spacing.md }}>
        {`${members.length} members`}
      </Text>
      <View style={{ height: 380 }}>
        {loading && members.length === 0 ? (
          <SkeletonList count={4} />
        ) : error && members.length === 0 ? (
          <ErrorState compact message={getErrorMessage(error, 'Failed to load members')} onRetry={onRetry} />
        ) : (
          <FlatList
            data={members}
            keyExtractor={(m) => m.userId}
            ListEmptyComponent={<EmptyState compact icon="users" title="No members found" />}
            renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
                <Avatar name={item.name} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {item.userId === userId ? 'You' : item.name}
                    </Text>
                    {item.isAdmin ? <Badge label="Admin" tone="primary" size="sm" /> : null}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md }}>
                    {item.deptName ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="layers" size={12} color="textMuted" />
                        <Text variant="caption" color="textMuted">
                          {item.deptName}
                        </Text>
                      </View>
                    ) : null}
                    {item.branchName ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon name="building-2" size={12} color="textMuted" />
                        <Text variant="caption" color="textMuted">
                          {item.branchName}
                        </Text>
                      </View>
                    ) : null}
                    {item.roleName ? (
                      <Text variant="caption" color="textMuted">
                        {item.roleName}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </BottomSheet>
  );
}
