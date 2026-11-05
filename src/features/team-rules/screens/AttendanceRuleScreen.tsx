import React, { useState } from 'react';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import * as systemApi from '@/api/system';
import { Screen } from '@/components/layout';
import { Button, Card, Icon, Reveal, Select, SkeletonList, Text } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { queryKeys } from '@/lib/query/queryKeys';
import { useApiMutation } from '@/lib/query/useApiMutation';
import { useOrgId, useSession } from '@/store/auth';
import { radii, spacing, useTheme } from '@/theme';
import type { AttendanceRuleConsider } from '@/types/api/system';

const COUNT_OPTIONS = Array.from({ length: 10 }, (_, i) => ({ label: String(i + 1), value: i + 1 }));
const CONSIDER_OPTIONS: { label: string; value: AttendanceRuleConsider }[] = [
  { label: 'Half Day', value: 'Half Day' },
  { label: 'Leave', value: 'Leave' },
];

/** Late punch-in rule: after N late punch-ins the day counts as Half Day or Leave (route `/admin/attendance-rule`). */
export default function AttendanceRuleScreen() {
  const orgId = useOrgId();
  const session = useSession();
  const { colors } = useTheme();
  const queryClient = useQueryClient();

  const ruleQuery = useQuery({
    queryKey: queryKeys.attendanceRule.rule(orgId),
    queryFn: () => systemApi.getAttendanceRule(orgId),
    enabled: !!orgId,
  });

  // The form shows the saved rule until the user changes something (drafts are null until then).
  const [draftCount, setDraftCount] = useState<number | null>(null);
  const [draftConsider, setDraftConsider] = useState<AttendanceRuleConsider | null>(null);
  const saved = ruleQuery.data ?? systemApi.DEFAULT_ATTENDANCE_RULE;
  const count = draftCount ?? saved.latePunchInCount;
  const considerAs = draftConsider ?? saved.considerAs;

  const save = useApiMutation(() => systemApi.saveAttendanceRule(orgId, { latePunchInCount: count, considerAs }), {
    invalidate: [queryKeys.attendanceRule.all(orgId)],
    successMessage: 'Rule saved successfully',
    errorMessage: 'Failed to save rule',
    onSuccess: () => {
      // Show the saved values immediately; the invalidation below re-reads them from the server.
      queryClient.setQueryData(queryKeys.attendanceRule.rule(orgId), { latePunchInCount: count, considerAs });
      setDraftCount(null);
      setDraftConsider(null);
    },
  });

  const onSave = async () => {
    try {
      await save.mutateAsync();
    } catch {
      // Toast already shown.
    }
  };

  return (
    <Screen
      title="Attendance Rule"
      subtitle={session?.orgName || undefined}
      refreshing={ruleQuery.isRefetching && !ruleQuery.isLoading}
      onRefresh={() => void ruleQuery.refetch()}
      footer={<Button title="Save Rule" size="lg" fullWidth loading={save.isPending} disabled={!orgId || ruleQuery.isLoading} onPress={() => void onSave()} testID="save-rule" />}
      testID="attendance-rule-screen"
    >
      <Reveal index={0}>
      {ruleQuery.isLoading ? (
        <SkeletonList count={3} />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {ruleQuery.isError ? (
            <Card variant="outlined" testID="rule-load-error">
              <View style={{ gap: spacing.md }}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <Icon name="alert-circle" size={20} color="warning" />
                  <Text variant="callout" color="textSecondary" style={{ flex: 1 }}>
                    {`${getErrorMessage(ruleQuery.error, 'Could not load the saved rule.')} Showing the defaults.`}
                  </Text>
                </View>
                <Button title="Retry" size="sm" variant="secondary" onPress={() => void ruleQuery.refetch()} />
              </View>
            </Card>
          ) : null}

          <Card padding={spacing.xl}>
            <View style={{ gap: spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="timer" size={22} color="warning" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title3">Half Day Rule</Text>
                  <Text variant="callout" color="textSecondary">
                    Configure when late punch-ins should be considered as half day or leave.
                  </Text>
                </View>
              </View>

              <Select
                label="Late Punch-In Count"
                value={count}
                options={COUNT_OPTIONS}
                onChange={setDraftCount}
                testID="rule-count"
              />
              <Select
                label="Consider As"
                value={considerAs}
                options={CONSIDER_OPTIONS}
                onChange={setDraftConsider}
                testID="rule-consider"
              />

              <View style={{ borderLeftWidth: 4, borderLeftColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: radii.sm, padding: spacing.md }}>
                <Text variant="body" testID="rule-summary">
                  {'If an employee is late '}
                  <Text variant="bodyStrong">{`${count} times`}</Text>
                  {', it will be considered as '}
                  <Text variant="bodyStrong">{considerAs}</Text>
                  {'.'}
                </Text>
              </View>
            </View>
          </Card>
        </View>
      )}
      </Reveal>
    </Screen>
  );
}
