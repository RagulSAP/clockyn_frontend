import React from 'react';
import { Platform } from 'react-native';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { FileOperationError } from '@/lib/platform/files.types';
import { getJSON, STORAGE_KEYS, storageKeyFor } from '@/lib/storage';
import type { Invoice } from '@/types/api/billing';

import InvoicesScreen from '../screens/InvoicesScreen';
import { renderScreen, signInTestAdmin } from './testHelpers';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useFocusEffect: () => undefined,
  useLocalSearchParams: () => ({}),
}));

const mockListInvoices = jest.fn();
jest.mock('@/api', () => {
  const actual = jest.requireActual('@/api/billing');
  return {
    billingApi: {
      invoiceDownloadUrl: actual.invoiceDownloadUrl,
      invoiceFileName: actual.invoiceFileName,
      listInvoices: (...a: unknown[]) => mockListInvoices(...a),
    },
  };
});

const mockFiles = {
  downloadAndOpen: jest.fn(),
  openFile: jest.fn(),
  shareFile: jest.fn(),
  deleteSavedFile: jest.fn(),
  savedFileExists: jest.fn(),
};
jest.mock('@/lib/platform/files', () => ({
  ...jest.requireActual('@/lib/platform/files.types'),
  downloadAndOpen: (...a: unknown[]) => mockFiles.downloadAndOpen(...a),
  openFile: (...a: unknown[]) => mockFiles.openFile(...a),
  shareFile: (...a: unknown[]) => mockFiles.shareFile(...a),
  deleteSavedFile: (...a: unknown[]) => mockFiles.deleteSavedFile(...a),
  savedFileExists: (...a: unknown[]) => mockFiles.savedFileExists(...a),
}));

const invoices: Invoice[] = [
  { id: 'a', number: 'INV-2026-001', paymentDate: '2026-10-01', planName: 'prime', staffCount: 15, totalAmount: 8496, validTill: '2027-10-01', raw: {} },
  { id: 'b', number: 'INV-2026-002', paymentDate: '2026-04-01', planName: 'core', staffCount: 10, totalAmount: 0, validTill: '2026-10-01', raw: {} },
];

const originalOS = Platform.OS;

beforeEach(async () => {
  jest.clearAllMocks();
  signInTestAdmin();
  mockListInvoices.mockResolvedValue(invoices);
  mockFiles.downloadAndOpen.mockResolvedValue({ uri: 'file:///docs/Invoice_INV-2026-001.pdf', filename: 'Invoice_INV-2026-001.pdf', mimeType: 'application/pdf' });
  mockFiles.savedFileExists.mockResolvedValue(true);
  mockFiles.openFile.mockResolvedValue(undefined);
  mockFiles.shareFile.mockResolvedValue(undefined);
  mockFiles.deleteSavedFile.mockResolvedValue(undefined);
  jest.replaceProperty(Platform, 'OS', 'android');
  const AsyncStorage = jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock');
  await AsyncStorage.clear?.();
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
});

