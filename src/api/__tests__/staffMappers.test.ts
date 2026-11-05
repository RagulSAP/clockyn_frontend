import {
  mapBranchOption,
  mapDailyAttendanceRow,
  mapLiveStatus,
  mapStaffDetail,
  mapStaffMember,
  mapStaffProfile,
  mapStaffRecord,
  toStaffBody,
} from '../mappers/staff';

describe('mapLiveStatus', () => {
  it.each([
    ['Working', 'working'],
    ['Punched In', 'punched_in'],
    ['Punched Out', 'punched_out'],
    ['Absent', 'absent'],
    ['Late Punched-In', 'late_punched_in'],
    ['Inactive', 'inactive'],
    ['whatever', 'unknown'],
    [undefined, 'unknown'],
  ])('%s -> %s', (label, key) => {
    expect(mapLiveStatus(label)).toBe(key);
  });
});

describe('mapStaffMember', () => {
  const wire = {
    user_id: 'u1',
    name: ' Asha Rao ',
    emp_id: 1001,
    mobile_number: '9876543210',
    email: 'asha@example.com',
    dept_name: 'Sales',
    branch_name: 'HQ',
    status: 'Punched In',
    profile_photo_url: 'https://cdn.example.com/a.png',
    is_active: true,
    role_id: 3,
  };

  it('maps the /home list row to camelCase', () => {
    const m = mapStaffMember(wire);
    expect(m).toMatchObject({
      userId: 'u1',
      name: 'Asha Rao',
      empId: '1001',
      mobile: '9876543210',
      email: 'asha@example.com',
      department: 'Sales',
      branch: 'HQ',
      status: 'punched_in',
      statusLabel: 'Punched In',
      isActive: true,
      roleId: 3,
      photoUrl: 'https://cdn.example.com/a.png',
    });
    expect(m.raw).toBe(wire);
  });

  it('accepts the legacy `department` alias and infers isActive from status', () => {
    const m = mapStaffMember({ user_id: 'u2', name: 'B', department: 'Ops', status: 'Inactive' });
    expect(m.department).toBe('Ops');
    expect(m.isActive).toBe(false);
    expect(m.branch).toBe('');
    expect(m.roleId).toBeUndefined();
    expect(m.photoUrl).toBeUndefined();
  });

  it('honours an explicit is_active=false', () => {
    expect(mapStaffMember({ user_id: 'u3', status: 'Absent', is_active: false }).isActive).toBe(false);
  });

  it('survives rows without any fields (assignment lists)', () => {
    const m = mapStaffMember({ user_id: 'u4', name: 'C', emp_id: 'E4' });
    expect(m.status).toBe('unknown');
    expect(m.isActive).toBe(true);
  });

  it('tolerates a non-object input', () => {
    expect(mapStaffMember(null).userId).toBe('');
  });
});

describe('mapDailyAttendanceRow', () => {
  it('converts 12h punch times, hours and location', () => {
    const row = mapDailyAttendanceRow({
      user_id: 'u1',
      name: 'Asha',
      status: 'Punched Out',
      punch_in: '09:15 AM',
      punch_out: '06:05 PM',
      total_hours: '8.83',
      location: '12.9716,77.5946',
    });
    expect(row).toMatchObject({
      status: 'punched_out',
      punchIn: '09:15',
      punchOut: '18:05',
      totalHours: 8.83,
      location: { latitude: 12.9716, longitude: 77.5946 },
    });
  });

  it('leaves absent rows without times', () => {
    const row = mapDailyAttendanceRow({ user_id: 'u2', status: 'Absent', punch_in: null, punch_out: null, total_hours: null, location: null });
    expect(row.punchIn).toBeUndefined();
    expect(row.totalHours).toBeUndefined();
    expect(row.location).toBeUndefined();
  });
});

describe('mapStaffDetail', () => {
  it('maps the summary card', () => {
    const d = mapStaffDetail({
      user_id: 'u1',
      name: 'Asha',
      emp_id: '1001',
      mobile_number: '98',
      email: 'a@b.c',
      dept_name: 'Sales',
      branch_name: 'HQ',
      branch_address: '1 Main St',
      status: 'Working',
      org_id: 'o1',
    });
    expect(d).toMatchObject({ department: 'Sales', branch: 'HQ', branchAddress: '1 Main St', status: 'working', orgId: 'o1' });
  });
});

describe('mapStaffProfile / mapStaffRecord', () => {
  const wire = {
    user_id: 'u1',
    name: 'Asha',
    emp_id: '1001',
    mobile_number: '9876543210',
    email: 'a@b.c',
    dept_name: 'Sales',
    branch_name: 'HQ',
    role_name: 'Staff',
    status: 1,
    is_field_staff: 1,
    dob: '1990-04-05',
    doj: '2022-01-10T00:00:00',
    gender: 'Female',
    blood_group: 'O+',
    address: '12 Park Rd',
    emergency_contact_no: '9000000000',
    acc_no: '123456',
    ifsc_code: 'ABCD0001234',
    bank_name: 'Bank',
    bank_branch: 'Main',
    father_name: '',
    shift_id: '3',
    profile_photo_url: null,
  };

  it('normalises bank / personal fields and dates', () => {
    const p = mapStaffProfile(wire);
    expect(p).toMatchObject({
      dob: '1990-04-05',
      doj: '2022-01-10',
      bloodGroup: 'O+',
      emergencyContact: '9000000000',
      bankAccountNo: '123456',
      ifsc: 'ABCD0001234',
      shiftId: 3,
    });
    expect(p.fatherName).toBeUndefined();
    expect(p.photoUrl).toBeUndefined();
  });

  it('adds isActive / isFieldStaff for the editable record', () => {
    expect(mapStaffRecord(wire)).toMatchObject({ isActive: true, isFieldStaff: true });
    expect(mapStaffRecord({ ...wire, status: 0, is_field_staff: 0 })).toMatchObject({ isActive: false, isFieldStaff: false });
  });
});

describe('toStaffBody', () => {
  it('keeps the legacy field names (user_id carries the org id) and defaults shift_id to 0', () => {
    const body = toStaffBody({
      orgId: 'org-1',
      name: ' Asha ',
      empId: '1001',
      mobile: '9876543210',
      email: 'a@b.c',
      isFieldStaff: true,
      managerId: 'mgr-1',
      branchName: 'HQ',
      departmentName: 'Sales',
      bankAccountNo: '123',
      emergencyContact: '9000000000',
    });
    expect(body).toEqual({
      name: 'Asha',
      emp_id: '1001',
      mobile_number: '9876543210',
      email: 'a@b.c',
      user_id: 'org-1',
      shift_id: 0,
      is_field_staff: 1,
      branch_name: 'HQ',
      dept_name: 'Sales',
      parent_id: 'mgr-1',
      acc_no: '123',
      emergency_contact_no: '9000000000',
    });
  });

  it('omits empty optionals and sends an explicit shift', () => {
    const body = toStaffBody({ orgId: 'o', name: 'N', empId: '1', mobile: '9', email: 'e', shiftId: 4, address: '' });
    expect(body.shift_id).toBe(4);
    expect(body.is_field_staff).toBe(0);
    expect('address' in body).toBe(false);
    expect('parent_id' in body).toBe(false);
  });
});

describe('option mappers', () => {
  it('stringifies numeric branch ids', () => {
    expect(mapBranchOption({ branch_id: 7, branch_name: 'HQ' })).toEqual({ id: '7', name: 'HQ' });
  });
});
