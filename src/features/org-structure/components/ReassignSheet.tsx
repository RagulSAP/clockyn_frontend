import React from 'react';
import { View } from 'react-native';

import { BottomSheet, Button, Card, CheckboxMark, FilterChips, ListItem, Text } from '@/components/ui';
import { spacing } from '@/theme';
import type { Branch } from '@/types/api/branches';

import { allSelected, canReassign, reassignLabel, type DeleteFlowState } from '../utils/branchDeleteFlow';

type ReassignState = Extract<DeleteFlowState, { step: 'reassign' }>;

type Props = {
  state: ReassignState;
  /** Branches the staff can move to (never the branch being deleted). */
  targets: Branch[];
  onClose: () => void;
  onToggleStaff: (userId: string) => void;
  onToggleAll: () => void;
  onSelectTarget: (branchId: string) => void;
  onSubmit: () => void;
};

/** Staff must leave a branch before it can be deleted: pick staff, pick the target branch, confirm. */
export function ReassignSheet({ state, targets, onClose, onToggleStaff, onToggleAll, onSelectTarget, onSubmit }: Props) {
  const everything = allSelected(state);
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title="Reassign Staff"
      snap="tall"
      dismissible={!state.busy}
      testID="reassign-sheet"
      footer={
        <Button
          title={state.busy ? 'Working...' : reassignLabel(state)}
          variant="danger"
          fullWidth
          loading={state.busy}
          disabled={!canReassign(state)}
          onPress={onSubmit}
          testID="reassign-submit"
        />
      }
    >
      <View style={{ gap: spacing.lg }}>
        <Text color="textSecondary">{`${state.staff.length} staff in "${state.branch.name}" must be reassigned before deletion`}</Text>

        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text variant="micro" color="textMuted">
              ASSIGNED STAFF
            </Text>
            <Button
              title="Select All"
              size="sm"
              variant="ghost"
              icon={everything ? 'check-circle' : 'circle'}
              onPress={onToggleAll}
              disabled={state.busy}
              testID="reassign-select-all"
            />
          </View>
          <Card padding={0} variant="outlined">
            {state.staff.map((member, index) => (
              <ListItem
                key={member.userId}
                title={member.name}
                subtitle={`${member.empId} · ${member.department}`}
                left={<CheckboxMark checked={state.selectedIds.includes(member.userId)} />}
                onPress={() => onToggleStaff(member.userId)}
                chevron={false}
                divider={index < state.staff.length - 1}
                testID={`reassign-staff-${member.userId}`}
              />
            ))}
          </Card>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text variant="micro" color="textMuted">
            MOVE TO BRANCH
          </Text>
          {targets.length > 0 ? (
            <FilterChips<string>
              scroll={false}
              options={targets.map((b) => ({ label: b.name, value: b.id }))}
              value={state.targetId || null}
              onChange={onSelectTarget}
            />
          ) : (
            <Text variant="callout" color="warning">
              There is no other branch to move staff to. Add another branch first.
            </Text>
          )}
        </View>

        {state.error ? (
          <Text variant="callout" color="danger" testID="reassign-error">
            {state.error}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}
