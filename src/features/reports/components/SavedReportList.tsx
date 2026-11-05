import React from 'react';
import { View } from 'react-native';
import { Badge, Card, EmptyState, Icon, IconButton, SkeletonList, Text, type IconName } from '@/components/ui';
import { formatDateTime } from '@/lib/datetime';
import { radii, spacing, useTheme } from '@/theme';
import type { SavedReport } from '../types';

function iconFor(mime: string): IconName {
  const m = mime.toLowerCase();
  if (m.includes('pdf')) return 'file-text';
  if (m.includes('sheet') || m.includes('excel') || m.includes('csv')) return 'file-spreadsheet';
  return 'file';
}

function typeLabel(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('pdf')) return 'PDF';
  if (m.includes('sheet') || m.includes('excel')) return 'XLSX';
  if (m.includes('csv')) return 'CSV';
  if (m.includes('word')) return 'DOC';
  return 'FILE';
}

export interface SavedReportListProps {
  entries: readonly SavedReport[];
  missing: ReadonlySet<string>;
  loading: boolean;
  onOpen: (entry: SavedReport) => void;
  onShare: (entry: SavedReport) => void;
  onDelete: (entry: SavedReport) => void;
}

/** History of generated reports: newest first (as stored), open / share / delete. */
export function SavedReportList({ entries, missing, loading, onOpen, onShare, onDelete }: SavedReportListProps) {
  const { colors } = useTheme();
  if (loading) return <SkeletonList count={4} />;
  if (entries.length === 0) {
    return (
      <EmptyState
        icon="folder"
        title="No reports yet"
        message="Generated reports will appear here. Go to Generate tab to create one."
      />
    );
  }
  return (
    <View style={{ gap: spacing.md }}>
      {entries.map((entry) => {
        const gone = missing.has(entry.id);
        return (
          <Card key={entry.id} padding={spacing.md} onPress={() => onOpen(entry)} testID={`saved-${entry.id}`} accessibilityLabel={entry.name}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', opacity: gone ? 0.5 : 1 }}>
                <Icon name={iconFor(entry.mimeType)} size={22} color="primary" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={1} color={gone ? 'textMuted' : 'text'}>
                  {entry.name}
                </Text>
                <Text variant="caption" color="textMuted">
                  {formatDateTime(entry.date)}
                </Text>
                {gone ? (
                  <Text variant="caption" color="warning">
                    File no longer available
                  </Text>
                ) : null}
              </View>
              <Badge label={typeLabel(entry.mimeType)} tone="neutral" size="sm" />
              <IconButton icon="share" variant="tonal" size="sm" accessibilityLabel={`Share ${entry.name}`} onPress={() => onShare(entry)} disabled={gone} />
              <IconButton icon="trash" variant="tonal" size="sm" accessibilityLabel={`Delete ${entry.name}`} onPress={() => onDelete(entry)} />
            </View>
          </Card>
        );
      })}
    </View>
  );
}
