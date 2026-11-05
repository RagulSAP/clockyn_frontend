import { api } from '@/lib/api/client';
import {
  buildAnnouncementBody,
  createAnnouncement,
  deleteAnnouncement,
  filterBroadcast,
  filterTargeted,
  listAnnouncements,
  listEmployeeAnnouncements,
  mapAnnouncement,
  mapAnnouncementTarget,
  sendToBranch,
  sendToDept,
  unseenAnnouncementIds,
} from '../announcements';
import {
  actOnCarryForward,
  assignLead,
  attachCarryForward,
  buildLeadBody,
  createLead,
  createLeadCategory,
  deleteLead,
  indexCarryForwardByLead,
  leadToInput,
  listCarryForwardRequests,
  listEmployeeLeads,
  listLeadCategories,
  listLeads,
  listMyCarryForwardRequests,
  mapCarryForwardRequest,
  mapLead,
  mapWorkStatus,
  reassignLead,
  requestCarryForward,
  updateLead,
  updateLeadPipelineStatus,
  updateLeadWorkStatus,
} from '../leads';

jest.mock('@/lib/api/client', () => jest.requireActual('../testUtils/apiMock').clientMock());

const mocked = api as unknown as Record<'get' | 'post' | 'put' | 'delete', jest.Mock>;

beforeEach(() => {
  Object.values(mocked).forEach((m) => m.mockReset());
});

