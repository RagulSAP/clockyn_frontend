/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { employeeApi } from '@/api';
import { pickImage } from '@/lib/platform/media';
import { useAuthStore } from '@/store/auth';

import PersonalDetailsScreen from '../screens/PersonalDetailsScreen';
import { renderScreen, routerBack, signInAs, staffSession, mockOf as m } from './harness';

jest.mock('expo-router', () => require('./harness').routerMock());
jest.mock('@/components/layout', () => require('./harness').layoutMock());
jest.mock('@/api', () => ({
  employeeApi: { getPersonalDetails: jest.fn(), updatePersonalDetails: jest.fn(), uploadProfilePhoto: jest.fn() },
}));
jest.mock('@/lib/platform/media', () => ({ pickImage: jest.fn(), MediaPermissionError: class extends Error {} }));

const details = {
  userId: 'u1',
  name: 'Asha Rao',
  empId: 'E-101',
  mobile: '9876543210',
  email: 'asha@acme.in',
  branchName: 'HQ',
  deptName: 'Ops',
  roleName: 'Staff',
  dob: '1990-05-17',
  panNo: 'ABCDE1234F',
  raw: {},
};

beforeEach(() => {
  jest.clearAllMocks();
  signInAs(staffSession);
  m(employeeApi.getPersonalDetails).mockResolvedValue(details);
  m(employeeApi.updatePersonalDetails).mockResolvedValue({ message: 'ok' });
});

async function openEdit() {
  await renderScreen(<PersonalDetailsScreen />);
  await screen.findByTestId('profile-edit');
  await screen.findByText('E-101');
  await fireEvent.press(screen.getByTestId('profile-edit'));
  await screen.findByTestId('profile-save');
}

