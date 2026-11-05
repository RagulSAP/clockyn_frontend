import type { RawRecord } from './common';

export interface Department {
  id: string;
  name: string;
  orgId: string;
  raw: RawRecord;
}

export interface DepartmentWriteResult {
  deptId: string;
  deptName: string;
  message: string;
}
