import React from 'react';

import { ExpenseUploadScreen, type ExpenseScreenConfig } from './ExpenseUploadScreen';

const CONFIG: ExpenseScreenConfig = {
  type: 'bill',
  title: 'Other Bills',
  listTitle: 'Submitted Bills',
  columnLabel: 'Bill',
  emptyTitle: 'No bills yet',
  emptyMessage: (date) => `Submitted bills for ${date} will appear here`,
  placeholderIcon: 'receipt',
  addTitle: 'Add Bill / Invoice',
  addSubtitle: 'Upload your bill photo and enter the amount',
  photoLabel: 'Bill Photo',
  uploadTitle: 'Upload Bill Photo',
  uploadSubtitle: 'Tap to take a photo of your bill',
  submitLabel: 'Submit Bill',
  successTitle: 'Bill Submitted!',
  successMessage: 'Your bill has been recorded successfully.',
  failureFallback: 'Failed to submit bill',
  noun: 'bill',
};

/** Other bills: photo + amount per date. */
export default function OtherBillsScreen() {
  return <ExpenseUploadScreen config={CONFIG} />;
}
