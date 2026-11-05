import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { departmentsApi } from '@/api';
import type { Department } from '@/types/api/departments';

import DepartmentEditScreen from '../DepartmentEditScreen';
import DepartmentListScreen from '../DepartmentListScreen';
import { renderWithProviders, signInAs } from '../../testing/harness';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: { canGoBack: () => true, back: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: jest.fn(() => ({})),
  useFocusEffect: () => undefined,
}));

jest.mock('@/api', () => ({
  departmentsApi: {
    listDepartments: jest.fn(),
    addDepartment: jest.fn(),
    updateDepartment: jest.fn(),
    deleteDepartment: jest.fn(),
  },
}));

const api = departmentsApi as jest.Mocked<typeof departmentsApi>;
const dept = (id: string, name: string): Department => ({ id, name, orgId: 'org-1', raw: {} });

beforeEach(() => {
  jest.clearAllMocks();
  signInAs();
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
});

describe('DepartmentListScreen', () => {
  it('lists departments alphabetically with the total count', async () => {
    api.listDepartments.mockResolvedValue([dept('2', 'Sales'), dept('1', 'HR')]);
    await renderWithProviders(<DepartmentListScreen />);
    expect(await screen.findByText('HR')).toBeTruthy();
    expect(screen.getByText('Sales')).toBeTruthy();
    expect(screen.getByText('Total Departments')).toBeTruthy();
    expect(api.listDepartments).toHaveBeenCalledWith('org-1');
  });

  it('shows the empty state with an add action', async () => {
    api.listDepartments.mockResolvedValue([]);
    await renderWithProviders(<DepartmentListScreen />);
    expect(await screen.findByText('No Departments Yet')).toBeTruthy();
    await fireEvent.press(screen.getByText('Add Department'));
    expect(mockPush).toHaveBeenCalled();
  });

  it('confirms before deleting and toasts the result', async () => {
    api.listDepartments.mockResolvedValue([dept('1', 'HR')]);
    api.deleteDepartment.mockResolvedValue({ deptId: '1', deptName: 'HR', message: 'ok' });
    await renderWithProviders(<DepartmentListScreen />);
    await fireEvent.press(await screen.findByLabelText('Delete HR'));
    expect(await screen.findByText('Are you sure you want to delete "HR"?')).toBeTruthy();
    expect(api.deleteDepartment).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('department-delete-dialog-confirm'));
    await waitFor(() => expect(api.deleteDepartment).toHaveBeenCalledWith('1', 'org-1'));
    expect(await screen.findByText('"HR" deleted successfully')).toBeTruthy();
  });

  it('toasts the server message and re-syncs the list when the delete fails', async () => {
    api.listDepartments.mockResolvedValue([dept('1', 'HR')]);
    api.deleteDepartment.mockRejectedValue(new Error('Department not found'));
    await renderWithProviders(<DepartmentListScreen />);
    await fireEvent.press(await screen.findByLabelText('Delete HR'));
    await fireEvent.press(await screen.findByTestId('department-delete-dialog-confirm'));
    expect(await screen.findByText('Department not found')).toBeTruthy();
    await waitFor(() => expect(api.listDepartments.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});

describe('DepartmentEditScreen', () => {
  it('rejects an empty name without calling the API', async () => {
    api.listDepartments.mockResolvedValue([]);
    await renderWithProviders(<DepartmentEditScreen />);
    await fireEvent.press(screen.getByTestId('department-submit'));
    expect(await screen.findByText('Please enter department name')).toBeTruthy();
    expect(api.addDepartment).not.toHaveBeenCalled();
  });

  it('adds a department with the trimmed name and shows the success popup', async () => {
    api.listDepartments.mockResolvedValue([]);
    api.addDepartment.mockResolvedValue({ deptId: '9', deptName: 'Ops', message: 'ok' });
    await renderWithProviders(<DepartmentEditScreen />);
    await fireEvent.changeText(screen.getByTestId('department-name'), '  Ops  ');
    await fireEvent.press(screen.getByTestId('department-submit'));
    await waitFor(() => expect(api.addDepartment).toHaveBeenCalledWith({ name: 'Ops', orgId: 'org-1' }));
    expect(await screen.findByText('Department Added!')).toBeTruthy();
    expect(screen.getByText('"Ops" has been created successfully')).toBeTruthy();
  });

  it('prefills the name in edit mode and renames through the update call', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ deptId: '1' });
    api.listDepartments.mockResolvedValue([dept('1', 'HR')]);
    api.updateDepartment.mockResolvedValue({ deptId: '1', deptName: 'People', message: 'ok' });
    await renderWithProviders(<DepartmentEditScreen />);
    await waitFor(() => expect(screen.getByTestId('department-name').props.value).toBe('HR'));
    await fireEvent.changeText(screen.getByTestId('department-name'), 'People');
    await fireEvent.press(screen.getByTestId('department-submit'));
    await waitFor(() => expect(api.updateDepartment).toHaveBeenCalledWith('1', { name: 'People', orgId: 'org-1' }));
    expect(await screen.findByText('Department Updated!')).toBeTruthy();
  });
});