describe('InvoicesScreen', () => {
  it('lists the billing history with plan, PAID chip, dates, staff and amount', async () => {
    await renderScreen(<InvoicesScreen />);
    expect(await screen.findByText('Invoice History (2)')).toBeTruthy();
    expect(screen.getByText('Prime Plan')).toBeTruthy();
    expect(screen.getAllByText('PAID')).toHaveLength(2);
    expect(screen.getByText('Paid 01 Oct 2026')).toBeTruthy();
    expect(screen.getByText('Staff 15 · Valid till 01 Oct 2027')).toBeTruthy();
    expect(screen.getByTestId('invoice-amount-INV-2026-001')).toHaveTextContent('₹8,496');
    expect(mockListInvoices).toHaveBeenCalledWith('user-1', 'org-1');
  });

  it('empty and error states (error is retryable)', async () => {
    mockListInvoices.mockResolvedValueOnce([]);
    const first = await renderScreen(<InvoicesScreen />);
    expect(await screen.findByText('No invoices found')).toBeTruthy();
    await first.unmount();

    mockListInvoices.mockRejectedValueOnce(new Error('Failed to load invoices')).mockResolvedValue(invoices);
    await renderScreen(<InvoicesScreen />);
    // spec invoices §3 / §8: panel title "Could not load invoice history", the error text and a "Retry" button
    expect(await screen.findByText('Could not load invoice history')).toBeTruthy();
    expect(screen.getByText('Failed to load invoices')).toBeTruthy();
    await fireEvent.press(screen.getByText('Retry'));
    expect(await screen.findByText('Invoice History (2)')).toBeTruthy();
  });

  it('download saves the PDF, registers it, switches to the Downloaded tab and persists the registry', async () => {
    await renderScreen(<InvoicesScreen />);
    await fireEvent.press(await screen.findByTestId('download-INV-2026-001'));
    expect(await screen.findByText('Invoice INV-2026-001 downloaded successfully.')).toBeTruthy();
    expect(mockFiles.downloadAndOpen).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'Invoice_INV-2026-001.pdf', mimeType: 'application/pdf', open: false, url: expect.stringContaining('invoice_number=INV-2026-001') }),
    );
    expect(await screen.findByText('Downloaded (1)')).toBeTruthy();
    expect(screen.getByText('Invoices you have downloaded are listed here.')).toBeTruthy();
    await waitFor(async () => {
      const stored = await getJSON<{ invoiceNumber: string }[]>(storageKeyFor(STORAGE_KEYS.downloadedInvoices, 'org-1'));
      expect(stored?.map((d) => d.invoiceNumber)).toEqual(['INV-2026-001']);
    });
  });

  it('a failed download shows an error toast and registers nothing', async () => {
    mockFiles.downloadAndOpen.mockRejectedValue(new FileOperationError('download_failed', 'Server returned 404'));
    await renderScreen(<InvoicesScreen />);
    await fireEvent.press(await screen.findByTestId('download-INV-2026-001'));
    expect(await screen.findByText('Download failed')).toBeTruthy();
    expect(screen.getByText('Downloaded (0)')).toBeTruthy();
  });

  it('downloaded invoices: open, share and delete from the action sheet', async () => {
    await renderScreen(<InvoicesScreen />);
    await fireEvent.press(await screen.findByTestId('download-INV-2026-001'));
    await screen.findByText('Downloaded (1)');

    await fireEvent.press(screen.getByTestId('invoice-INV-2026-001'));
    await fireEvent.press(await screen.findByTestId('invoice-open'));
    expect(mockFiles.openFile).toHaveBeenCalledWith(expect.objectContaining({ uri: 'file:///docs/Invoice_INV-2026-001.pdf', mimeType: 'application/pdf' }));

    await fireEvent.press(screen.getByTestId('invoice-INV-2026-001'));
    await fireEvent.press(await screen.findByTestId('invoice-share'));
    expect(mockFiles.shareFile).toHaveBeenCalledWith(expect.objectContaining({ dialogTitle: 'Share Invoice' }));

    await fireEvent.press(screen.getByTestId('invoice-INV-2026-001'));
    await fireEvent.press(await screen.findByTestId('invoice-delete'));
    expect(await screen.findByText('Delete Invoice?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    expect(await screen.findByText('Invoice INV-2026-001 deleted successfully.')).toBeTruthy();
    expect(mockFiles.deleteSavedFile).toHaveBeenCalledWith('file:///docs/Invoice_INV-2026-001.pdf');
    expect(screen.getByText('No downloads yet')).toBeTruthy();
  });

  it('open / share failures use the spec wording', async () => {
    await renderScreen(<InvoicesScreen />);
    await fireEvent.press(await screen.findByTestId('download-INV-2026-001'));
    await screen.findByText('Downloaded (1)');

    mockFiles.openFile.mockRejectedValueOnce(new Error('no viewer'));
    await fireEvent.press(screen.getByTestId('invoice-INV-2026-001'));
    await fireEvent.press(await screen.findByTestId('invoice-open'));
    expect(await screen.findByText('No PDF viewer found. Try sharing the file instead.')).toBeTruthy();

    mockFiles.shareFile.mockRejectedValueOnce(new FileOperationError('unavailable', 'no share'));
    await fireEvent.press(screen.getByTestId('invoice-INV-2026-001'));
    await fireEvent.press(await screen.findByTestId('invoice-share'));
    expect(await screen.findByText('Sharing is not available on this device.')).toBeTruthy();

    mockFiles.shareFile.mockRejectedValueOnce(new Error('boom'));
    await fireEvent.press(screen.getByTestId('invoice-INV-2026-001'));
    await fireEvent.press(await screen.findByTestId('invoice-share'));
    expect(await screen.findByText('Could not share file')).toBeTruthy();
  });

  it('cancelling the delete dialog keeps the file and the entry', async () => {
    await renderScreen(<InvoicesScreen />);
    await fireEvent.press(await screen.findByTestId('download-INV-2026-001'));
    await screen.findByText('Downloaded (1)');
    await fireEvent.press(screen.getByTestId('invoice-INV-2026-001'));
    await fireEvent.press(await screen.findByTestId('invoice-delete'));
    await screen.findByText('Delete Invoice?');
    await fireEvent.press(screen.getByText('Cancel'));
    expect(mockFiles.deleteSavedFile).not.toHaveBeenCalled();
    expect(screen.getByText('Downloaded (1)')).toBeTruthy();
  });

  it('on the web the download is a plain browser download and there is no Downloaded tab', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await renderScreen(<InvoicesScreen />);
    await fireEvent.press(await screen.findByTestId('download-INV-2026-001'));
    expect(await screen.findByText('Invoice INV-2026-001 downloaded successfully.')).toBeTruthy();
    expect(mockFiles.downloadAndOpen).toHaveBeenCalledWith(expect.not.objectContaining({ open: false }));
    expect(screen.queryByText(/Downloaded \(/)).toBeNull();
  });
});
