import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { systemApi } from '@/api';
import { Screen } from '@/components/layout';
import { Button, Card, Icon, Reveal, Text, TextField, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { useAppRouter } from '@/lib/navigation';
import { useSession } from '@/store/auth';
import { spacing } from '@/theme';

import { SUGGEST_MESSAGE_MAX, SUGGEST_REDIRECT_DELAY_MS, SUGGEST_SUBJECT_MAX, validateSuggestion } from '../utils/support';

const FAILED = 'Failed to send. Please try again.';

/** Feature suggestion form (subject ≤ 120, message ≤ 1000); returns to the previous screen after a successful send. */
export default function SuggestFeatureScreen() {
  const router = useAppRouter();
  const toast = useToast();
  const session = useSession();
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  const submit = async () => {
    if (submitting) return;
    const problem = validateSuggestion(subject, content);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSubmitting(true);
    try {
      await systemApi.submitFeatureSuggestion({
        orgId: session?.orgId ?? '',
        subject: subject.trim(),
        content: content.trim(),
        companyName: session?.orgName ?? '',
        userEmail: session?.email ?? '',
      });
      toast.success('Thank you! Your suggestion has been sent.');
      leaveTimer.current = setTimeout(() => router.back(), SUGGEST_REDIRECT_DELAY_MS);
    } catch (e) {
      toast.error(getErrorMessage(e, FAILED));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="Suggest a Feature"
      subtitle={session?.orgName || undefined}
      testID="suggest-screen"
      footer={<Button title={submitting ? 'Sending...' : 'Send Suggestion'} icon="send" fullWidth loading={submitting} onPress={() => void submit()} testID="suggest-submit" />}
    >
      <View style={{ gap: spacing.lg, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
        <Reveal index={0}>
          <Card variant="gradient">
            <View style={{ gap: spacing.sm }}>
              <Icon name="sparkles" size={26} color="onGradient" />
              <Text variant="title2" color="onGradient">
                Share Your Idea
              </Text>
              <Text color="onGradient" style={{ opacity: 0.9 }}>
                Help us build a better Clockyn. Your feedback shapes our roadmap.
              </Text>
            </View>
          </Card>
        </Reveal>
        <Reveal index={1}>
          <Card style={{ gap: spacing.lg }}>
            <TextField
              label="Subject"
              required
              value={subject}
              onChangeText={setSubject}
              placeholder="e.g. Add dark mode support"
              maxLength={SUGGEST_SUBJECT_MAX}
              testID="suggest-subject"
            />
            <TextField
              label="Message"
              required
              value={content}
              onChangeText={setContent}
              placeholder="Describe your idea or suggestion in detail..."
              multiline
              numberOfLines={6}
              maxLength={SUGGEST_MESSAGE_MAX}
              showCounter
              testID="suggest-message"
            />
          </Card>
        </Reveal>
      </View>
    </Screen>
  );
}
