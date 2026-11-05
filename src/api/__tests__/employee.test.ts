import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { getPersonalDetails, getTodayBirthdays, mapPersonalDetails, toPersonalDetailsBody, updatePersonalDetails, uploadProfilePhoto } from '../employee';

jest.mock('@/lib/api/client', () => jest.requireActual('../testUtils/apiMock').clientMock());

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete' | 'upload', jest.Mock>;

beforeEach(() => {
  Object.values(mocked).forEach((m) => m.mockReset());
});

describe('mapPersonalDetails', () => {
  it('maps the full body and tolerates legacy alternate names and a data wrapper', () => {
    const d = mapPersonalDetails({
      data: {
        user_id: 'u1',
        name: 'Asha',
        emp_id: 'E1',
        mobile_number: '9876543210',
        email: 'a@x.in',
        branch_name: 'HQ',
        dob: '1990-05-17T00:00:00',
        fatherName: 'Ravi',
        aadhaar: '123456789012',
        pan_no: 'ABCDE1234F',
        profile_photo_url: 'https://img/p.jpg',
        shift_id: '4',
      },
    });
    expect(d).toMatchObject({
      userId: 'u1',
      name: 'Asha',
      branchName: 'HQ',
      dob: '1990-05-17',
      fatherName: 'Ravi',
      aadhaarNo: '123456789012',
      panNo: 'ABCDE1234F',
      photoUrl: 'https://img/p.jpg',
      shiftId: 4,
    });
  });

  it('treats the v1 "not set" date of birth as empty', () => {
    expect(mapPersonalDetails({ user_id: 'u1', dob: '1990-01-01' }).dob).toBeUndefined();
  });
});

describe('toPersonalDetailsBody', () => {
  it('uses the legacy field names and sends empty dates as null', () => {
    const body = toPersonalDetailsBody({
      name: ' Asha ',
      mobile: '9876543210',
      email: 'a@x.in',
      dob: '',
      gender: 'Female',
      bloodGroup: 'O+',
      address: 'Street',
      emergencyContact: '9876543211',
      accountNumber: '123',
      ifscCode: 'SBIN0001234',
      bankName: 'SBI',
      bankBranch: 'MG Road',
      fatherName: 'Ravi',
      maritalStatus: 'Single',
      aadhaarNo: '',
      panNo: 'ABCDE1234F',
      uanNo: '',
      pfNo: '',
      esiNo: '',
      doj: '2020-01-15',
    });
    expect(body).toMatchObject({ name: 'Asha', mobile_number: '9876543210', dob: null, doj: '2020-01-15', emergency_contact_no: '9876543211', acc_no: '123', ifsc_code: 'SBIN0001234', pan_no: 'ABCDE1234F' });
    expect(Object.keys(body)).toHaveLength(20);
  });
});

describe('employee API calls', () => {
  it('reads the personal details', async () => {
    mocked.get.mockResolvedValue({ user_id: 'u1', name: 'Asha' });
    const d = await getPersonalDetails('u 1');
    expect(mocked.get).toHaveBeenCalledWith('/employee/personal-details/u%201');
    expect(d.name).toBe('Asha');
  });

  it('updates the details and surfaces a success:false answer as an error with the server message', async () => {
    mocked.put.mockResolvedValueOnce({ success: true, message: 'Personal details updated successfully' });
    const input = { name: 'A', mobile: '', email: '', dob: '', gender: '', bloodGroup: '', address: '', emergencyContact: '', accountNumber: '', ifscCode: '', bankName: '', bankBranch: '', fatherName: '', maritalStatus: '', aadhaarNo: '', panNo: '', uanNo: '', pfNo: '', esiNo: '', doj: '' };
    await expect(updatePersonalDetails('u1', input)).resolves.toEqual({ message: 'Personal details updated successfully' });
    expect(mocked.put).toHaveBeenCalledWith('/employee/personal-details/u1', expect.objectContaining({ name: 'A' }));

    mocked.put.mockResolvedValueOnce({ success: false, message: 'Email already in use' });
    await expect(updatePersonalDetails('u1', input)).rejects.toThrow('Email already in use');
    mocked.put.mockRejectedValueOnce(new ApiError({ status: 500, message: 'boom' }));
    await expect(updatePersonalDetails('u1', input)).rejects.toThrow('boom');
  });

  it('uploads the profile photo as field "photo" and returns the new URL', async () => {
    mocked.upload.mockResolvedValue({ success: true, photo_url: 'https://img/new.jpg' });
    await expect(uploadProfilePhoto('u1', { uri: 'file:///p.jpg', fileName: 'profile.jpg', mimeType: 'image/jpeg' })).resolves.toBe('https://img/new.jpg');
    expect(mocked.upload).toHaveBeenCalledWith('/auth/upload-employee-profile/u1', expect.objectContaining({ fieldName: 'photo', fileUri: 'file:///p.jpg' }));
  });

  it('reads today\'s birthdays excluding the caller', async () => {
    mocked.get.mockResolvedValue({ birthdays: ['Ravi', '', 'Meena'] });
    await expect(getTodayBirthdays('org1', 'u1')).resolves.toEqual(['Ravi', 'Meena']);
    expect(mocked.get).toHaveBeenCalledWith('/employee/today-birthdays/org1', { exclude_user_id: 'u1' });
    mocked.get.mockResolvedValue({});
    await expect(getTodayBirthdays('org1')).resolves.toEqual([]);
  });
});
