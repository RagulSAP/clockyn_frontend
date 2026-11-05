import { EMPTY_BRANCH_FORM, formatGps, formatRadius, hasGps, radiusChoices, sortBranches, validateBranchForm } from '../branchForm';
import { validateDepartmentName, sortDepartments, departmentSavedMessage } from '../departmentForm';

describe('validateBranchForm', () => {
  it('requires name, address and GPS together, with the v1 messages', () => {
    expect(validateBranchForm(EMPTY_BRANCH_FORM)).toEqual({
      name: 'Branch name is required',
      address: 'Branch address is required',
      gps: 'Please select GPS location',
    });
  });

  it('accepts a complete form and treats (0, 0) as unset', () => {
    expect(validateBranchForm({ name: 'HQ', address: 'Street 1', latitude: 12.9, longitude: 77.6, radius: 250 })).toEqual({});
    expect(validateBranchForm({ name: ' ', address: 'x', latitude: 0, longitude: 77.6, radius: 100 })).toEqual({ name: 'Branch name is required' });
    expect(hasGps(0, 0)).toBe(false);
    expect(hasGps(0, 0.0001)).toBe(true);
    expect(hasGps(undefined, undefined)).toBe(false);
  });
});

describe('branch helpers', () => {
  it('formats GPS and radius', () => {
    expect(formatGps(12.971599, 77.594566, 4)).toBe('12.9716, 77.5946');
    expect(formatGps(12.971599, 77.594566, 6)).toBe('12.971599, 77.594566');
    expect(formatRadius(250)).toBe('250m radius');
    expect(formatRadius(0)).toBe('100m radius');
  });

  it('offers the five radii plus an out-of-set stored value', () => {
    expect(radiusChoices(100)).toEqual([100, 250, 500, 750, 1000]);
    expect(radiusChoices(300)).toEqual([100, 250, 300, 500, 750, 1000]);
  });

  it('sorts by name', () => {
    expect(sortBranches([{ name: 'Pune' }, { name: 'Chennai' }, { name: 'Delhi' }]).map((b) => b.name)).toEqual(['Chennai', 'Delhi', 'Pune']);
  });
});

describe('department helpers', () => {
  it('validates the name', () => {
    expect(validateDepartmentName('  ')).toBe('Please enter department name');
    expect(validateDepartmentName('Sales')).toBeNull();
  });
  it('sorts and words the saved popup', () => {
    const base = { orgId: 'o', raw: {} };
    expect(sortDepartments([{ id: '2', name: 'Sales', ...base }, { id: '1', name: 'HR', ...base }]).map((d) => d.name)).toEqual(['HR', 'Sales']);
    expect(departmentSavedMessage('HR', false)).toBe('"HR" has been created successfully');
    expect(departmentSavedMessage('HR', true)).toBe('"HR" has been updated successfully');
  });
});
