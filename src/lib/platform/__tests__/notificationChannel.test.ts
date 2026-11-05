import fs from 'fs';
import path from 'path';

import { NOTIFICATION_CHANNEL_ID } from '../notifications';

describe('Android notification channel', () => {
  it('uses the v1 channel id', () => {
    expect(NOTIFICATION_CHANNEL_ID).toBe('attendance_notifications');
  });

  it('is configured as the FCM default channel in app.config.ts (pushes shown while the app is closed)', () => {
    const config = fs.readFileSync(path.resolve(__dirname, '../../../../app.config.ts'), 'utf8');
    expect(config).toContain(`defaultChannel: '${NOTIFICATION_CHANNEL_ID}'`);
  });
});
