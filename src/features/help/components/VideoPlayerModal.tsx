import React, { useEffect, useState } from 'react';
import { Modal as RNModal, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Spinner, Text } from '@/components/ui';
import type { SupportVideo } from '@/types/api/support';
import { radii, spacing } from '@/theme';

/** Video surface: always dark / white regardless of theme (a cinema-style card, like every video app). */
const SCRIM = 'rgba(6, 8, 12, 0.88)';
const CARD_BG = '#0B0B0D';
const PLAYER_BG = '#000000';
const PLAYER_FG = '#FFFFFF';
const PLAYER_MUTED = 'rgba(255, 255, 255, 0.62)';
const CARD_BORDER = 'rgba(255, 255, 255, 0.10)';

/** Guide videos are phone recordings, so portrait is the starting shape until the real size is known. */
const DEFAULT_RATIO = 9 / 16;
const MIN_RATIO = 0.4;
const MAX_RATIO = 2.4;
/** Room taken by the card header (title + close) and the card's own padding, subtracted from the height budget. */
const HEADER_HEIGHT = 76;
const MAX_CARD_WIDTH_PORTRAIT = 400;
const MAX_CARD_WIDTH_LANDSCAPE = 760;

export type VideoPlayerModalProps = {
  video: SupportVideo | null;
  onClose: () => void;
};

/**
 * Size of the video frame: as large as fits the window without scrolling, never wider than a comfortable card,
 * and always the video's own shape (portrait stays portrait, landscape stays landscape), so there are no big black bars.
 */
export function videoFrameSize(windowWidth: number, windowHeight: number, topInset: number, bottomInset: number, ratio: number) {
  const r = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio || DEFAULT_RATIO));
  const maxWidth = (r >= 1 ? MAX_CARD_WIDTH_LANDSCAPE : MAX_CARD_WIDTH_PORTRAIT);
  const availWidth = Math.min(windowWidth - spacing.lg * 2, maxWidth);
  const availHeight = windowHeight - topInset - bottomInset - spacing.lg * 2 - HEADER_HEIGHT;
  const width = Math.max(180, Math.min(availWidth, availHeight * r));
  return { width: Math.round(width), height: Math.round(width / r) };
}

/** Guide video player: a rounded card on a dimmed backdrop with the platform's native controls (play, seek, fullscreen). */
export function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
  if (!video) return null;
  // keyed so every video gets its own player and starts fresh
  return <PlayerContent key={video.id} video={video} onClose={onClose} />;
}

function PlayerContent({ video, onClose }: { video: SupportVideo; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const player = useVideoPlayer(video.url);

  // Start once the view is mounted: on web the player has no <video> element yet while it is being created, so a
  // `play()` in the setup callback would do nothing. A browser may still refuse autoplay; the controls then show Play.
  useEffect(() => {
    player.play();
  }, [player]);

  // Loading ends at the first picture, at readyToPlay, or when playback starts, whichever comes first (a browser that
  // does not autoplay never reaches readyToPlay, which used to leave the spinner on top of the video).
  const markReady = () => setStatus((s) => (s === 'loading' ? 'ready' : s));
  useEffect(() => {
    const apply = (s: string) => {
      if (s === 'readyToPlay') setStatus((cur) => (cur === 'error' ? cur : 'ready'));
      else if (s === 'error') setStatus('error');
    };
    apply(player.status);
    const statusSub = player.addListener('statusChange', ({ status: s }) => apply(s));
    const playingSub = player.addListener('playingChange', ({ isPlaying }) => {
      if (isPlaying) markReady();
    });
    return () => {
      statusSub.remove();
      playingSub.remove();
    };
  }, [player]);

  // Fit the card to the video's real shape once the file reports its size (best effort: portrait until then).
  useEffect(() => {
    const apply = (size?: { width?: number; height?: number } | null) => {
      if (size && size.width && size.height) setRatio(size.width / size.height);
    };
    apply(player.videoTrack?.size);
    const trackSub = player.addListener('videoTrackChange', ({ videoTrack }) => apply(videoTrack?.size));
    const sourceSub = player.addListener('sourceLoad', ({ availableVideoTracks }) => apply(availableVideoTracks?.[0]?.size));
    return () => {
      trackSub.remove();
      sourceSub.remove();
    };
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

  const frame = videoFrameSize(winW, winH, insets.top, insets.bottom, ratio);

  return (
    <RNModal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View
        testID="video-player"
        style={{
          flex: 1,
          backgroundColor: SCRIM,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.lg,
        }}
      >
        {/* Tap anywhere outside the card to close. */}
        <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close video" testID="video-player-backdrop" />

        <View
          style={{
            width: frame.width,
            backgroundColor: CARD_BG,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: CARD_BORDER,
            overflow: 'hidden',
            shadowColor: '#000000',
            shadowOpacity: 0.55,
            shadowRadius: 28,
            shadowOffset: { width: 0, height: 14 },
            elevation: 18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingVertical: spacing.sm, minHeight: 60 }}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color={PLAYER_MUTED} numberOfLines={1}>
                Guide video
              </Text>
              <Text variant="bodyStrong" color={PLAYER_FG} numberOfLines={2}>
                {video.name}
              </Text>
            </View>
            <IconButton icon="x" variant="tonal" size="md" accessibilityLabel="Close video" onPress={onClose} testID="video-player-close" />
          </View>

          <View style={{ width: frame.width, height: frame.height, backgroundColor: PLAYER_BG }}>
            {status === 'error' ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
                <Text variant="title3" color={PLAYER_FG} align="center">
                  Could not play this video
                </Text>
                <Text variant="body" color={PLAYER_MUTED} align="center">
                  Check your connection and try again.
                </Text>
              </View>
            ) : (
              // An explicit full-size box inside a clipped container: on web a bare `flex: 1` <video> grows to its intrinsic
              // height (a portrait phone recording becomes taller than the window and its controls fall off screen).
              <View style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <VideoView
                  player={player}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  nativeControls
                  fullscreenOptions={{ enable: true }}
                  contentFit="contain"
                  playsInline
                  onFirstFrameRender={markReady}
                  accessibilityLabel={video.name}
                />
              </View>
            )}

            {status === 'loading' ? (
              <View testID="video-loading" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Spinner size="large" color={PLAYER_FG} />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </RNModal>
  );
}