describe('PersonalDetailsScreen', () => {
  it('shows the profile in view mode with em dashes for empty values', async () => {
    await renderScreen(<PersonalDetailsScreen />);
    expect(await screen.findByText('E-101')).toBeTruthy();
    expect(screen.getByTestId('profile-name').props.children).toBe('Asha Rao');
    expect(screen.getByTestId('profile-branch')).toBeTruthy();
    for (const title of ['Personal Info', 'Identity & Compliance', 'Bank Details']) expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText('17/05/1990')).toBeTruthy();
    expect(screen.getByText('ABCDE1234F')).toBeTruthy();
    expect(screen.getAllByText('—').length).toBeGreaterThan(5);
    expect(screen.queryByTestId('profile-save')).toBeNull();
  });

  it('shows a retry state when the details cannot be loaded', async () => {
    m(employeeApi.getPersonalDetails).mockRejectedValue(new Error('down'));
    await renderScreen(<PersonalDetailsScreen />);
    expect(await screen.findByText('Could not load your details.')).toBeTruthy();
  });

  it('edit mode: sanitises input, blocks an invalid change with an inline hint and does not call the API', async () => {
    await openEdit();
    await fireEvent.changeText(screen.getByTestId('field-aadhaar'), '12ab34');
    expect(screen.getByTestId('field-aadhaar').props.value).toBe('1234');
    await fireEvent.changeText(screen.getByTestId('field-pan'), 'abcde1234f');
    expect(screen.getByTestId('field-pan').props.value).toBe('ABCDE1234F');
    expect((await screen.findAllByText('12-digit number')).length).toBeGreaterThan(0);
    await act(async () => {
      await fireEvent.press(screen.getByTestId('profile-save'));
    });
    expect(await screen.findByText(/Invalid Input/)).toBeTruthy();
    expect(employeeApi.updatePersonalDetails).not.toHaveBeenCalled();
  });

  it('saves valid edits, shows "Saved!" and updates the session name used by the home greeting', async () => {
    await openEdit();
    await fireEvent.changeText(screen.getByTestId('field-name'), 'Asha K Rao');
    await fireEvent.changeText(screen.getByTestId('field-address'), '12 MG Road');
    await act(async () => {
      await fireEvent.press(screen.getByTestId('profile-save'));
    });
    await waitFor(() => expect(employeeApi.updatePersonalDetails).toHaveBeenCalledTimes(1));
    expect(m(employeeApi.updatePersonalDetails).mock.calls[0][0]).toBe('u1');
    expect(m(employeeApi.updatePersonalDetails).mock.calls[0][1]).toMatchObject({ name: 'Asha K Rao', address: '12 MG Road', dob: '1990-05-17' });
    expect(await screen.findByText('Saved!')).toBeTruthy();
    expect(screen.getByText('Personal details updated successfully')).toBeTruthy();
    expect(useAuthStore.getState().session?.name).toBe('Asha K Rao');
  });

  it('keeps the edits and shows the server message when the save fails', async () => {
    m(employeeApi.updatePersonalDetails).mockRejectedValue(new Error('Email already in use'));
    await openEdit();
    await fireEvent.changeText(screen.getByTestId('field-address'), 'Elsewhere');
    await act(async () => {
      await fireEvent.press(screen.getByTestId('profile-save'));
    });
    expect(await screen.findByText('Email already in use')).toBeTruthy();
    expect(screen.getByTestId('profile-save')).toBeTruthy();
    expect(screen.getByTestId('field-address').props.value).toBe('Elsewhere');
  });

  it('guards back with unsaved changes (Keep editing / Exit) and leaves directly when nothing changed', async () => {
    await renderScreen(<PersonalDetailsScreen />);
    await screen.findByText('E-101');
    await fireEvent.press(screen.getByTestId('profile-edit'));
    await screen.findByTestId('profile-save');
    await fireEvent.changeText(screen.getByTestId('field-address'), 'New');
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(await screen.findByText('You have unsaved changes. Do you want to save before leaving?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('guard-stay'));
    expect(routerBack).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Go back'));
    await fireEvent.press(await screen.findByTestId('guard-exit'));
    expect(routerBack).toHaveBeenCalled();
  });

  it('goes back immediately when there are no edits', async () => {
    await renderScreen(<PersonalDetailsScreen />);
    await screen.findByText('E-101');
    await fireEvent.press(screen.getByLabelText('Go back'));
    expect(routerBack).toHaveBeenCalled();
    expect(screen.queryByText('Unsaved Changes')).toBeNull();
  });
  it('uploads a picked photo after the save and keeps the upload URL when the details carry no photo', async () => {
    m(pickImage).mockResolvedValue({ uri: 'file:///new.jpg', fileName: 'p.jpg', mimeType: 'image/jpeg' });
    m(employeeApi.uploadProfilePhoto).mockResolvedValue('https://cdn.example/p.jpg');
    await openEdit();
    await fireEvent.press(screen.getByTestId('profile-photo'));
    await fireEvent.press(await screen.findByText('Take Photo'));
    await waitFor(() => expect(pickImage).toHaveBeenCalled());
    await act(async () => {
      await fireEvent.press(screen.getByTestId('profile-save'));
    });
    await waitFor(() => expect(employeeApi.uploadProfilePhoto).toHaveBeenCalledWith('u1', { uri: 'file:///new.jpg', fileName: 'p.jpg', mimeType: 'image/jpeg' }));
    expect(await screen.findByText('Saved!')).toBeTruthy();
    expect(employeeApi.updatePersonalDetails).toHaveBeenCalledTimes(1);
  });

  it('still saves the details and tells the user when only the photo upload fails', async () => {
    m(pickImage).mockResolvedValue({ uri: 'file:///new.jpg' });
    m(employeeApi.uploadProfilePhoto).mockRejectedValue(new Error('upload down'));
    await openEdit();
    await fireEvent.press(screen.getByTestId('profile-photo'));
    await fireEvent.press(await screen.findByText('Take Photo'));
    await waitFor(() => expect(pickImage).toHaveBeenCalled());
    await act(async () => {
      await fireEvent.press(screen.getByTestId('profile-save'));
    });
    expect(await screen.findByText('Your details were saved, but the new photo could not be uploaded. Please try again.')).toBeTruthy();
    expect(await screen.findByText('Saved!')).toBeTruthy();
  });
});
