import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { listFaqs, listSupportSubjects, listSupportVideos, listTickets, recordVideoView, mapSupportTicket, mapTicketStatus, replyToTicket, submitTicket } from '../support';
import {
  addHoliday,
  addHolidayDates,
  checkAppVersion,
  deleteHoliday,
  getAttendanceRule,
  getWeeklyOffs,
  isWeeklyOff,
  listHolidays,
  mapAttendanceRule,
  mapHoliday,
  mapVersionCheck,
  normaliseWeeklyOffs,
  requestAccountDeletion,
  saveAttendanceRule,
  setWeeklyOffs,
  submitFeatureSuggestion,
  updateHoliday,
} from '../system';

jest.mock('@/lib/api/client', () => jest.requireActual('../testUtils/apiMock').clientMock());

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete' | 'upload', jest.Mock>;

beforeEach(() => {
  Object.values(mocked).forEach((m) => m.mockReset());
});

describe('support', () => {
  it('maps status values', () => {
    expect(mapTicketStatus('created')).toBe('open');
    expect(mapTicketStatus('In Progress')).toBe('in_progress');
    expect(mapTicketStatus('resolved')).toBe('resolved');
    expect(mapTicketStatus(undefined)).toBe('open');
  });

  it('maps tickets with replies and converts a legacy single reply', () => {
    const t = mapSupportTicket({
      id: 4,
      sub_id: 2,
      sub_name: 'Billing',
      client_msg: 'Help',
      status: 'in_progress',
      photo_url: null,
      created_at: '2026-10-01T00:00:00Z',
      replies: [{ reply_text: 'On it', author_name: 'Agent', is_admin: true, created_at: '2026-10-02T00:00:00Z' }],
    });
    expect(t).toMatchObject({ id: '4', subject: 'Billing', message: 'Help', status: 'in_progress', photoUrl: null });
    expect(t.replies).toEqual([{ text: 'On it', authorName: 'Agent', isAdmin: true, createdAt: '2026-10-02T00:00:00Z' }]);
    const legacy = mapSupportTicket({ id: 5, client_msg: 'x', reply: 'Fixed', replies: [] });
    expect(legacy.replies[0]).toMatchObject({ text: 'Fixed', isAdmin: true, authorName: 'Admin Reply' }); // support spec §3: legacy single reply is labelled "Admin Reply"
  });

  it('lists subjects and tickets', async () => {
    mocked.get.mockResolvedValueOnce([{ sub_id: 1, sub_name: 'Login' }]);
    expect(await listSupportSubjects()).toEqual([{ id: '1', name: 'Login' }]);
    mocked.get.mockResolvedValueOnce([{ id: 1, client_msg: 'm' }]);
    expect(await listTickets('org')).toHaveLength(1);
    expect(mocked.get).toHaveBeenLastCalledWith('/support/requests/org');
  });

  it('lists the Video Hub videos and drops entries without a name or an http(s) link', async () => {
    mocked.get.mockResolvedValueOnce([
      { id: 1, name: ' Getting started ', url: 'https://bucket.s3.amazonaws.com/guide/a.mp4?X-Amz-Signature=1' },
      { id: 2, name: '', url: 'https://x/b.mp4' },
      { id: 3, name: 'No link', url: '' },
      { id: 4, name: 'Bad scheme', url: 'javascript:alert(1)' },
    ]);
    expect(await listSupportVideos()).toEqual([
      { id: '1', name: 'Getting started', url: 'https://bucket.s3.amazonaws.com/guide/a.mp4?X-Amz-Signature=1' },
    ]);
    expect(mocked.get).toHaveBeenLastCalledWith('/support/videos');
  });

  it('lists the FAQs as the server ordered them, trimming text, defaulting a missing bucket / category to General and dropping entries without a question or answer', async () => {
    mocked.get.mockResolvedValueOnce([
      { id: 3, faq_bucket: ' Attendance & Time ', category: ' Shifts ', question: ' How do I add a shift? ', answer: 'Open Shifts.\r\nTap Add.\n\n  ' },
      { id: 4, category: '', question: 'No category', answer: 'Falls back to General' },
      { id: 5, category: 'Shifts', question: '', answer: 'no question' },
      { id: 6, category: 'Shifts', question: 'No answer', answer: '   ' },
    ]);
    expect(await listFaqs()).toEqual([
      { id: '3', bucket: 'Attendance & Time', category: 'Shifts', question: 'How do I add a shift?', answer: 'Open Shifts.\nTap Add.' },
      { id: '4', bucket: 'General', category: 'General', question: 'No category', answer: 'Falls back to General' },
    ]);
    expect(mocked.get).toHaveBeenLastCalledWith('/support/faqs');
  });

  it('lists no FAQs for an empty or unexpected body', async () => {
    mocked.get.mockResolvedValueOnce([]);
    expect(await listFaqs()).toEqual([]);
    mocked.get.mockResolvedValueOnce(null);
    expect(await listFaqs()).toEqual([]);
  });

  it('records a video view with the user and organisation ids', async () => {
    mocked.post.mockResolvedValue({ success: true });
    await recordVideoView('7', { userId: 'u1', orgId: 'org1' });
    expect(mocked.post).toHaveBeenCalledWith('/support/videos/7/view', { user_id: 'u1', org_id: 'org1' });
  });

  it('submitTicket without a photo posts form data', async () => {
    mocked.post.mockResolvedValue({ success: true });
    await submitTicket({ userId: 'u', orgId: 'org', subject: ' Billing ', message: ' Help ' });
    const [path, form] = mocked.post.mock.calls[0];
    expect(path).toBe('/support/submit');
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get('subject')).toBe('Billing');
    expect((form as FormData).get('message')).toBe('Help');
    expect((form as FormData).get('user_id')).toBe('u');
    expect((form as FormData).get('org_id')).toBe('org');
  });

  it('submitTicket with a photo uses the multipart upload', async () => {
    mocked.upload.mockResolvedValue({ success: true });
    await submitTicket({ userId: 'u', orgId: 'org', subject: 'Billing', message: 'Help', photo: { uri: 'file:///a.png', mimeType: 'image/png', fileName: 'a.png' } });
    expect(mocked.upload).toHaveBeenCalledWith(
      '/support/submit',
      expect.objectContaining({
        fileUri: 'file:///a.png',
        fieldName: 'photo',
        fileName: 'a.png',
        mimeType: 'image/png',
        fields: { subject: 'Billing', message: 'Help', user_id: 'u', org_id: 'org' },
      }),
      { timeoutMs: 30000 },
    );
  });

  it('submitTicket validates and surfaces failures', async () => {
    await expect(submitTicket({ userId: 'u', orgId: 'o', subject: '', message: 'x' })).rejects.toThrow('Select a subject');
    await expect(submitTicket({ userId: 'u', orgId: 'o', subject: 's', message: ' ' })).rejects.toThrow('Enter your message');
    mocked.post.mockResolvedValue({ success: false, message: 'Subject not found' });
    await expect(submitTicket({ userId: 'u', orgId: 'o', subject: 's', message: 'm' })).rejects.toThrow('Subject not found');
  });

  it('replyToTicket posts the v1 body', async () => {
    mocked.post.mockResolvedValue({ success: true });
    await replyToTicket('4', { text: ' thanks ', authorName: 'Asha' });
    expect(mocked.post).toHaveBeenCalledWith('/support/4/reply', { reply_text: 'thanks', author_name: 'Asha', is_admin: false });
    await expect(replyToTicket('4', { text: '  ', authorName: 'A' })).rejects.toThrow('Enter your reply');
  });
});

