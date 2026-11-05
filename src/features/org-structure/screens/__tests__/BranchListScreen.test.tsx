import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { branchesApi } from '@/api';
import type { Branch, BranchStaffMember } from '@/types/api/branches';

import BranchListScreen from '../BranchListScreen';
import { createTestClient, renderWithProviders, signInAs } from '../../testing/harness';

const mockPush = jest.fn();

jest.mock('@/lib/platform/notifications', () => ({ registerForPush: jest.fn(), subscribePushEvents: jest.fn(), showLocalNotification: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
  useFocusEffect: () => undefined,
}));
jest.mock('@/api', () => ({
  branchesApi: { listBranches: jest.fn(), getBranchStaff: jest.fn(), deleteBranch: jest.fn(), reassignStaff: jest.fn() },
}));

const api = branchesApi as jest.Mocked<typeof branchesApi>;
const branch = (id: string, name: string, over: Partial<Branch> = {}): Branch => ({
  id,
  name,
  address: `${name} street`,
  orgId: 'org-1',
  latitude: 12.97159,
  longitude: 77.59456,
  radius: 250,
  raw: {},
  ...over,
});
const member = (userId: string, name: string): BranchStaffMember => ({ userId, name, empId: userId.toUpperCase(), mobile: '', email: '', department: 'Ops', branchId: '1', branchName: 'Chennai' });

beforeEach(() => {
  jest.clearAllMocks();
  signInAs();
  api.listBranches.mockResolvedValue([branch('2', 'Pune'), branch('1', 'Chennai', { latitude: 0, longitude: 0, radius: 100 })]);
});

