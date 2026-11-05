import { mapBranch, mapBranchStaff, mapCompany, mapCompanyDetails, mapDepartment, toBranchBody, toCompanyBody } from '../mappers/org';
import { mapManager, mapPermissions, toAssignBody } from '../mappers/managers';
import { mapShift, mapSingleShift, toShiftBody } from '../mappers/shifts';
import { mapDashboardStats, mapDateInfo, mapDepartmentStats } from '../mappers/home';

describe('branches / departments', () => {
  it('mapBranch uses string ids and the default radius', () => {
    const b = mapBranch({ branch_id: 12, branch_name: 'HQ', branch_address: null, org_id: 'o1', branch_latitude: '12.5', branch_longitude: 77.5 });
    expect(b).toMatchObject({ id: '12', name: 'HQ', address: '', orgId: 'o1', latitude: 12.5, longitude: 77.5, radius: 100 });
  });

  it('mapBranch keeps an explicit radius and zero coordinates when missing', () => {
    const b = mapBranch({ branch_id: '1', branch_name: 'X', punch_radius: 250 });
    expect(b.radius).toBe(250);
    expect(b.latitude).toBe(0);
    expect(b.longitude).toBe(0);
  });

  it('toBranchBody uses the legacy write field names', () => {
    expect(toBranchBody({ orgId: 'o1', name: ' HQ ', address: ' 1 Rd ', latitude: 1.5, longitude: 2.5, radius: 120 })).toEqual({
      branch_name: 'HQ',
      branch_address: '1 Rd',
      branch_latitude: 1.5,
      branch_longitude: 2.5,
      punch_radius: 120,
      org_id: 'o1',
    });
  });

  it('mapBranchStaff / mapDepartment', () => {
    expect(
      mapBranchStaff({ user_id: 'u', name: 'N', emp_id: 'E', mobile_number: '9', email: 'e', dept_name: '', current_branch_id: 3, current_branch_name: 'B' }),
    ).toMatchObject({ branchId: '3', branchName: 'B', department: '' });
    expect(mapDepartment({ dept_id: 'd1', dept_name: 'Sales', org_id: 'o' })).toMatchObject({ id: 'd1', name: 'Sales', orgId: 'o' });
  });
});

describe('company', () => {
  it('mapCompany / mapCompanyDetails', () => {
    expect(mapCompany({ org_id: 'o1', org_name: 'Acme', org_address: 'Rd', org_gst: '', created_at: '2026-01-01T00:00:00' })).toMatchObject({
      orgId: 'o1',
      name: 'Acme',
      gst: '',
    });
    const d = mapCompanyDetails({
      org_id: 'o1',
      org_name: 'Acme',
      parent_id: 'owner',
      pincode: '560001',
      logo_url: '',
      org_logo: 'key.png',
      pan_number: 'ABCDE1234F',
      gst_number: '29ABCDE1234F1Z5',
    });
    expect(d).toMatchObject({ ownerId: 'owner', pincode: 560001, logoUrl: 'key.png', pan: 'ABCDE1234F', gstNumber: '29ABCDE1234F1Z5' });
  });

  it('toCompanyBody keeps legacy names and drops blank optionals', () => {
    const body = toCompanyBody({
      userId: 'u1',
      name: ' Acme ',
      address: 'Rd',
      gst: '',
      gstNumber: '29X',
      branches: ['Main Branch'],
      departments: ['General'],
      pincode: 560001,
      pan: '',
    });
    expect(body).toEqual({
      user_id: 'u1',
      org_name: 'Acme',
      org_address: 'Rd',
      org_gst: '',
      gst_number: '29X',
      departments: ['General'],
      branches: ['Main Branch'],
      pincode: 560001,
    });
  });
});

