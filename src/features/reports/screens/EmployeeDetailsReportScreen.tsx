import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getAllStaff } from '@/api/home';
import { getEmployeeReportProfile } from '@/api/reports';
import { ResponsiveRow, Screen } from '@/components/layout';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  ErrorState,
  ListItem,
  LoadingOverlay,
  SearchBar,
  SkeletonList,
  Text,
  useToast,
} from '@/components/ui';
import { getErrorMessage, isApiError } from '@/lib/api/client';
import { exportHtml } from '@/lib/platform/exporter';
import { openFile } from '@/lib/platform/files';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOrgId, useSession } from '@/store/auth';
import { spacing } from '@/theme';
import type { StaffMember, StaffProfile } from '@/types/api/staff';
import { useHardwareBack } from '../hooks/useHardwareBack';
import { buildProfileHtml, filterDirectory, profileChips, profileErrorMessage, profileSections } from '../utils/employeeProfile';
import { exportFailureMessage, formatMenuLabel } from '../utils/exportLabels';
import { recordSavedReport } from '../utils/history';

const DETAIL_FORMATS: ('pdf' | 'doc')[] = ['pdf', 'doc'];

function ProfileView({ profile }: { profile: StaffProfile }) {
  const sections = profileSections(profile);
  const chips = profileChips(profile);
  return (
    <View style={{ gap: spacing.lg }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <Avatar uri={profile.photoUrl} name={profile.name} size={72} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text variant="title2" numberOfLines={2}>
              {profile.name}
            </Text>
            <Text variant="callout" color="primary">
              {profile.empId}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {chips.map((c, i) => (
                <Badge key={`${c}-${i}`} label={c} tone={i === 0 ? 'primary' : 'neutral'} size="sm" />
              ))}
            </View>
          </View>
        </View>
      </Card>
      <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }} gap={spacing.lg}>
        {sections.map((s) => (
          <Card key={s.title} style={{ flex: 1 }}>
            <Text variant="micro" color="primary" style={{ marginBottom: spacing.sm }}>
              {s.title.toUpperCase()}
            </Text>
            {s.fields.map((f) => (
              <View key={f.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs + 2 }}>
                <Text variant="callout" color="textMuted" style={{ flex: 2 }}>
                  {f.label}
                </Text>
                <Text variant="callout" weight="semibold" style={{ flex: 3 }} align="right" selectable>
                  {f.value}
                </Text>
              </View>
            ))}
          </Card>
        ))}
      </ResponsiveRow>
    </View>
  );
}