describe('BranchListScreen', () => {
  it('lists branches with GPS / No GPS and radius pills and the total', async () => {
    await renderWithProviders(<BranchListScreen />);
    expect(await screen.findByText('Chennai')).toBeTruthy();
    expect(screen.getByText('Pune')).toBeTruthy();
    expect(screen.getByText('12.9716, 77.5946')).toBeTruthy();
    expect(screen.getByText('No GPS')).toBeTruthy();
    expect(screen.getByText('250m radius')).toBeTruthy();
    expect(screen.getByText('100m radius')).toBeTruthy();
    expect(screen.getByText('Total Branches')).toBeTruthy();
    expect(api.listBranches).toHaveBeenCalledWith('org-1');
  });

  it('keeps the cached list and toasts when a refresh fails', async () => {
    const client = createTestClient();
    await renderWithProviders(<BranchListScreen />, client);
    expect(await screen.findByText('Pune')).toBeTruthy();
    api.listBranches.mockRejectedValue(new Error('offline'));
    await client.refetchQueries({ queryKey: ['branches'] });
    expect(await screen.findByText('Failed to load branches')).toBeTruthy();
    expect(screen.getByText('Pune')).toBeTruthy();
  });

  it('opens the editor with the branch id', async () => {
    await renderWithProviders(<BranchListScreen />);
    await fireEvent.press(await screen.findByLabelText('Edit Pune'));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: { branchId: '2' } }));
  });

  it('deletes an empty branch after confirmation', async () => {
    api.getBranchStaff.mockResolvedValue([]);
    api.deleteBranch.mockResolvedValue({ branchId: '1', branchName: 'Chennai', message: 'ok' });
    await renderWithProviders(<BranchListScreen />);
    await fireEvent.press(await screen.findByLabelText('Delete Chennai'));
    expect(await screen.findByText('Are you sure you want to delete "Chennai"? This action cannot be undone.')).toBeTruthy();
    expect(api.deleteBranch).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('branch-delete-dialog-confirm'));
    await waitFor(() => expect(api.deleteBranch).toHaveBeenCalledWith('1', 'org-1'));
    expect(await screen.findByText('Branch deleted successfully')).toBeTruthy();
  });

  it('shows an error instead of a delete dialog when the staff lookup fails', async () => {
    api.getBranchStaff.mockRejectedValue(new Error('Server unavailable'));
    await renderWithProviders(<BranchListScreen />);
    await fireEvent.press(await screen.findByLabelText('Delete Chennai'));
    expect(await screen.findByText('Server unavailable')).toBeTruthy();
    expect(screen.queryByText('Delete Branch')).toBeNull();
  });

  it('forces reassignment first: partial move keeps the sheet, moving the rest deletes the branch', async () => {
    api.getBranchStaff.mockResolvedValue([member('a', 'Asha'), member('b', 'Bala')]);
    api.reassignStaff.mockResolvedValue({ reassignedCount: 1, branchDeleted: false, message: 'ok' });
    api.deleteBranch.mockResolvedValue({ branchId: '1', branchName: 'Chennai', message: 'ok' });
    await renderWithProviders(<BranchListScreen />);
    await fireEvent.press(await screen.findByLabelText('Delete Chennai'));

    expect(await screen.findByText('2 staff in "Chennai" must be reassigned before deletion')).toBeTruthy();
    // The branch itself is never a target; the other one is.
    const submit = screen.getByTestId('reassign-submit');
    expect(submit.props.accessibilityState?.disabled ?? submit.props['aria-disabled']).toBeTruthy();
    await fireEvent.press(submit);
    expect(api.reassignStaff).not.toHaveBeenCalled();

    // Move one staff member to Pune.
    await fireEvent.press(screen.getByTestId('reassign-staff-a'));
    await fireEvent.press(screen.getAllByText('Pune').at(-1)!);
    expect(await screen.findByText('Reassign 1 Staff')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reassign-submit'));
    await waitFor(() => expect(api.reassignStaff).toHaveBeenCalledWith({ staffIds: ['a'], newBranchId: '2', orgId: 'org-1' }));
    expect(await screen.findByText('1 staff reassigned')).toBeTruthy();
    expect(api.deleteBranch).not.toHaveBeenCalled();
    expect(await screen.findByText('1 staff in "Chennai" must be reassigned before deletion')).toBeTruthy();

    // Move the rest: reassign, then delete the emptied branch.
    await fireEvent.press(screen.getByTestId('reassign-select-all'));
    await fireEvent.press(screen.getAllByText('Pune').at(-1)!);
    expect(await screen.findByText('Reassign All & Delete Branch')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reassign-submit'));
    await waitFor(() => expect(api.deleteBranch).toHaveBeenCalledWith('1', 'org-1'));
    expect(api.reassignStaff).toHaveBeenLastCalledWith({ staffIds: ['b'], newBranchId: '2', orgId: 'org-1' });
    expect(await screen.findByText('Staff reassigned and branch deleted')).toBeTruthy();
    await waitFor(() => expect(screen.queryByTestId('reassign-sheet')).toBeNull());
  });

  it('says the staff moved when only the final delete fails, and offers a retry', async () => {
    api.getBranchStaff.mockResolvedValue([member('a', 'Asha')]);
    api.reassignStaff.mockResolvedValue({ reassignedCount: 1, branchDeleted: false, message: 'ok' });
    api.deleteBranch.mockRejectedValueOnce(new Error('Branch not found or access denied')).mockResolvedValueOnce({ branchId: '1', branchName: 'Chennai', message: 'ok' });
    await renderWithProviders(<BranchListScreen />);
    await fireEvent.press(await screen.findByLabelText('Delete Chennai'));
    await fireEvent.press(await screen.findByTestId('reassign-staff-a'));
    await fireEvent.press(screen.getAllByText('Pune').at(-1)!);
    await fireEvent.press(screen.getByTestId('reassign-submit'));
    expect(await screen.findByText('Staff reassigned, but the branch was not deleted: Branch not found or access denied')).toBeTruthy();
    // Falls back to the plain confirm dialog for the (now empty) branch.
    await fireEvent.press(await screen.findByTestId('branch-delete-dialog-confirm'));
    await waitFor(() => expect(api.deleteBranch).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Branch deleted successfully')).toBeTruthy();
  });

  it('keeps the list and reports the failure when the reassignment fails', async () => {
    api.getBranchStaff.mockResolvedValue([member('a', 'Asha'), member('b', 'Bala')]);
    api.reassignStaff.mockRejectedValue(new Error('Target branch not found'));
    await renderWithProviders(<BranchListScreen />);
    await fireEvent.press(await screen.findByLabelText('Delete Chennai'));
    await fireEvent.press(await screen.findByTestId('reassign-staff-a'));
    await fireEvent.press(screen.getAllByText('Pune').at(-1)!);
    await fireEvent.press(screen.getByTestId('reassign-submit'));
    expect((await screen.findAllByText('Target branch not found')).length).toBeGreaterThan(0);
    expect(screen.getByText('2 staff in "Chennai" must be reassigned before deletion')).toBeTruthy();
    expect(api.deleteBranch).not.toHaveBeenCalled();
  });
});
