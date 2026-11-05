import React from 'react';
import { View } from 'react-native';

import { BottomSheet, Button, Card, ErrorState, SkeletonList, Spinner, Text } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { spacing, useTheme } from '@/theme';
import type { StaffProfile } from '@/types/api/staff';

export interface ProfileSheetProps {
  visible: boolean;
  profile: StaffProfile | undefined;
  loading: boolean;
  failed: boolean;
  /** A refetch of an already-loaded profile is running. */
  refreshing: boolean;
  onRetry: () => void;
  onClose: () => void;
  onEdit: () => void;
}

type Field = [label: string, value: string | undefined];

const orDash = (v: string | undefined): string => (v && v.trim() ? v : '-');

function Section({ title, fields }: { title: string; fields: Field[] }) {
  const { colors } = useTheme();
  return (
    <Card padding={spacing.lg} style={{ gap: spacing.md }}>
      <Text variant="title3">{title}</Text>
      {fields.map(([label, value]) => (
        <View key={label} style={{ flexDirection: 'row', gap: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text variant="callout" color="textMuted" style={{ width: 130 }}>
            {`${label}:`}
          </Text>
          <Text variant="callout" style={{ flex: 1 }} selectable>
            {orDash(value)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

/** Full profile: basic, personal, statutory and bank details. */
export function ProfileSheet({ visible, profile, loading, failed, refreshing, onRetry, onClose, onEdit }: ProfileSheetProps) {
  const { colors } = useTheme();
  const p = profile;
  const dateOr = (d: string | undefined) => (d ? formatDate(d) : undefined);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Profile Details"
      snap="full"
      footer={<Button title="Edit Staff" icon="edit" onPress={onEdit} fullWidth />}
    >
      {refreshing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginBottom: spacing.md, borderRadius: 10, backgroundColor: colors.primarySoft }}>
          <Spinner />
          <Text variant="callout" color="primary">
            Refreshing profile...
          </Text>
        </View>
      ) : null}
      {loading ? (
        <SkeletonList count={4} />
      ) : failed && !p ? (
        <ErrorState compact message="Failed to load profile details" onRetry={onRetry} />
      ) : p ? (
        <View style={{ gap: spacing.lg }} testID="profile-details">
          <Section
            title="Basic Information"
            fields={[
              ['Name', p.name],
              ['Employee ID', p.empId],
              ['Email', p.email],
              ['Mobile', p.mobile],
              ['Department', p.department],
              ['Branch', p.branch],
              ['Role', p.roleName],
            ]}
          />
          <Section
            title="Personal Details"
            fields={[
              ['Father Name', p.fatherName],
              ['Date of Birth', dateOr(p.dob)],
              ['Gender', p.gender],
              ['Blood Group', p.bloodGroup],
              ['Marital Status', p.maritalStatus],
              ['Address', p.address],
              ['Emergency Contact', p.emergencyContact],
              ['Date of Joining', dateOr(p.doj)],
            ]}
          />
          <Section
            title="ID & Statutory Details"
            fields={[
              ['Aadhaar No', p.aadhaarNo],
              ['PAN No', p.panNo],
              ['UAN No', p.uanNo],
              ['PF No', p.pfNo],
              ['ESI No', p.esiNo],
            ]}
          />
          <Section
            title="Bank Details"
            fields={[
              ['Bank Name', p.bankName],
              ['Branch', p.bankBranch],
              ['Account No', p.bankAccountNo],
              ['IFSC Code', p.ifsc],
            ]}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}
