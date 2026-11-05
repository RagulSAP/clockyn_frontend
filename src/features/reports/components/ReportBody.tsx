import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme';
import { EmptyState, ErrorState, Spinner, Text, type IconName } from '@/components/ui';

export interface ReportBodyProps {
  loading: boolean;
  loadingText?: string;
  error?: string | null;
  onRetry?: () => void;
  empty?: { icon?: IconName; title: string; message?: string } | null;
  children?: React.ReactNode;
}

/** Loading (spinner + caption) → error (retry) → empty → content. */
export function ReportBody({ loading, loadingText = 'Loading...', error, onRetry, empty, children }: ReportBodyProps) {
  if (loading) {
    return (
      <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.huge }} testID="report-loading">
        <Spinner size="large" />
        <Text variant="callout" color="textSecondary">
          {loadingText}
        </Text>
      </View>
    );
  }
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState icon={empty.icon} title={empty.title} message={empty.message} />;
  return <>{children}</>;
}
