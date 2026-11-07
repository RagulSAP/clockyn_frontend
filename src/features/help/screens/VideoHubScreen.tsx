import React, { useState } from 'react';
import { View } from 'react-native';

import { supportApi } from '@/api';
import { Screen } from '@/components/layout';
import { Card, EmptyState, ErrorState, ListItem, Reveal, SkeletonList } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { useSession } from '@/store/auth';
import type { SupportVideo } from '@/types/api/support';
import { radii } from '@/theme';

import { VideoPlayerModal } from '../components/VideoPlayerModal';
import { useSupportVideos } from '../hooks/useSupportVideos';

/** Video Hub: the active guide videos (the server only returns status = 1); a tap plays one full screen. */
export default function VideoHubScreen() {
  const videos = useSupportVideos();
  const session = useSession();
  const [selected, setSelected] = useState<SupportVideo | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await videos.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const play = (video: SupportVideo) => {
    setSelected(video);
    // Best effort: a failed tracking call must never get in the way of watching the video.
    if (session?.userId && session.orgId) {
      void supportApi.recordVideoView(video.id, { userId: session.userId, orgId: session.orgId }).catch(() => undefined);
    }
  };

  const list = videos.data ?? [];

  return (
    <Screen title="Video Hub" subtitle="Step-by-step guides" refreshing={refreshing} onRefresh={onRefresh} testID="video-hub-screen">
      {videos.isLoading ? (
        <SkeletonList count={4} />
      ) : videos.isError ? (
        <ErrorState message={getErrorMessage(videos.error, 'Failed to load videos')} onRetry={() => void videos.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon="play" title="No videos yet" message="Guide videos will appear here as soon as they are added." />
      ) : (
        <Reveal>
          <Card padding={0}>
            <View style={{ borderRadius: radii.lg, overflow: 'hidden' }}>
              {list.map((video, i) => (
                <ListItem
                  key={video.id}
                  icon="play"
                  title={video.name}
                  onPress={() => play(video)}
                  divider={i < list.length - 1}
                  testID={`video-${video.id}`}
                />
              ))}
            </View>
          </Card>
        </Reveal>
      )}
      <VideoPlayerModal video={selected} onClose={() => setSelected(null)} />
    </Screen>
  );
}
