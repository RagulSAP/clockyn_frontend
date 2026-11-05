import React from 'react';

import { AnnouncementFeed } from '../components/AnnouncementFeed';

/** Staff / manager: announcements the admin sent to a branch or a department (read-only). */
export default function TargetedFeedScreen() {
  return <AnnouncementFeed feed="targeted" />;
}
