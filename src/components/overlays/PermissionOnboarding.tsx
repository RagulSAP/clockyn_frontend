import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Icon, IconButton, Modal, Text, type IconName } from '@/components/ui';
import { requestPermission } from '@/lib/platform/permissions';
import { radii, spacing, useTheme } from '@/theme';
import { ONBOARDING_FEATURE_CHIPS, ONBOARDING_INTRO, ONBOARDING_STEPS, type OnboardingRole } from './permissionCopy';

export type PermissionOnboardingProps = {
  visible: boolean;
  role: OnboardingRole;
  /** Finished or skipped (exactly once per showing). The parent persists "done" — see `usePermissionOnboarding`. */
  onComplete: () => void;
};

const INTRO = -1;

function ProgressDots({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs + 2, justifyContent: 'center' }} accessibilityLabel={`Step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            height: 8,
            width: i === current ? 32 : 8,
            borderRadius: radii.pill,
            backgroundColor: i <= current ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );
}

function IconBubble({ icon }: { icon: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={40} color="primary" />
    </View>
  );
}

/**
 * One-time explanatory intro to the four permissions (v1 flow): intro screen, then Location / Camera /
 * Notifications / Photo Library. Only Notifications is requested here (`requiresUpfront`); the others are asked at
 * the point of use. Skippable at any step; "Enable Notifications" always advances, granted or not.
 * Android back / Esc are intentionally swallowed (use Skip) so a stray tap never marks it completed.
 */
export function PermissionOnboarding({ visible, role, onComplete }: PermissionOnboardingProps) {
  const { colors } = useTheme();
  const [step, setStep] = useState(INTRO);
  const [busy, setBusy] = useState(false);
  const completed = useRef(false);
  const total = ONBOARDING_STEPS.length;

  // Every showing starts from the intro (v1 kept the last step) — adjusting state during render, not in an effect.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setStep(INTRO);
      setBusy(false);
    }
  }
  useEffect(() => {
    if (visible) completed.current = false;
  }, [visible]);

  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  }, [onComplete]);

  const advance = useCallback(() => {
    if (step >= total - 1) finish();
    else setStep((s) => s + 1);
  }, [step, total, finish]);

  const current = step >= 0 ? ONBOARDING_STEPS[step] : null;

  const primary = useCallback(async () => {
    if (!current) {
      setStep(0);
      return;
    }
    if (current.requiresUpfront) {
      setBusy(true);
      try {
        await requestPermission(current.kind);
      } catch {
        /* a failed request is treated like a denial — the flow continues */
      } finally {
        setBusy(false);
      }
    }
    advance();
  }, [current, advance]);

  const isLast = step === total - 1;
  const primaryTitle = !current ? 'Continue' : current.requiresUpfront ? 'Enable Notifications' : isLast ? 'Finish' : 'Next';

  const footer = (
    <View style={{ gap: spacing.sm }}>
      <Button
        title={primaryTitle}
        icon={current?.requiresUpfront ? 'bell' : undefined}
        onPress={() => void primary()}
        loading={busy}
        fullWidth
        testID="onboarding-primary"
      />
      {!current ? (
        <Button title="Skip Now" variant="ghost" onPress={finish} fullWidth testID="onboarding-skip-now" />
      ) : current.requiresUpfront ? (
        <Button title="Not now" variant="ghost" onPress={advance} disabled={busy} fullWidth testID="onboarding-not-now" />
      ) : null}
    </View>
  );

  return (
    <Modal visible={visible} onClose={() => undefined} dismissible={false} size="md" footer={footer} testID="permission-onboarding">
      <View style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
          {current ? <IconButton icon="chevron-left" onPress={() => setStep((s) => s - 1)} accessibilityLabel="Back" /> : <View style={{ width: 40 }} />}
          <Button title={current ? 'Skip All' : 'Skip'} variant="ghost" size="sm" onPress={finish} testID="onboarding-skip" />
        </View>

        {!current ? (
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <IconBubble icon="shield-check" />
            <Text variant="title1" align="center">
              {ONBOARDING_INTRO.title}
            </Text>
            <Text color="textSecondary" align="center">
              {ONBOARDING_INTRO.subtitle[role]}
            </Text>
            <View style={{ backgroundColor: colors.successSoft, borderRadius: radii.md, padding: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
              <Icon name="info" size={18} color="success" />
              <Text variant="callout" color="success" style={{ flex: 1 }}>
                {ONBOARDING_INTRO.info[role]}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
              {ONBOARDING_STEPS.map((s, i) => (
                <Badge key={s.kind} label={ONBOARDING_INTRO.chips[i]} icon={s.icon} tone="primary" />
              ))}
            </View>
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.md }}>
            <ProgressDots current={step} total={total} />
            <IconBubble icon={current.icon} />
            <Text variant="micro" color="primary">{`STEP ${step + 1} OF ${total}`}</Text>
            <Text variant="title1" align="center">
              {current.title}
            </Text>
            <Text color="textSecondary" align="center">
              {current.description[role]}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
              {ONBOARDING_FEATURE_CHIPS.map((c) => (
                <Badge key={c.label} label={c.label} icon={c.icon} tone="neutral" />
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
