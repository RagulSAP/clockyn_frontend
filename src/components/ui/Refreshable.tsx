import React from 'react';
import { FlatList, RefreshControl, ScrollView, type FlatListProps, type ScrollViewProps } from 'react-native';
import { useTheme } from '@/theme';

type RefreshProps = {
  refreshing: boolean;
  onRefresh: () => void;
};

function useRefreshControl({ refreshing, onRefresh }: RefreshProps) {
  const { colors } = useTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  );
}

export type RefreshableScrollProps = ScrollViewProps & RefreshProps;

/**
 * ScrollView with pull-to-refresh. react-native-web renders `RefreshControl` as a no-op, so on web this is a
 * plain ScrollView; expose a refresh button there (`Screen` does this automatically when `onRefresh` is set).
 */
export function RefreshableScroll({ refreshing, onRefresh, children, ...rest }: RefreshableScrollProps) {
  const control = useRefreshControl({ refreshing, onRefresh });
  return (
    <ScrollView keyboardShouldPersistTaps="handled" {...rest} refreshControl={control}>
      {children}
    </ScrollView>
  );
}

export type RefreshableListProps<T> = FlatListProps<T> & RefreshProps;

/** FlatList with pull-to-refresh (see RefreshableScroll for the web note). */
export function RefreshableList<T>({ refreshing, onRefresh, ...rest }: RefreshableListProps<T>) {
  const control = useRefreshControl({ refreshing, onRefresh });
  return <FlatList keyboardShouldPersistTaps="handled" {...rest} refreshControl={control} />;
}