describe('system: version, suggestions, deletion', () => {
  it('mapVersionCheck handles the "no row" payload', () => {
    expect(mapVersionCheck({ success: true, data: { update_required: false } })).toEqual({
      updateRequired: false,
      latestVersion: null,
      forceUpdate: false,
      message: null,
      storeUrl: null,
    });
    expect(mapVersionCheck({ success: true, data: { update_required: true, latest_version: '2.0.0', force_update: 1, message: 'Update', store_url: 'https://s' } })).toMatchObject({
      updateRequired: true,
      forceUpdate: true,
      latestVersion: '2.0.0',
      storeUrl: 'https://s',
    });
  });

  it('checkAppVersion sends platform and version', async () => {
    mocked.get.mockResolvedValue({ success: true, data: { update_required: false } });
    await checkAppVersion('android', '1.2.3');
    expect(mocked.get).toHaveBeenCalledWith('/version/check', { platform: 'android', version: '1.2.3' });
    await checkAppVersion('android', '1.2.3', 'com.clockyn.app');
    expect(mocked.get).toHaveBeenLastCalledWith('/version/check', { platform: 'android', version: '1.2.3', app_id: 'com.clockyn.app' });
  });

  it('submitFeatureSuggestion posts the v1 body and treats success:false as an error', async () => {
    mocked.post.mockResolvedValue({ success: true });
    await submitFeatureSuggestion({ orgId: 'o', subject: ' S ', content: ' C ', companyName: 'Org', userEmail: 'a@x.in' });
    expect(mocked.post).toHaveBeenCalledWith('/company/suggest-feature', { org_id: 'o', subject: 'S', content: 'C', company_name: 'Org', user_email: 'a@x.in' });
    mocked.post.mockResolvedValue({ success: false, message: 'Too long' });
    await expect(submitFeatureSuggestion({ orgId: 'o', subject: 'S', content: 'C', companyName: '', userEmail: '' })).rejects.toThrow('Too long');
    await expect(submitFeatureSuggestion({ orgId: 'o', subject: '', content: 'C', companyName: '', userEmail: '' })).rejects.toThrow('Enter a subject');
  });

  it('requestAccountDeletion returns the server message', async () => {
    mocked.post.mockResolvedValue({ success: true, message: 'Deletion request already submitted. Awaiting admin review.' });
    expect(await requestAccountDeletion('u1')).toEqual({ message: 'Deletion request already submitted. Awaiting admin review.' });
    expect(mocked.post).toHaveBeenCalledWith('/company/request-deletion/u1');
    mocked.post.mockRejectedValue(new ApiError({ status: 404, message: 'User not found' }));
    await expect(requestAccountDeletion('u1')).rejects.toThrow('User not found');
  });
});

