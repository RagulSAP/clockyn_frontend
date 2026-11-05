import React, { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/layout';
import { Badge, Button, Card, LoadingOverlay, MonthYearPicker, Reveal, type MonthYear, type Tone } from '@/components/ui';
import { spacing } from '@/theme';
import { useSession } from '@/store/auth';
import type { ReportFormat } from '../types';
import { yearRangeFor } from '../utils/monthRange';
import { ExportSheet } from './ExportSheet';
import { ReportBanners } from './ReportBanner';

export interface ReportScaffoldProps {
  title: string;
  year: number;
  month: number;
  onMonthChange: (value: MonthYear) => void;
  /** `{n} staff`, `{n} late entries`, … shown next to the month picker. */
  summary?: string;
  summaryTone?: Tone;
  /** Omit for reports without export. */
  onExport?: (format: ReportFormat) => void;
  exportFormats?: readonly ReportFormat[];
  /** Disables Export while loading or when there are no rows. */
  exportDisabled?: boolean;
  exporting?: boolean;
  warnings?: readonly string[];
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra header actions. */
  right?: React.ReactNode;
  children?: React.ReactNode;
  testID?: string;
}

/** Shared frame of the month-based reports: header with Export, month/year picker, summary pill, banners, content. */
export function ReportScaffold({
  title,
  year,
  month,
  onMonthChange,
  summary,
  summaryTone = 'primary',
  onExport,
  exportFormats,
  exportDisabled,
  exporting,
  warnings = [],
  refreshing,
  onRefresh,
  right,
  children,
  testID,
}: ReportScaffoldProps) {
  const session = useSession();
  const [sheet, setSheet] = useState(false);
  return (
    <Screen
      title={title}
      subtitle={session?.orgName || undefined}
      maxWidth={1400}
      refreshing={refreshing}
      onRefresh={onRefresh}
      testID={testID}
      right={
        <>
          {right}
          {onExport ? (
            <Button title="Export" icon="download" size="sm" variant="secondary" disabled={exportDisabled || exporting} onPress={() => setSheet(true)} testID="report-export" />
          ) : null}
        </>
      }
    >
      <View style={{ gap: spacing.lg }}>
        <Reveal index={0}>
          <Card padding={spacing.md}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <MonthYearPicker month={month} year={year} onChange={onMonthChange} yearRange={yearRangeFor('reports')} testID="report-month" />
              {summary ? <Badge label={summary} tone={summaryTone} testID="report-summary" /> : null}
            </View>
          </Card>
        </Reveal>
        <ReportBanners messages={warnings} />
        <Reveal index={1}>{children}</Reveal>
      </View>
      {onExport ? <ExportSheet visible={sheet} onClose={() => setSheet(false)} onPick={onExport} formats={exportFormats} /> : null}
      <LoadingOverlay visible={!!exporting} message="Preparing file..." />
    </Screen>
  );
}
