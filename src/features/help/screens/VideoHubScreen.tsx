import React, { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout';
import { Card, EmptyState, ErrorState, ListItem, Reveal, SkeletonList } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import type { SupportVideo } from '@/types/api/support';
import { radii } from '@/theme';

import { VideoPlayerModal } from '../components/VideoPlayerModal';
import { useSupportVideos } from '../hooks/useSupportVideos';

/** Video Hub: the active guide videos (the server only returns status = 1); a tap plays one full screen. */
export default function VideoHubScreen() {
  const videos = useSupportVideos();
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
                  onPress={() => setSelected(video)}
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
