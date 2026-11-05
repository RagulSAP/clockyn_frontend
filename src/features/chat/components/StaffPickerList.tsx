import React from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Avatar, CheckboxMark, EmptyState, ErrorState, SearchBar, SkeletonList, Text } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { radii, spacing, useTheme } from '@/theme';
import type { StaffMember } from '@/types/api/staff';
import { joinParts } from '../utils/format';

export interface StaffPickerListProps {
  candidates: StaffMember[];
  selected: readonly string[];
  onToggle: (userId: string) => void;
  query: string;
  onQueryChange: (q: string) => void;
  searchPlaceholder: string;
  loading: boolean;
  /** The staff list failed to load (shown instead of a misleading empty list, with a retry). */
  error?: unknown;
  onRetry?: () => void;
  emptyTitle: string;
  emptyMessage?: string;
  /** Height of the list area (the picker lives in a sheet). */
  height?: number;
}

/** Searchable multi-select of staff, shared by "Create group" and "Add staff". */
export function StaffPickerList({
  candidates,
  selected,
  onToggle,
  query,
  onQueryChange,
  searchPlaceholder,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyMessage,
  height = 320,
}: StaffPickerListProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <SearchBar value={query} onChangeText={onQueryChange} placeholder={searchPlaceholder} />
      <View style={{ height }}>
        {loading ? (
          <SkeletonList count={4} />
        ) : error && candidates.length === 0 ? (
          <ErrorState compact message={getErrorMessage(error, 'Failed to load staff')} onRetry={onRetry} />
        ) : (
          <FlatList
            data={candidates}
            keyExtractor={(s) => s.userId}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<EmptyState compact icon="users" title={emptyTitle} message={emptyMessage} />}
            renderItem={({ item }) => {
              const checked = selected.includes(item.userId);
              return (
                <Pressable
                  testID={`staff-pick-${item.userId}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={item.name}
                  onPress={() => onToggle(item.userId)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radii.sm,
                    backgroundColor: pressed || checked ? colors.surfaceMuted : 'transparent',
                  })}
                >
                  <Avatar uri={item.photoUrl} name={item.name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text variant="caption" color="textMuted" numberOfLines={1}>
                      {joinParts(item.department, item.branch) || 'Staff'}
                    </Text>
                  </View>
                  <CheckboxMark checked={checked} />
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}
