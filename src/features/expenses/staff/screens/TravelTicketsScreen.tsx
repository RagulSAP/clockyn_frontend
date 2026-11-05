import React from 'react';

import { ExpenseUploadScreen, type ExpenseScreenConfig } from './ExpenseUploadScreen';

const CONFIG: ExpenseScreenConfig = {
  type: 'travel',
  title: 'Travel Tickets',
  listTitle: 'Submitted Tickets',
  columnLabel: 'Ticket',
  emptyTitle: 'No tickets yet',
  emptyMessage: (date) => `Submitted tickets for ${date} will appear here`,
  placeholderIcon: 'bus',
  addTitle: 'Add Travel Ticket',
  addSubtitle: 'Upload your ticket photo and enter the amount',
  photoLabel: 'Ticket Photo',
  uploadTitle: 'Upload Ticket Photo',
  uploadSubtitle: 'Tap to take a photo',
  submitLabel: 'Submit Ticket',
  successTitle: 'Ticket Submitted!',
  successMessage: 'Your travel ticket has been recorded successfully.',
  failureFallback: 'Failed to submit travel ticket',
  noun: 'ticket',
};

/** Travel tickets: photo + amount per date. */
export default function TravelTicketsScreen() {
  return <ExpenseUploadScreen config={CONFIG} />;
}
