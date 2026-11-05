import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ToastProvider, toast } from '@/components/ui';
import { useAuthStore } from '@/store/auth';
import { ThemeProvider } from '@/theme';
import type { CompanyDetails } from '@/types/api/company';

import CompanyEditScreen from '../screens/CompanyEditScreen';
import CompanyViewScreen from '../screens/CompanyViewScreen';

let mockParams: Record<string, string> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBackOr = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true, dismissAll: jest.fn() }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock('@/lib/navigation', () => ({
  ...jest.requireActual('@/lib/navigation'),
  useAppRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), backOr: mockBackOr, dismissAll: jest.fn(), canGoBack: () => true, goHome: jest.fn() }),
}));

const mockDetails = jest.fn();
const mockList = jest.fn();
const mockDelete = jest.fn();
const mockAdd = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateLogo = jest.fn();
jest.mock('@/api/company', () => ({
  getCompanyDetails: (...a: unknown[]) => mockDetails(...a),
  listCompanies: (...a: unknown[]) => mockList(...a),
  deleteCompany: (...a: unknown[]) => mockDelete(...a),
  addCompany: (...a: unknown[]) => mockAdd(...a),
  updateCompany: (...a: unknown[]) => mockUpdate(...a),
  updateCompanyLogo: (...a: unknown[]) => mockUpdateLogo(...a),
}));
jest.mock('@/api/branches', () => ({ listBranches: jest.fn(async () => [{ id: '1', name: 'HQ' }]) }));
jest.mock('@/api/departments', () => ({ listDepartments: jest.fn(async () => [{ id: 'd1', name: 'Sales' }, { id: 'd2', name: 'Ops' }]) }));
const mockRequestOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockUploadLogo = jest.fn();
jest.mock('@/api/auth', () => ({
  requestOtp: (...a: unknown[]) => mockRequestOtp(...a),
  verifyOtp: (...a: unknown[]) => mockVerifyOtp(...a),
  uploadOrgLogo: (...a: unknown[]) => mockUploadLogo(...a),
}));
jest.mock('@/lib/platform/media', () => ({ pickImage: jest.fn(async () => null) }));

const company = (over: Partial<CompanyDetails> = {}): CompanyDetails => ({
  orgId: 'org1',
  name: 'Acme Traders',
  address: '1 Main Road',
  gst: 'LEG',
  raw: {},
  state: 'Maharashtra',
  district: 'Pune',
  pincode: 411001,
  mobile: '9876543210',
  email: 'owner@acme.com',
  ...over,
});

