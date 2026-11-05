import React from 'react';
import { BottomSheet, ListItem, type IconName } from '@/components/ui';
import type { ReportFormat } from '../types';
import { EXPORT_FORMATS, formatMenuLabel } from '../utils/exportLabels';

const ICON: Record<ReportFormat, IconName> = { pdf: 'file-text', doc: 'file', xlsx: 'file-spreadsheet', csv: 'table' };

export function ExportSheet({
  visible,
  onClose,
  onPick,
  formats = EXPORT_FORMATS,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (format: ReportFormat) => void;
  formats?: readonly ReportFormat[];
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Export Report" size="sm">
      {formats.map((format, i) => (
        <ListItem
          key={format}
          icon={ICON[format]}
          iconTone="primary"
          title={formatMenuLabel(format)}
          chevron
          divider={i < formats.length - 1}
          onPress={() => {
            onClose();
            onPick(format);
          }}
          testID={`export-${format}`}
        />
      ))}
    </BottomSheet>
  );
}
