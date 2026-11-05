import { FALLBACK_EMPLOYEE_ID, incrementEmployeeId, suggestEmployeeId } from '../employeeId';

describe('incrementEmployeeId', () => {
  it('counts up numeric ids and refuses anything else', () => {
    expect(incrementEmployeeId('1007')).toBe('1008');
    expect(incrementEmployeeId(' 99 ')).toBe('100');
    expect(incrementEmployeeId('EMP100')).toBeNull();
    expect(incrementEmployeeId('')).toBeNull();
  });
});

describe('suggestEmployeeId', () => {
  it('returns the server suggestion when it is free', async () => {
    const isAvailable = jest.fn().mockResolvedValue(true);
    await expect(suggestEmployeeId({ getNext: async () => '1042', isAvailable })).resolves.toBe('1042');
    expect(isAvailable).toHaveBeenCalledTimes(1);
  });

  it('increments until an unused id is found', async () => {
    const taken = new Set(['1042', '1043', '1044']);
    const isAvailable = jest.fn(async (id: string) => !taken.has(id));
    await expect(suggestEmployeeId({ getNext: async () => '1042', isAvailable })).resolves.toBe('1045');
    expect(isAvailable).toHaveBeenCalledTimes(4);
  });

  it('falls back to 1000 when the suggestion lookup fails or is blank', async () => {
    const isAvailable = jest.fn().mockResolvedValue(true);
    await expect(
      suggestEmployeeId({
        getNext: async () => {
          throw new Error('offline');
        },
        isAvailable,
      }),
    ).resolves.toBe(FALLBACK_EMPLOYEE_ID);
    await expect(suggestEmployeeId({ getNext: async () => '  ', isAvailable })).resolves.toBe(FALLBACK_EMPLOYEE_ID);
  });

  it('fails open when the availability lookup throws', async () => {
    const isAvailable = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(suggestEmployeeId({ getNext: async () => '1000', isAvailable })).resolves.toBe('1000');
  });

  it('never turns a non-numeric id into NaN', async () => {
    const isAvailable = jest.fn().mockResolvedValue(false);
    await expect(suggestEmployeeId({ getNext: async () => 'EMP-7', isAvailable })).resolves.toBe('EMP-7');
    expect(isAvailable).toHaveBeenCalledTimes(1);
  });

  it('is bounded', async () => {
    const isAvailable = jest.fn().mockResolvedValue(false);
    const result = await suggestEmployeeId({ getNext: async () => '1', isAvailable, maxSteps: 5 });
    expect(result).toBe('7');
    expect(isAvailable).toHaveBeenCalledTimes(6);
  });
});