describe('system: holidays and weekly offs', () => {
  it('mapHoliday', () => {
    expect(mapHoliday({ id: 3, name: 'Diwali', date: '2026-11-08', branch_name: null, dept_name: 'Ops', block_attendance: 1 })).toEqual({
      id: 3,
      name: 'Diwali',
      date: '2026-11-08',
      branchName: null,
      deptName: 'Ops',
      blockAttendance: true,
    });
    expect(mapHoliday({ id: 4, name: 'X', date: '2026-01-01', block_attendance: false }).blockAttendance).toBe(false);
    expect(mapHoliday({ id: 4, name: 'X', date: '2026-01-01', block_attendance: 0 }).blockAttendance).toBe(false);
    // Missing / null column = blocking (spec holiday_management section 7).
    expect(mapHoliday({ id: 5, name: 'X', date: '2026-01-01', block_attendance: null }).blockAttendance).toBe(true);
    expect(mapHoliday({ id: 6, name: 'X', date: '2026-01-01' }).blockAttendance).toBe(true);
  });

  it('normaliseWeeklyOffs validates, de-duplicates and sorts', () => {
    expect(normaliseWeeklyOffs([6, '5', 6, 9, -1, 1.5, 'x', 0])).toEqual([0, 5, 6]);
    expect(normaliseWeeklyOffs([])).toEqual([]);
  });

  it('isWeeklyOff uses Python weekdays (Monday = 0)', () => {
    // 2026-10-18 is a Sunday, 2026-10-19 a Monday.
    expect(isWeeklyOff('2026-10-18', [6])).toBe(true);
    expect(isWeeklyOff('2026-10-19', [6])).toBe(false);
    expect(isWeeklyOff('2026-10-19', [0, 6])).toBe(true);
    expect(isWeeklyOff('nonsense', [6])).toBe(false);
  });

  it('list / add / update / delete', async () => {
    mocked.get.mockResolvedValue({ success: true, data: [{ id: 1, name: 'A', date: '2026-10-02' }] });
    expect(await listHolidays('org', 2026, 10)).toHaveLength(1);
    expect(mocked.get).toHaveBeenCalledWith('/api/holidays/org', { year: 2026, month: 10 });

    mocked.post.mockResolvedValue({ success: true, id: 9 });
    expect(await addHoliday('org', { name: ' Gandhi Jayanti ', date: '2026-10-02', branchName: 'HQ' })).toEqual({ id: 9 });
    expect(mocked.post).toHaveBeenCalledWith('/api/holidays/org', {
      name: 'Gandhi Jayanti',
      date: '2026-10-02',
      branch_name: 'HQ',
      dept_name: null,
      block_attendance: true,
    });
    await expect(addHoliday('org', { name: '', date: '2026-10-02' })).rejects.toThrow('Enter a holiday name');

    mocked.put.mockResolvedValue({ success: true });
    await updateHoliday('org', 9, { name: 'Renamed', blockAttendance: false });
    expect(mocked.put).toHaveBeenCalledWith('/api/holidays/org/9', { name: 'Renamed', block_attendance: false });
    mocked.put.mockResolvedValue({ success: false, message: 'Holiday not found' });
    await expect(updateHoliday('org', 1, { name: 'x' })).rejects.toThrow('Holiday not found');

    mocked.delete.mockResolvedValue({ success: true });
    await deleteHoliday('org', 9);
    expect(mocked.delete).toHaveBeenCalledWith('/api/holidays/org/9');
  });

  it('addHolidayDates reports per-date failures instead of throwing', async () => {
    mocked.post.mockImplementation(async (_path: string, body: { date: string }) => {
      if (body.date === '2026-10-04') throw new ApiError({ status: 500, message: 'duplicate', detail: 'duplicate' });
      return { success: true, id: 1 };
    });
    const res = await addHolidayDates('org', { name: 'Fest' }, ['2026-10-03', '2026-10-04', '2026-10-05']);
    expect(res.added).toBe(2);
    expect(res.failed).toEqual([{ date: '2026-10-04', message: 'duplicate' }]);
  });

  it('weekly offs default to Sunday only when the server sends none', async () => {
    mocked.get.mockResolvedValueOnce({ success: true });
    expect(await getWeeklyOffs('org')).toEqual([6]);
    mocked.get.mockResolvedValueOnce({ success: true, off_days: [5, 6] });
    expect(await getWeeklyOffs('org')).toEqual([5, 6]);
    mocked.get.mockResolvedValueOnce({ success: true, off_days: [] });
    expect(await getWeeklyOffs('org')).toEqual([]);
    expect(mocked.get).toHaveBeenLastCalledWith('/api/holidays/off-days/org');
    mocked.post.mockResolvedValue({ success: true });
    await setWeeklyOffs('org', [6, 0, 6]);
    expect(mocked.post).toHaveBeenCalledWith('/api/holidays/off-days/org', { off_days: [0, 6] });
  });
});

