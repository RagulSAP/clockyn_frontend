import React from 'react';

import { RoleGuard } from '@/components/layout/RoleGuard';
import { ROLE } from '@/config/routes';

/**
 * The Support area (hub, Video Hub, Live Chat) belongs to the organisation's ADMIN. The `/admin/*` area is also open to
 * managers (through their Settings shortcuts), so these screens add the stricter check: anyone else is sent to their own
 * home instead.
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowed={[ROLE.admin]}>{children}</RoleGuard>;
}
