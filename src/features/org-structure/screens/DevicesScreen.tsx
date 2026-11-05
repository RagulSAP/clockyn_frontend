import React from 'react';

import { Screen } from '@/components/layout';
import { Card, ListItem, useToast, type IconName } from '@/components/ui';
import { useSession } from '@/store/auth';

type Device = { key: string; title: string; icon: IconName; message: string };

const DEVICES: readonly Device[] = [
  { key: 'fingerprint', title: 'Add Fingerprint Device', icon: 'fingerprint', message: 'Fingerprint device coming soon' },
  { key: 'iris', title: 'Add Iris Device', icon: 'eye', message: 'Iris device coming soon' },
  { key: 'face', title: 'Add Face Authentication Device', icon: 'smile', message: 'Face Auth device coming soon' },
  { key: 'rf-tag', title: 'Add RF Tag Device', icon: 'tag', message: 'RF Tag device coming soon' },
];

/** Route `/admin/devices`: placeholder for biometric / tag devices; every row only shows a "coming soon" toast (v1). */
export default function DevicesScreen() {
  const toast = useToast();
  const session = useSession();
  return (
    <Screen title="Add Devices" subtitle={session?.orgName || undefined} testID="devices-screen">
      <Card padding={0}>
        {DEVICES.map((device, index) => (
          <ListItem
            key={device.key}
            icon={device.icon}
            title={device.title}
            onPress={() => toast.info(device.message)}
            divider={index < DEVICES.length - 1}
            testID={`device-${device.key}`}
          />
        ))}
      </Card>
    </Screen>
  );
}
