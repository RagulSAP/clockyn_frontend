import React from 'react';

import { AnnouncementFeed } from '../components/AnnouncementFeed';

/** Staff / manager: announcements the admin sent to all staff or to selected staff (read-only). */
export default function BroadcastFeedScreen() {
  return <AnnouncementFeed feed="broadcast" />;
}