describe('managers', () => {
  it('mapManager maps assignments; a missing dept id means all departments', () => {
    const m = mapManager({
      user_id: 'u',
      name: 'M',
      emp_id: 'E',
      role_id: 2,
      assignments: [
        { branch_id: 1, branch_name: 'HQ', dept_id: 'd1', dept_name: 'Sales' },
        { branch_id: 2, branch_name: 'B2', dept_id: null, dept_name: 'All' },
      ],
    });
    expect(m.assignments).toEqual([
      { branchId: '1', branchName: 'HQ', deptId: 'd1', deptName: 'Sales' },
      { branchId: '2', branchName: 'B2', deptId: null, deptName: 'All' },
    ]);
    expect(mapManager({ user_id: 'x' }).assignments).toEqual([]);
  });

  it('mapPermissions coerces to booleans', () => {
    expect(mapPermissions({ success: true, permissions: { 'Staff Management': true, Other: 0 } })).toEqual({ 'Staff Management': true, Other: false });
    expect(mapPermissions({})).toEqual({});
  });

  it('toAssignBody sends numeric branch ids and omits an empty dept id', () => {
    expect(toAssignBody({ userId: 'u', assignments: [{ branchId: '3', deptId: 'd' }, { branchId: 4 }, { branchId: 5, deptId: null }] })).toEqual({
      user_id: 'u',
      assignments: [{ branch_id: 3, dept_id: 'd' }, { branch_id: 4 }, { branch_id: 5 }],
    });
  });
});

describe('shifts', () => {
  it('mapShift converts the compact 12h times to HH:mm', () => {
    expect(mapShift({ shift_id: 5, shift_name: 'Day', start_time: '09:30AM', end_time: '06:00PM', status: 1 })).toMatchObject({
      id: 5,
      name: 'Day',
      startTime: '09:30',
      endTime: '18:00',
      isActive: true,
    });
  });

  it('mapShift tolerates the alternative keys and inactive status', () => {
    expect(mapShift({ id: '7', name: 'Night', startTime: '22:00', endTime: '06:00', status: 0 })).toMatchObject({
      id: 7,
      name: 'Night',
      startTime: '22:00',
      endTime: '06:00',
      isActive: false,
    });
    expect(mapShift({ shiftId: 1, shiftName: 'X', shift_start: '8:00 AM', shift_end: '5:00 PM' })).toMatchObject({
      id: 1,
      name: 'X',
      startTime: '08:00',
      endTime: '17:00',
    });
  });

  it('mapSingleShift unwraps data | shift | bare', () => {
    const inner = { shift_id: 2, shift_name: 'S', start_time: '08:00AM', end_time: '04:00PM' };
    for (const body of [{ success: true, data: inner }, { shift: inner }, inner]) {
      expect(mapSingleShift(body)).toMatchObject({ id: 2, startTime: '08:00', endTime: '16:00' });
    }
  });

  it('toShiftBody sends hh:mmAM/PM without a space', () => {
    expect(toShiftBody({ orgId: 'o', name: ' Day ', startTime: '09:30', endTime: '18:00' })).toEqual({
      org_id: 'o',
      shift_name: 'Day',
      start_time: '09:30AM',
      end_time: '06:00PM',
    });
  });
});

describe('dashboard', () => {
  it('mapDashboardStats / mapDepartmentStats', () => {
    const wire = { total_staff: '10', punched_in: 4, working: 4, punched_out: 2, absent: 4, late_punched_in: 1 };
    expect(mapDashboardStats(wire)).toEqual({ totalStaff: 10, punchedIn: 4, working: 4, punchedOut: 2, absent: 4, latePunchedIn: 1 });
    expect(mapDepartmentStats({ ...wire, dept_id: 'd1', dept_name: 'Sales' })).toMatchObject({ deptId: 'd1', deptName: 'Sales', totalStaff: 10 });
    expect(mapDashboardStats({}).latePunchedIn).toBe(0);
  });

  it('mapDateInfo', () => {
    expect(mapDateInfo({ current_date: '2026-03-01', formatted_date: '01 Mar 2026', day_name: 'Sunday' })).toEqual({
      currentDate: '2026-03-01',
      formattedDate: '01 Mar 2026',
      dayName: 'Sunday',
    });
  });
});