describe('system: attendance rule', () => {
  it('applies the v1 defaults', () => {
    expect(mapAttendanceRule({})).toEqual({ latePunchInCount: 3, considerAs: 'Half Day' });
    expect(mapAttendanceRule({ success: true, data: { late_punch_in_count: '5', consider_as: 'Leave' } })).toEqual({ latePunchInCount: 5, considerAs: 'Leave' });
    expect(mapAttendanceRule({ data: { late_punch_in_count: 0, consider_as: 'weird' } })).toEqual({ latePunchInCount: 3, considerAs: 'Half Day' });
  });

  it('get / save', async () => {
    mocked.get.mockResolvedValue({ success: true, data: null });
    expect(await getAttendanceRule('org')).toEqual({ latePunchInCount: 3, considerAs: 'Half Day' });
    expect(mocked.get).toHaveBeenCalledWith('/api/attendance-rule/org');
    mocked.post.mockResolvedValue({ success: true });
    await saveAttendanceRule('org', { latePunchInCount: 4, considerAs: 'Leave' });
    expect(mocked.post).toHaveBeenCalledWith('/api/attendance-rule/org', { late_punch_in_count: 4, consider_as: 'Leave' });
    await expect(saveAttendanceRule('org', { latePunchInCount: 0, considerAs: 'Leave' })).rejects.toThrow('valid late punch-in count');
    mocked.post.mockResolvedValue({ success: false, message: 'Not allowed' });
    await expect(saveAttendanceRule('org', { latePunchInCount: 2, considerAs: 'Half Day' })).rejects.toThrow('Not allowed');
  });
});
