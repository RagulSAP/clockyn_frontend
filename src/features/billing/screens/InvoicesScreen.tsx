import React, { useCallback, useState } from 'react';
import { Platform, View } from 'react-native';

import { billingApi } from '@/api';
import { Screen, ResponsiveRow } from '@/components/layout';
import { BottomSheet, Button, Card, EmptyState, ErrorState, ListItem, Reveal, SegmentedControl, SkeletonList, Text, useConfirm, useToast } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { formatDate } from '@/lib/datetime';
import { deleteSavedFile, downloadAndOpen, FileOperationError, openFile, shareFile } from '@/lib/platform/files';
import { useOrgId, useUserId } from '@/store/auth';
import { spacing } from '@/theme';
import type { Invoice } from '@/types/api/billing';

import { InvoiceCard } from '../components/InvoiceCard';
import { useDownloadedInvoices } from '../hooks/useDownloadedInvoices';
import { useInvoices } from '../hooks/useBillingData';
import { toDownloadedInvoice, type DownloadedInvoice } from '../utils/downloads';

type Tab = 'history' | 'downloaded';
const PDF = 'application/pdf';

/** Billing history (API) and downloaded invoice PDFs (native: local registry; web: a browser download). */
export default function InvoicesScreen() {
  const toast = useToast();
  const confirm = useConfirm();
  const orgId = useOrgId();
  const userId = useUserId();
  const isWeb = Platform.OS === 'web';

  const invoices = useInvoices();
  const downloads = useDownloadedInvoices(orgId);
  const [tab, setTab] = useState<Tab>('history');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<DownloadedInvoice | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await invoices.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [invoices]);

  const download = async (invoice: Invoice) => {
    if (downloadingId !== null) return;
    setDownloadingId(invoice.number);
    try {
      const url = billingApi.invoiceDownloadUrl({ userId, orgId, invoiceNumber: invoice.number, downloadUrl: invoice.downloadUrl });
      const filename = billingApi.invoiceFileName(invoice.number);
      if (isWeb) {
        await downloadAndOpen({ url, filename, mimeType: PDF });
      } else {
        const saved = await downloadAndOpen({ url, filename, mimeType: PDF, open: false });
        if (!saved.uri) throw new Error('Download failed');
        await downloads.add(toDownloadedInvoice(invoice, saved.uri));
        setTab('downloaded');
      }
      toast.success(`Invoice ${invoice.number} downloaded successfully.`);
    } catch (e) {
      const message = e instanceof FileOperationError && e.code === 'download_failed' ? 'Download failed' : getErrorMessage(e, 'Failed to download invoice');
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const open = async (item: DownloadedInvoice) => {
    setSelected(null);
    try {
      await openFile({ uri: item.filePath, mimeType: PDF, filename: billingApi.invoiceFileName(item.invoiceNumber) });
    } catch {
      toast.error('No PDF viewer found. Try sharing the file instead.');
    }
  };

  const share = async (item: DownloadedInvoice) => {
    setSelected(null);
    try {
      await shareFile({ uri: item.filePath, mimeType: PDF, filename: billingApi.invoiceFileName(item.invoiceNumber), dialogTitle: 'Share Invoice' });
    } catch (e) {
      toast.error(e instanceof FileOperationError && e.code === 'unavailable' ? 'Sharing is not available on this device.' : 'Could not share file');
    }
  };

  const remove = async (item: DownloadedInvoice) => {
    setSelected(null);
    const ok = await confirm({
      title: 'Delete Invoice?',
      message: `Invoice ${item.invoiceNumber} will be removed from your downloads. This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteSavedFile(item.filePath);
      await downloads.remove(item.invoiceNumber);
      toast.success(`Invoice ${item.invoiceNumber} deleted successfully.`);
    } catch {
      toast.error('Could not delete file');
    }
  };

  const list = invoices.data ?? [];
  const tabs = [
    { label: `Invoice History (${list.length})`, value: 'history' as Tab },
    ...(isWeb ? [] : [{ label: `Downloaded (${downloads.items.length})`, value: 'downloaded' as Tab }]),
  ];

  const historyBody = invoices.isLoading ? (
    <SkeletonList count={4} />
  ) : invoices.isError && !invoices.data ? (
    <ErrorState
      title="Could not load invoice history"
      message={getErrorMessage(invoices.error, 'Failed to load invoice history')}
      retryLabel="Retry"
      onRetry={() => void invoices.refetch()}
    />
  ) : list.length === 0 ? (
    <EmptyState icon="receipt" title="No invoices found" message="Past invoices will appear here after successful payments." />
  ) : (
    <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
      {list.map((inv, i) => (
        <InvoiceCard
          key={`${inv.id}-${i}`}
          variant="history"
          planName={inv.planName || 'Plan'}
          number={inv.number || `INV-${i + 1}`}
          paymentDate={inv.paymentDate}
          staffCount={inv.staffCount}
          validTill={inv.validTill}
          totalAmount={inv.totalAmount}
          downloading={downloadingId === inv.number}
          onDownload={() => void download(inv)}
        />
      ))}
    </ResponsiveRow>
  );

  const downloadedBody =
    downloads.items.length === 0 ? (
      <EmptyState
        icon="download"
        title="No downloads yet"
        message="Download an invoice from the History tab to see it here."
        action={{ label: 'Go to History', onPress: () => setTab('history') }}
      />
    ) : (
      <ResponsiveRow columns={{ phone: 1, tablet: 2, desktop: 2 }}>
        {downloads.items.map((d) => (
          <InvoiceCard
            key={d.invoiceNumber}
            variant="downloaded"
            planName={d.planName}
            number={d.invoiceNumber}
            paymentDate={d.paymentDate}
            staffCount={d.staffCount}
            validTill={d.validTill}
            totalAmount={d.totalAmount}
            downloadedAt={d.downloadedAt}
            onPress={() => setSelected(d)}
          />
        ))}
      </ResponsiveRow>
    );

  return (
    <Screen title="Invoices" subtitle="Billing history & downloads" refreshing={refreshing} onRefresh={onRefresh} testID="invoices-screen">
      <View style={{ gap: spacing.lg }}>
        <Reveal index={0} style={{ gap: spacing.lg }}>
          {tabs.length > 1 ? <SegmentedControl options={tabs} value={tab} onChange={setTab} /> : <Text variant="bodyStrong">{tabs[0].label}</Text>}
          <Text variant="callout" color="textSecondary">
            {tab === 'history' ? 'Download any past invoice from your billing history.' : 'Invoices you have downloaded are listed here.'}
          </Text>
        </Reveal>
        <Reveal index={1}>{tab === 'history' ? historyBody : downloadedBody}</Reveal>
      </View>

      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} title={selected ? `Invoice ${selected.invoiceNumber}` : undefined} testID="invoice-actions">
        {selected ? (
          <View style={{ gap: spacing.md }}>
            <Text variant="caption" color="textMuted">{`Downloaded ${formatDate(selected.downloadedAt)}`}</Text>
            <Card padding={0}>
              <ListItem icon="file-text" title="Open PDF" subtitle="View with PDF reader" onPress={() => void open(selected)} divider testID="invoice-open" />
              <ListItem icon="share" title="Share" subtitle="Send via email, messaging apps & more" onPress={() => void share(selected)} divider testID="invoice-share" />
              <ListItem icon="trash" title="Delete" subtitle="Remove from this device" destructive onPress={() => void remove(selected)} testID="invoice-delete" />
            </Card>
            <Button title="Cancel" variant="ghost" fullWidth onPress={() => setSelected(null)} />
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}
