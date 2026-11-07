import React, { useEffect, useState } from 'react';
import { Modal as RNModal, Platform, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Spinner, Text } from '@/components/ui';
import type { SupportVideo } from '@/types/api/support';
import { spacing } from '@/theme';

/** Video surface: always black / white regardless of theme. */
const PLAYER_BG = '#000000';
const PLAYER_FG = '#FFFFFF';

export type VideoPlayerModalProps = {
  video: SupportVideo | null;
  onClose: () => void;
};

/** Full-screen guide video player with the platform's native controls (play, seek, fullscreen). */
export function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
  if (!video) return null;
  // keyed so every video gets its own player and starts fresh
  return <PlayerContent key={video.id} video={video} onClose={onClose} />;
}

function PlayerContent({ video, onClose }: { video: SupportVideo; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const player = useVideoPlayer(video.url, (p) => {
    p.play();
  });

  useEffect(() => {
    const apply = (s: string) => {
      if (s === 'readyToPlay') setStatus('ready');
      else if (s === 'error') setStatus('error');
    };
    apply(player.status);
    const sub = player.addListener('statusChange', ({ status: s }) => apply(s));
    return () => sub.remove();
  }, [player]);

  // Web: the RN modal only hears Escape while focus is inside it.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <RNModal transparent={false} visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View testID="video-player" style={{ flex: 1, backgroundColor: PLAYER_BG }}>
        {status === 'error' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
            <Text variant="title3" color={PLAYER_FG} align="center">
              Could not play this video
            </Text>
            <Text variant="body" color={PLAYER_FG} align="center">
              Check your connection and try again.
            </Text>
          </View>
        ) : (
          <VideoView
            player={player}
            style={{ flex: 1 }}
            nativeControls
            fullscreenOptions={{ enable: true }}
            contentFit="contain"
            accessibilityLabel={video.name}
          />
        )}

        {status === 'loading' ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <Spinner size="large" color={PLAYER_FG} />
          </View>
        ) : null}

        <View
          style={{
            position: 'absolute',
            top: insets.top + spacing.sm,
            left: spacing.md,
            right: spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Text variant="bodyStrong" color={PLAYER_FG} numberOfLines={1} style={{ flex: 1 }}>
            {video.name}
          </Text>
          <IconButton icon="x" variant="filled" size="md" accessibilityLabel="Close video" onPress={onClose} testID="video-player-close" />
        </View>
      </View>
    </RNModal>
  );
}
