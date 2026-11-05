import { api } from '@/lib/api/client';
import { updateBonusIncentive } from '@/api/payroll';

jest.mock('@/lib/api/client', () => jest.requireActual('@/api/testUtils/apiMock').clientMock());

const mockedPut = (api as unknown as { put: jest.Mock }).put;

beforeEach(() => mockedPut.mockReset());

describe('updateBonusIncentive', () => {
  it('sends only the percentage when no period is given (unchanged v1 behaviour)', async () => {
    mockedPut.mockResolvedValue({ success: true });
    await updateBonusIncentive('B1', 12.5);
    expect(mockedPut).toHaveBeenCalledWith('/api/incentive/bonus/B1', { bonus_percent: 12.5 });
  });

  it('also sends month and year so the edit is persisted', async () => {
    mockedPut.mockResolvedValue({ success: true });
    await updateBonusIncentive('B1', 12.5, { month: 'June', year: 2027 });
    expect(mockedPut).toHaveBeenCalledWith('/api/incentive/bonus/B1', { bonus_percent: 12.5, month: 'June', year: 2027 });
  });
});