export default function EmployeeDetailsReportScreen() {
  const orgId = useOrgId();
  const session = useSession();
  const orgName = session?.orgName;
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formatSheet, setFormatSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastPdfUri, setLastPdfUri] = useState<string | null>(null);

  const directory = useQuery({
    queryKey: queryKeys.reports.run(orgId, 'directory'),
    enabled: orgId !== '',
    queryFn: () => getAllStaff(orgId),
  });
  const filtered = useMemo(() => filterDirectory(directory.data ?? [], search), [directory.data, search]);

  const select = useCallback(
    async (staff: StaffMember): Promise<void> => {
      if (detailLoading) return;
      setDetailLoading(true);
      try {
        setProfile(await getEmployeeReportProfile(staff.userId, orgId));
        setLastPdfUri(null);
      } catch (e) {
        // Inactive staff have no profile on the server: show a friendly message instead of the raw error.
        toast.error(profileErrorMessage(staff, isApiError(e) && e.isNetwork ? getErrorMessage(e) : undefined));
      } finally {
        setDetailLoading(false);
      }
    },
    [detailLoading, orgId, toast],
  );

  const back = useCallback((): boolean => {
    if (profile) {
      setProfile(null);
      setLastPdfUri(null);
      return true;
    }
    return false;
  }, [profile]);
  useHardwareBack(back);

  const download = useCallback(
    async (format: 'pdf' | 'doc'): Promise<void> => {
      if (!profile || exporting) return;
      setFormatSheet(false);
      setExporting(true);
      try {
        const result = await exportHtml({
          html: buildProfileHtml(profile, orgName),
          filename: `${profile.name || 'Employee'}_report`,
          format,
          title: `${profile.name} - Employee Report`,
        });
        if (result.uri) {
          if (format === 'pdf') setLastPdfUri(result.uri);
          try {
            await recordSavedReport(orgId, {
              name: `${profile.name} - Employee Report`,
              uri: result.uri,
              filename: result.filename,
              mimeType: result.mimeType,
            });
          } catch (e) {
            console.warn('Could not add the report to the history', e);
          }
        }
      } catch (e) {
        toast.error(getErrorMessage(e, exportFailureMessage(format)));
      } finally {
        setExporting(false);
      }
    },
    [profile, exporting, orgName, orgId, toast],
  );

  const viewPdf = useCallback(async (): Promise<void> => {
    if (!lastPdfUri || !profile) return;
    try {
      await openFile({ uri: lastPdfUri, mimeType: 'application/pdf', filename: `${profile.name}_report.pdf` });
    } catch (e) {
      toast.error(getErrorMessage(e, 'Could not open report.'));
    }
  }, [lastPdfUri, profile, toast]);

  const overlays = (
    <>
      <LoadingOverlay visible={detailLoading} message="Loading details..." />
      <LoadingOverlay visible={exporting} message="Preparing file..." />
    </>
  );

  if (profile) {
    return (
      <Screen
        title="Employee Details"
        subtitle={profile.name}
        onBack={() => void back()}
        testID="employee-details-profile"
        right={
          <>
            {lastPdfUri ? <Button title="View" icon="eye" size="sm" variant="secondary" onPress={() => void viewPdf()} testID="view-report" /> : null}
            <Button title="Download" icon="download" size="sm" onPress={() => setFormatSheet(true)} testID="download-report" />
          </>
        }
      >
        <ProfileView profile={profile} />
        <BottomSheet visible={formatSheet} onClose={() => setFormatSheet(false)} title="Download as" size="sm">
          {DETAIL_FORMATS.map((f, i) => (
            <ListItem
              key={f}
              icon={f === 'pdf' ? 'file-text' : 'file'}
              iconTone="primary"
              title={formatMenuLabel(f)}
              chevron
              divider={i === 0}
              onPress={() => void download(f)}
              testID={`download-${f}`}
            />
          ))}
        </BottomSheet>
        {overlays}
      </Screen>
    );
  }

  return (
    <Screen
      title="Employee Details"
      subtitle={session?.orgName || undefined}
      refreshing={directory.isRefetching}
      onRefresh={() => void directory.refetch()}
      testID="employee-details-list"
      right={<Badge label={`${filtered.length} staff`} tone="primary" />}
    >
      <View style={{ gap: spacing.lg }}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by name, ID, dept, branch..." />
        {directory.isLoading ? (
          <SkeletonList count={6} />
        ) : directory.isError ? (
          <ErrorState message={getErrorMessage(directory.error, 'Failed to load staff')} onRetry={() => void directory.refetch()} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="users" title="No employees found" />
        ) : (
          <Card padding={0}>
            {filtered.map((s, i) => (
              <ListItem
                key={s.userId}
                left={<Avatar uri={s.photoUrl} name={s.name} size={44} />}
                title={s.name}
                subtitle={[s.empId, [s.department, s.branch].filter(Boolean).join(' · ')].filter(Boolean).join('  •  ')}
                right={s.isActive ? undefined : <Badge label="Inactive" tone="neutral" size="sm" />}
                chevron
                divider={i < filtered.length - 1}
                onPress={() => void select(s)}
                testID={`employee-${s.userId}`}
              />
            ))}
          </Card>
        )}
      </View>
      {overlays}
    </Screen>
  );
}
