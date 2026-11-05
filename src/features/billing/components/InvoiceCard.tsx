import React from 'react';
import { View } from 'react-native';

import { Badge, Card, Icon, IconButton, Spinner, Text, toneColors } from '@/components/ui';
import { formatDate } from '@/lib/datetime';
import { formatINR } from '@/lib/format';
import { radii, spacing, useTheme } from '@/theme';

import { capitalize } from '../utils/planState';

export type InvoiceCardProps = {
  planName: string;
  number: string;
  paymentDate: string | null;
  staffCount: number;
  validTill: string | null;
  totalAmount: number;
  /** History cards show a download button; downloaded cards are pressable. */
  variant: 'history' | 'downloaded';
  downloadedAt?: string;
  downloading?: boolean;
  onDownload?: () => void;
  onPress?: () => void;
};

/** One invoice row (history or downloaded file). */
export function InvoiceCard(p: InvoiceCardProps) {
  const { colors } = useTheme();
  const t = toneColors(p.variant === 'downloaded' ? 'success' : 'neutral', colors);
  const title = `${capitalize(p.planName) || p.number} Plan`;

  return (
    <Card onPress={p.onPress} padding={spacing.lg} testID={`invoice-${p.number}`} accessibilityLabel={`${title}, invoice ${p.number}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radii.md, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={p.variant === 'downloaded' ? 'check-circle' : 'receipt'} size={22} color={t.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Text variant="bodyStrong">{title}</Text>
            {p.variant === 'history' ? <Badge label="PAID" tone="success" size="sm" /> : null}
          </View>
          <Text variant="caption" color="textMuted">{`Invoice ${p.number}`}</Text>
          {p.variant === 'history' ? (
            <>
              <Text variant="callout" color="textSecondary">{`Paid ${formatDate(p.paymentDate)}`}</Text>
              <Text variant="callout" color="textSecondary">{`Staff ${p.staffCount} · Valid till ${formatDate(p.validTill)}`}</Text>
            </>
          ) : (
            <Text variant="callout" color="textSecondary">{`Downloaded ${formatDate(p.downloadedAt)}`}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: spacing.xs }}>
          {p.totalAmount > 0 ? (
            <Text variant="title3" testID={`invoice-amount-${p.number}`}>
              {formatINR(p.totalAmount)}
            </Text>
          ) : null}
          {p.variant === 'history' ? (
            p.downloading ? (
              <Spinner />
            ) : (
              <IconButton icon="download" variant="tonal" accessibilityLabel={`Download invoice ${p.number}`} onPress={p.onDownload} testID={`download-${p.number}`} />
            )
          ) : (
            <Icon name="external-link" size={18} color="textMuted" />
          )}
        </View>
      </View>
    </Card>
  );
}
