import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/layout';
import { Reveal, Tabs } from '@/components/ui';
import { spacing } from '@/theme';
import { useSession } from '@/store/auth';
import { useHardwareBack } from '../hooks/useHardwareBack';
import { useSavedReports } from '../hooks/useSavedReports';
import type { HubVariant } from '../utils/catalogue';
import { ReportCatalogue } from './ReportCatalogue';
import { SavedReportList } from './SavedReportList';

type HubTab = 'generate' | 'view';

const TABS = [
  { key: 'generate', label: 'Generate' },
  { key: 'view', label: 'View Reports' },
];

/** Generate (catalogue) + View Reports (history) — shared by the admin hub and the manager variant. */
export function ReportsHub({ variant }: { variant: HubVariant }) {
  const session = useSession();
  const [tab, setTab] = useState<HubTab>('generate');
  const saved = useSavedReports(tab === 'view');

  // Hardware back: View → Generate → leave the screen.
  const onHardwareBack = useCallback(() => {
    if (tab === 'view') {
      setTab('generate');
      return true;
    }
    return false;
  }, [tab]);
  useHardwareBack(onHardwareBack);

  return (
    <Screen
      title="Reports"
      subtitle={session?.orgName || undefined}
      refreshing={tab === 'view' && saved.refreshing}
      onRefresh={tab === 'view' ? () => void saved.reload() : undefined}
      testID="reports-hub"
    >
      <View style={{ gap: spacing.lg }}>
        <Reveal index={0}>
          <Tabs tabs={TABS} active={tab} onChange={(k) => setTab(k as HubTab)} />
        </Reveal>
        <Reveal index={1}>
        {tab === 'generate' ? (
          <ReportCatalogue variant={variant} />
        ) : (
          <SavedReportList
            entries={saved.entries}
            missing={saved.missing}
            loading={saved.loading}
            onOpen={(e) => void saved.open(e)}
            onShare={(e) => void saved.share(e)}
            onDelete={(e) => void saved.remove(e)}
          />
        )}
        </Reveal>
      </View>
    </Screen>
  );
}
