// Tab roots: Home / CRM / Chat / Settings / Support (admin only). See components/layout/AreaLayouts.
import React from 'react';

import { TabsAreaLayout } from '@/components/layout/AreaLayouts';

export default function AdminTabsLayout() {
  return <TabsAreaLayout variant="admin" />;
}
