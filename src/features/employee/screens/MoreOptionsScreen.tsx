import React, { useState } from 'react';
import { View } from 'react-native';

import { companyApi } from '@/api';
import { Screen } from '@/components/layout';
import { Card, Icon, Text, useConfirm, useToast } from '@/components/ui';
import { getErrorMessage, isApiError } from '@/lib/api/errors';
import { useSession, signOut } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';

/** Delay between the "deleted" toast and the sign-out redirect (v1: 1.5 s). */
export const DELETE_REDIRECT_MS = 1500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Toast text of a failed deletion (v1 copy): the server refused (HTTP / business error) -> its message, else
 * "Failed to delete account"; no response at all (offline, timeout, unexpected exception) -> "Error deleting account".
 */
export function deleteFailureMessage(e: unknown): string {
  if (isApiError(e) && !e.isNetwork) return getErrorMessage(e, 'Failed to delete account');
  return 'Error deleting account';
}

/** More options: permanently delete the signed-in account. */
export default function MoreOptionsScreen() {
  const { colors } = useTheme();
  const confirm = useConfirm();
  const toast = useToast();
  const session = useSession();
  const [busy, setBusy] = useState(false);

  const onDelete = async () => {
    if (busy || !session) return;
    const ok = await confirm({
      title: 'Delete Account?',
      message: 'This will permanently delete your account and all associated data. This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await companyApi.deleteAccount(session.userId);
      toast.success('Account deleted successfully');
      await sleep(DELETE_REDIRECT_MS);
      // Guards redirect to the welcome screen once the session is cleared.
      await signOut({ reason: 'deleted' });
    } catch (e) {
      toast.error(deleteFailureMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="More Options" testID="more-screen">
      <Card
        onPress={() => void onDelete()}
        disabled={busy}
        testID="delete-account"
        accessibilityLabel="Delete My Account"
        style={{ backgroundColor: colors.dangerSoft }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trash" size={22} color="danger" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyStrong" color="danger">
              Delete My Account
            </Text>
            <Text variant="caption" color="textSecondary">
              Permanently remove your account &amp; data
            </Text>
          </View>
        </View>
      </Card>
    </Screen>
  );
}
