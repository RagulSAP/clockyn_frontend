import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';

import { systemApi } from '@/api';
import { Screen } from '@/components/layout';
import { Button, Card, ListItem, Reveal, useConfirm, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { patchSession, signOut, useSession } from '@/store/auth';
import { radii, spacing } from '@/theme';

import { PrivacyPolicyView } from '../components/PrivacyPolicyView';
import { submitDeletionRequest } from '../utils/accountDeletion';

type MoreView = 'menu' | 'privacy';

/**
 * More options → Privacy Policy (embedded page) → "Request Account Deletion". The deletion is a REQUEST processed by
 * the support team; after it is sent the session is marked inactive and the user is signed out.
 */
export default function MoreOptionsScreen() {
  const toast = useToast();
  const confirm = useConfirm();
  const session = useSession();
  const [view, setView] = useState<MoreView>('menu');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Android hardware back: privacy → menu, then the normal route back.
  useEffect(() => {
    if (view !== 'privacy') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setView('menu');
      return true;
    });
    return () => sub.remove();
  }, [view]);

  const requestDeletion = useCallback(async () => {
    if (submitting || submitted || !session) return;
    const ok = await confirm({
      title: 'Request Account Deletion',
      message: 'Your deletion request will be sent to the admin. Once reviewed, all your data will be permanently deleted.',
      confirmText: 'Submit Request',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    setSubmitting(true);
    try {
      const message = await submitDeletionRequest(session.userId, {
        requestDeletion: systemApi.requestAccountDeletion,
        patchSession,
        signOut,
      });
      setSubmitted(true);
      toast.success(message);
    } catch (e) {
      toast.error(getErrorMessage(e, 'Failed to submit request'));
    } finally {
      setSubmitting(false);
    }
  }, [submitting, submitted, session, confirm, toast]);

  if (view === 'privacy') {
    return (
      <Screen
        title="Privacy Policy"
        subtitle={session?.orgName || undefined}
        scroll={false}
        onBack={() => setView('menu')}
        testID="privacy-screen"
        footer={
          <View style={{ gap: spacing.sm }}>
            <Button
              title="Request Account Deletion"
              variant="danger"
              icon="trash"
              fullWidth
              loading={submitting}
              disabled={submitted}
              onPress={() => void requestDeletion()}
              testID="request-deletion"
            />
            <Button title="I Understand, Go Back" variant="secondary" fullWidth onPress={() => setView('menu')} testID="privacy-back" />
          </View>
        }
      >
        <PrivacyPolicyView />
      </Screen>
    );
  }

  return (
    <Screen title="More Options" subtitle={session?.orgName || undefined} testID="more-screen">
      <Reveal>
        <Card padding={0}>
          <View style={{ borderRadius: radii.lg, overflow: 'hidden' }}>
            <ListItem icon="shield-check" title="Privacy Policy" subtitle="View our privacy policy" onPress={() => setView('privacy')} testID="open-privacy" />
          </View>
        </Card>
      </Reveal>
    </Screen>
  );
}
