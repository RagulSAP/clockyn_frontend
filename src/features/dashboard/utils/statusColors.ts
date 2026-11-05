import type { ColorTokens } from '@/theme';

import type { StaffFilter } from './dashboardLogic';

/** Functional colour of each attendance bucket (kept consistent between home, department cards and overview). */
export function filterColor(colors: ColorTokens, key: StaffFilter): string {
  switch (key) {
    case 'absent':
      return colors.statusAbsent;
    case 'late':
      return colors.statusLate;
    case 'punched_in':
      return colors.info;
    case 'working':
      return colors.statusPresent;
    case 'punched_out':
      return colors.statusHalfDay;
    default:
      return colors.primary;
  }
}
