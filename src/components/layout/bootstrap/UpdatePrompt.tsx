import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useQuery } from '@tanstack/react-query';

import { Button, Modal, Text } from '@/components/ui';
import { checkAppVersion, openStore, type UpdateInfo } from '@/lib/platform/appUpdate';
import { queryKeys } from '@/lib/query/queryKeys';
import { useTheme } from '@/theme';
import { shouldRunUpdateCheck, UPDATE_CHECK_MIN_INTERVAL_MS, updatePromptCopy } from './updateCopy';
import { useAppForeground } from './useAppForeground';

/**
 * App-update check (start + foreground, at most every 10 minutes) and its modal. Soft updates can be dismissed
 * ("Later" — they reappear on the next check, v1 behaviour); forced updates cannot. Store URLs come from the
 * backend answer or the env-configured fallback. Web has no store: the check resolves null and nothing shows.
 */
export function useAppUpdateCheck(): { info: UpdateInfo | null; dismiss: () => void } {
  const [dismissedAt, setDismissedAt] = useState(0);
  const query = useQuery({
    queryKey: queryKeys.system.version(),
    queryFn: () => checkAppVersion(), // resolves null (never throws) when not applicable or failed
    staleTime: UPDATE_CHECK_MIN_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const { data, dataUpdatedAt, refetch } = query;

  useAppForeground(() => {
    if (shouldRunUpdateCheck(dataUpdatedAt, Date.now())) void refetch();
  });

  // "Later" hides the prompt until the next check produces a new answer; a forced update cannot be dismissed.
  const info = data?.hasUpdate && (data.forceUpdate || dataUpdatedAt !== dismissedAt) ? data : null;
  const dismiss = useCallback(() => setDismissedAt(dataUpdatedAt), [dataUpdatedAt]);
  return { info, dismiss };
}

export function UpdatePrompt() {
  const { spacing } = useTheme();
  const { info, dismiss } = useAppUpdateCheck();
  if (!info) return null;
  const copy = updatePromptCopy(info);
  return (
    <Modal
      visible
      onClose={copy.dismissible ? dismiss : () => undefined}
      dismissible={copy.dismissible}
      title={copy.title}
      size="sm"
      testID="update-prompt"
      footer={
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {copy.secondaryLabel ? <Button title={copy.secondaryLabel} variant="secondary" onPress={dismiss} style={{ flex: 1 }} testID="update-later" /> : null}
          <Button title={copy.primaryLabel} onPress={() => void openStore(info.storeUrl)} style={{ flex: 1 }} testID="update-now" />
        </View>
      }
    >
      <Text variant="body" color="textSecondary">
        {copy.message}
      </Text>
      {info.latestVersion && info.latestVersion !== info.currentVersion ? (
        <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
          {`Version ${info.currentVersion} → ${info.latestVersion}`}
        </Text>
      ) : null}
    </Modal>
  );
}