describe('announcements', () => {
  const rows = [
    { id: 'a1', title: 'All', message: 'm', target: 'all', created_at: '2026-10-01T08:00:00Z', sent_by: 'Boss' },
    { id: 'a2', title: 'Some', message: 'm', target: 'selected', recipient_count: '4' },
    { id: 'a3', title: 'Branch', message: 'm', target: 'branch', branch_id: '7', branch_name: 'HQ' },
    { id: 'a4', title: 'Dept', message: 'm', target: 'dept', dept_id: 'd1', dept_name: 'Sales' },
  ].map(mapAnnouncement);

  it('maps rows with typed ids', () => {
    expect(rows[2]).toMatchObject({ target: 'branch', branchId: 7, branchName: 'HQ', deptId: null });
    expect(rows[1].recipientCount).toBe(4);
    expect(rows[0]).toMatchObject({ sentBy: 'Boss', branchId: null });
    expect(mapAnnouncementTarget('weird')).toBe('all');
  });

  it('splits the broadcast and targeted feeds', () => {
    expect(filterBroadcast(rows).map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(filterTargeted(rows).map((a) => a.id)).toEqual(['a3', 'a4']);
  });

  it('finds unseen ids', () => {
    expect(unseenAnnouncementIds(rows, ['a1', 'a3'])).toEqual(['a2', 'a4']);
  });

  it('builds the body per target', () => {
    const base = { orgId: 'o', sentById: 'admin', title: ' T ', message: ' M ' };
    expect(buildAnnouncementBody({ ...base, target: 'all' })).toEqual({ org_id: 'o', sent_by_id: 'admin', title: 'T', message: 'M', target: 'all' });
    expect(buildAnnouncementBody({ ...base, target: 'selected', selectedUserIds: ['u1'] })).toMatchObject({ target: 'selected', selected_user_ids: ['u1'] });
    expect(buildAnnouncementBody({ ...base, target: 'branch', branchId: '9' })).toMatchObject({ target: 'branch', branch_id: 9 });
    expect(buildAnnouncementBody({ ...base, target: 'dept', deptId: 'd' })).toMatchObject({ target: 'dept', dept_id: 'd' });
  });

  it('createAnnouncement posts and returns the new id', async () => {
    mocked.post.mockResolvedValue({ success: true, data: { announcement_id: 'n1', recipient_count: 2 } });
    const res = await sendToBranch({ orgId: 'o', sentById: 'a', title: 't', message: 'm', branchId: 3 });
    expect(mocked.post).toHaveBeenCalledWith('/api/announcements', expect.objectContaining({ target: 'branch', branch_id: 3 }));
    expect(res).toEqual({ id: 'n1', recipientCount: 2 });
    mocked.post.mockResolvedValue({ success: false, message: 'Only admin can send announcements' });
    await expect(sendToDept({ orgId: 'o', sentById: 'a', title: 't', message: 'm', deptId: 'd' })).rejects.toThrow('Only admin can send announcements');
  });

  it('createAnnouncement validates the audience', async () => {
    await expect(
      createAnnouncement({ orgId: 'o', sentById: 'a', title: 't', message: 'm', target: 'selected', selectedUserIds: [] }),
    ).rejects.toThrow('Select at least one recipient');
    await expect(createAnnouncement({ orgId: 'o', sentById: 'a', title: 't', message: 'm', target: 'branch', branchId: 'abc' })).rejects.toThrow('Select a branch');
    expect(mocked.post).not.toHaveBeenCalled();
  });

  it('list / delete / employee feed', async () => {
    mocked.get.mockResolvedValueOnce({ success: true, data: [{ id: 'a1', target: 'all' }] });
    expect(await listAnnouncements('org')).toHaveLength(1);
    expect(mocked.get).toHaveBeenLastCalledWith('/api/announcements/org');
    mocked.get.mockResolvedValueOnce({ success: true, data: [] });
    await listEmployeeAnnouncements('u1');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/announcements/employee/u1');
    mocked.delete.mockResolvedValueOnce({ success: false, message: 'Announcement not found' });
    await expect(deleteAnnouncement('x')).rejects.toThrow('Announcement not found');
    expect(mocked.delete).toHaveBeenCalledWith('/api/announcements/x');
  });
});

describe('leads mapping', () => {
  it('mapLead separates the required date from the creation date (IST)', () => {
    const lead = mapLead({
      leads_id: 'L1',
      client_name: 'Acme',
      mobile_number: '99999',
      client_address: 'Pune',
      category_name: 'Retail',
      remarks: 'call',
      created_date: '2026-10-20',
      created_at: '2026-10-17T20:30:00',
      assigned_user_id: 'u1',
      assigned_user_name: 'Asha',
      work_status: 'Carry Forward',
      assigned_at: '2026-10-18T01:00:00',
      lead_status: 'new',
    });
    expect(lead).toMatchObject({
      id: 'L1',
      requiredDate: '2026-10-20',
      createdOn: '2026-10-18', // 20:30 UTC on the 17th is 02:00 IST on the 18th
      effectiveDate: '2026-10-20',
      assignedUserId: 'u1',
      workStatus: 'carry_forward',
      pipelineStatus: 'new',
    });
  });

  it('mapLead falls back to the creation date and handles unassigned leads', () => {
    const lead = mapLead({ leads_id: 'L2', created_date: null, created_at: '2026-10-05T05:00:00Z', assigned_user_id: null, work_status: null });
    expect(lead.requiredDate).toBeNull();
    expect(lead.effectiveDate).toBe('2026-10-05');
    expect(lead.assignedUserId).toBeNull();
    expect(lead.workStatus).toBeNull();
  });

  it('mapWorkStatus normalises', () => {
    expect(mapWorkStatus('working')).toBe('working');
    expect(mapWorkStatus('Completed')).toBe('completed');
    expect(mapWorkStatus('carry-forward')).toBe('carry_forward');
    expect(mapWorkStatus('???')).toBeNull();
    expect(mapWorkStatus('')).toBeNull();
  });

  it('leadToInput keeps the required date and buildLeadBody sends it', () => {
    const lead = mapLead({ leads_id: 'L1', client_name: ' Acme ', mobile_number: '1', client_address: 'X', category_name: '', remarks: 'r', created_date: '2026-11-02' });
    const input = leadToInput(lead, 'org');
    expect(input.requiredDate).toBe('2026-11-02');
    expect(input.category).toBe('General');
    expect(buildLeadBody(input)).toEqual({
      org_id: 'org',
      name: 'Acme',
      mobile: '1',
      address: 'X',
      category: 'General',
      remarks: 'r',
      required_date: '2026-11-02',
    });
    expect(buildLeadBody({ orgId: 'o', name: 'n', mobile: 'm', address: 'a', category: 'c' }).required_date).toBeNull();
  });
});

describe('carry-forward merge', () => {
  const req = (over: Record<string, unknown>) =>
    mapCarryForwardRequest({ request_id: 'r', leads_id: 'L1', user_id: 'u1', employee_name: 'Asha', status: 'pending', ...over });

  it('keeps only pending / approved and lets the later row win (v1 behaviour)', () => {
    const map = indexCarryForwardByLead([
      req({ request_id: 'new', status: 'approved', employee_name: 'Newest' }),
      req({ request_id: 'rej', leads_id: 'L2', status: 'rejected' }),
      req({ request_id: 'old', status: 'pending', employee_name: 'Oldest' }),
    ]);
    expect(map.size).toBe(1);
    expect(map.get('L1')).toMatchObject({ requestId: 'old', status: 'pending', previousStaffName: 'Oldest' });
  });

  it('attaches carry-forward info to leads', () => {
    const leads = [mapLead({ leads_id: 'L1' }), mapLead({ leads_id: 'L9' })];
    const merged = attachCarryForward(leads, [req({})]);
    expect(merged[0].carryForward).toMatchObject({ requestId: 'r', previousStaffId: 'u1' });
    expect(merged[1].carryForward).toBeNull();
  });

  it('maps the admin request row dates', () => {
    const r = req({ request_date: '2026-10-25T00:00:00', lead_date: '2026-10-20', crf_request_date: '2026-10-25' });
    expect(r).toMatchObject({ requestDate: '2026-10-25', leadDate: '2026-10-20' });
  });
});

describe('leads requests', () => {
  it('list calls', async () => {
    mocked.get.mockResolvedValue({ success: true, data: [{ leads_id: 'L1' }] });
    expect(await listLeads('org')).toHaveLength(1);
    expect(mocked.get).toHaveBeenLastCalledWith('/api/leads/org');
    await listEmployeeLeads('org', 'u1');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/leads/employee/org/u1');
    mocked.get.mockResolvedValue({ success: true, data: [{ category_id: 'c1', category_name: 'Retail' }, { category_name: 'Solo' }] });
    expect(await listLeadCategories('org')).toEqual([
      { id: 'c1', name: 'Retail' },
      { id: 'Solo', name: 'Solo' },
    ]);
    mocked.get.mockResolvedValue({ success: true, data: [{ request_id: 'r1', status: 'approved' }] });
    expect((await listCarryForwardRequests('org'))[0].status).toBe('approved');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/leads/carry-forward/requests/org');
    await listMyCarryForwardRequests('org', 'u1');
    expect(mocked.get).toHaveBeenLastCalledWith('/api/leads/carry-forward/my/org/u1');
  });

  it('plan block from the server is surfaced', async () => {
    mocked.get.mockResolvedValue({ success: false, message: 'Your plan has expired.' });
    await expect(listLeads('org')).rejects.toThrow('Your plan has expired.');
  });

  it('createLead / updateLead / deleteLead', async () => {
    mocked.post.mockResolvedValue({ success: true, leads_id: 'new1' });
    expect(await createLead({ orgId: 'o', name: 'n', mobile: 'm', address: 'a', category: '', requiredDate: null })).toEqual({ id: 'new1' });
    expect(mocked.post).toHaveBeenCalledWith('/api/leads/create', expect.objectContaining({ category: 'General', required_date: null }));
    mocked.put.mockResolvedValue({ success: true });
    await updateLead('L1', { orgId: 'o', name: 'n', mobile: 'm', address: 'a', category: 'c', requiredDate: '2026-10-30' });
    expect(mocked.put).toHaveBeenCalledWith('/api/leads/L1', expect.objectContaining({ required_date: '2026-10-30' }));
    mocked.delete.mockResolvedValue({ success: true });
    await deleteLead('L1');
    expect(mocked.delete).toHaveBeenCalledWith('/api/leads/L1');
  });

  it('assign / reassign use query parameters only', async () => {
    mocked.post.mockResolvedValue({ success: true });
    await assignLead({ leadId: 'L1', orgId: 'o', userId: 'u1', branchId: 4, deptId: 'd1' });
    expect(mocked.post).toHaveBeenCalledWith('/api/leads/assign?leads_id=L1&org_id=o&user_id=u1&branch_id=4&dept_id=d1');
    mocked.put.mockResolvedValue({ success: true });
    await reassignLead({ leadId: 'L1', userId: 'u2' });
    expect(mocked.put).toHaveBeenCalledWith('/api/leads/assignment/L1?user_id=u2');
  });

  it('work status, pipeline status, categories, carry-forward', async () => {
    mocked.put.mockResolvedValue({ success: true });
    await updateLeadWorkStatus('L1', 'working', 'u 1');
    expect(mocked.put).toHaveBeenLastCalledWith('/api/leads/L1/work-status?work_status=working&user_id=u%201');
    await updateLeadPipelineStatus('L1', 'converted');
    expect(mocked.put).toHaveBeenLastCalledWith('/api/leads/L1/status?status=converted');
    mocked.post.mockResolvedValue({ success: true, category_id: 'c9' });
    expect(await createLeadCategory('o', ' New Cat ')).toEqual({ id: 'c9' });
    expect(mocked.post).toHaveBeenLastCalledWith('/api/leads/categories?org_id=o&category_name=New%20Cat');
    mocked.post.mockResolvedValue({ success: true, request_id: 'r7' });
    expect(await requestCarryForward({ leadId: 'L1', orgId: 'o', userId: 'u', description: 'busy', forwardDate: '2026-10-30' })).toEqual({ requestId: 'r7' });
    expect(mocked.post).toHaveBeenLastCalledWith('/api/leads/carry-forward/request?leads_id=L1&org_id=o&user_id=u&description=busy&forward_date=2026-10-30');
    mocked.post.mockResolvedValue({ success: false, message: 'A pending carry forward request already exists' });
    await expect(requestCarryForward({ leadId: 'L1', orgId: 'o', userId: 'u', description: 'x' })).rejects.toThrow('already exists');
    mocked.put.mockResolvedValue({ success: true });
    await actOnCarryForward('r1', 'approved', 'admin');
    expect(mocked.put).toHaveBeenLastCalledWith('/api/leads/carry-forward/r1/action?action=approved&admin_id=admin');
  });
});