function renderScreen(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>{ui}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

const co = (orgId: string, name: string) => ({ orgId, name, address: '', gst: '', raw: {} });

beforeEach(() => {
  jest.clearAllMocks();
  toast.clear();
  mockParams = { orgId: 'org1' };
  useAuthStore.setState({ session: { userId: 'admin1', orgId: 'org1', orgName: 'Acme Traders', roleId: 1, managerPermissions: [] }, hydrated: true });
  mockDetails.mockResolvedValue(company({ pan: 'ABCDE1234F', businessCategory: 'Retail' }));
  mockList.mockResolvedValue([co('org1', 'Acme Traders')]);
  mockDelete.mockResolvedValue({ message: 'Company deleted successfully', remaining: [co('org2', 'Second Co')] });
  mockAdd.mockResolvedValue({ orgId: 'org9', message: 'Company added' });
  mockUpdate.mockResolvedValue({ orgId: 'org1', message: 'Company updated' });
  mockUpdateLogo.mockResolvedValue('https://logo');
  mockRequestOtp.mockResolvedValue({ message: 'OTP sent' });
  mockVerifyOtp.mockResolvedValue({});
  mockUploadLogo.mockResolvedValue(undefined);
});

describe('CompanyViewScreen', () => {
  it('shows contact info always and the optional sections only when data exists', async () => {
    await renderScreen(<CompanyViewScreen />);
    expect((await screen.findAllByText('Acme Traders')).length).toBeGreaterThan(0);
    expect(screen.getByText('Retail')).toBeTruthy();
    expect(screen.getByText('MOBILE')).toBeTruthy();
    expect(screen.getByText('EMAIL')).toBeTruthy();
    expect(screen.getByText('Legal & Compliance')).toBeTruthy();
    expect(screen.getByText('PAN')).toBeTruthy();
    expect(screen.queryByText('CIN')).toBeNull();
    expect(screen.queryByText('WEBSITE')).toBeNull();
    expect(await screen.findByText('Structure')).toBeTruthy();
    expect(screen.queryByTestId('company-delete')).toBeNull(); // only one company
  });

  it('hides the Legal section without any statutory id', async () => {
    mockDetails.mockResolvedValue(company());
    await renderScreen(<CompanyViewScreen />);
    await screen.findByTestId('company-contact');
    expect(screen.queryByText('Legal & Compliance')).toBeNull();
  });

  it('opens the edit form with the company id only (no JSON blobs)', async () => {
    await renderScreen(<CompanyViewScreen />);
    await fireEvent.press(await screen.findByTestId('company-edit'));
    expect(mockPush).toHaveBeenCalledWith('/admin/company/edit', { orgId: 'org1' });
  });

  it('deletes after confirmation, switches the active company and returns home', async () => {
    mockList.mockResolvedValue([co('org1', 'Acme Traders'), co('org2', 'Second Co')]);
    await renderScreen(<CompanyViewScreen />);
    await fireEvent.press(await screen.findByTestId('company-delete'));
    expect(await screen.findByText('Are you sure you want to delete this company? This action cannot be undone.')).toBeTruthy();
    await fireEvent.press(screen.getAllByText('Delete').slice(-1)[0]);
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('org1', 'admin1'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/admin/home'));
    expect(useAuthStore.getState().session?.orgId).toBe('org2');
    expect(useAuthStore.getState().session?.orgName).toBe('Second Co');
  });

  it('a network error never leaves the delete spinner stuck', async () => {
    mockList.mockResolvedValue([co('org1', 'Acme Traders'), co('org2', 'Second Co')]);
    mockDelete.mockRejectedValue(new Error('Network connection failed.'));
    await renderScreen(<CompanyViewScreen />);
    await fireEvent.press(await screen.findByTestId('company-delete'));
    await fireEvent.press((await screen.findAllByText('Delete')).slice(-1)[0]);
    expect(await screen.findByText('Network connection failed.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session?.orgId).toBe('org1');
    await waitFor(() => expect(screen.queryByText('Deleting Company...')).toBeNull());
  });
});

describe('CompanyEditScreen', () => {
  it('add mode: refuses incomplete forms, then creates the company with branches and the default department', async () => {
    mockParams = {};
    await renderScreen(<CompanyEditScreen />);
    await fireEvent.press(await screen.findByTestId('company-submit'));
    expect(await screen.findByText('Please fill all required fields including State, District and Pincode')).toBeTruthy();
    expect(mockAdd).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('company-name'), 'New Co');
    await fireEvent.changeText(screen.getByTestId('company-address'), '2 Side Street');
    await fireEvent.changeText(screen.getByTestId('company-state'), 'Goa');
    await fireEvent.changeText(screen.getByTestId('company-district'), 'North Goa');
    await fireEvent.changeText(screen.getByTestId('company-pincode'), '403001');
    await fireEvent.changeText(screen.getByTestId('company-branches-0'), 'Panaji');
    await fireEvent.press(screen.getByTestId('company-submit'));
    await waitFor(() => expect(mockAdd).toHaveBeenCalledTimes(1));
    expect(mockAdd.mock.calls[0][0]).toMatchObject({ userId: 'admin1', name: 'New Co', branches: ['Panaji'], departments: ['General'], pincode: 403001, gst: '' });
    await waitFor(() => expect(mockBackOr).toHaveBeenCalled());
  });

  it('PAN format errors are shown inline but do not block saving', async () => {
    mockParams = {};
    await renderScreen(<CompanyEditScreen />);
    await fireEvent.press(await screen.findByTestId('company-more-toggle'));
    await fireEvent.changeText(screen.getByTestId('company-pan'), 'abc');
    expect(await screen.findByText('Invalid PAN format')).toBeTruthy();
    expect(screen.getByTestId('company-pan').props.value).toBe('ABC');
  });

  it('edit mode: pre-fills, hides branches, and requires OTP verification of a changed mobile number', async () => {
    await renderScreen(<CompanyEditScreen />);
    await waitFor(() => expect(screen.getByTestId('company-name').props.value).toBe('Acme Traders'));
    expect(screen.queryByTestId('company-branches-0')).toBeNull();
    expect(screen.getByTestId('company-departments-0').props.value).toBe('Sales');
    expect(screen.queryByTestId('company-mobile-get-otp')).toBeNull(); // unchanged -> no OTP button

    await fireEvent.changeText(screen.getByTestId('company-mobile'), '9111111111');
    await fireEvent.press(screen.getByTestId('company-submit'));
    expect(await screen.findByText('Please verify new mobile number')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('company-mobile-get-otp'));
    await waitFor(() => expect(mockRequestOtp).toHaveBeenCalledWith({ contact: '9111111111', purpose: 'registration' }));
    await fireEvent.changeText(await screen.findByTestId('company-mobile-otp'), '123456');
    await fireEvent.press(screen.getByTestId('company-mobile-verify'));
    await waitFor(() => expect(mockVerifyOtp).toHaveBeenCalledWith({ contact: '9111111111', otp: '123456', purpose: 'registration' }));
    await waitFor(() => expect(screen.getByTestId('company-mobile-verified')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('company-submit'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const [orgId, input] = mockUpdate.mock.calls[0] as [string, Record<string, unknown>];
    expect(orgId).toBe('org1');
    expect(input).toMatchObject({ branches: [], mobile: '9111111111', gst: 'LEG' });
    expect(useAuthStore.getState().session?.orgName).toBe('Acme Traders');
  });

  it('a wrong OTP clears the digits and says so', async () => {
    mockVerifyOtp.mockRejectedValue(new Error('bad'));
    await renderScreen(<CompanyEditScreen />);
    await waitFor(() => expect(screen.getByTestId('company-name').props.value).toBe('Acme Traders'));
    await fireEvent.changeText(screen.getByTestId('company-email'), 'new@acme.com');
    await fireEvent.press(screen.getByTestId('company-email-get-otp'));
    await fireEvent.changeText(await screen.findByTestId('company-email-otp'), '654321');
    await fireEvent.press(screen.getByTestId('company-email-verify'));
    expect(await screen.findByText('Invalid email OTP')).toBeTruthy();
  });

  it('keeps the form and shows the server message when saving fails', async () => {
    mockUpdate.mockRejectedValue(new Error('Company name already used'));
    await renderScreen(<CompanyEditScreen />);
    await waitFor(() => expect(screen.getByTestId('company-name').props.value).toBe('Acme Traders'));
    await fireEvent.press(screen.getByTestId('company-submit'));
    expect(await screen.findByText('Company name already used')).toBeTruthy();
    expect(mockBackOr).not.toHaveBeenCalled();
    expect(screen.getByTestId('company-name').props.value).toBe('Acme Traders');
  });
});
