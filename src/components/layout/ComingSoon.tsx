import React from 'react';

import { EmptyState, type IconName } from '@/components/ui';
import { Screen } from './Screen';

/** Stand-in for tab roots whose feature screen has not been built yet. Feature builders replace the route file. */
export function ComingSoonScreen({ title, icon }: { title: string; icon?: IconName }) {
  return (
    <Screen scroll={false} title={title} hideBack edges={['top']}>
      <EmptyState icon={icon} title="Coming soon" message={`${title} will be available here shortly.`} />
    </Screen>
  );
}
