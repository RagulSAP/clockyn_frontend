import React, { useEffect, useState } from 'react';
import { Modal as RNModal, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { spacing } from '@/theme';
import { IconButton } from './Button';
import { Spinner } from './Spinner';
import { Text } from './Text';
import { stableImageKey } from './Avatar';
import { useInsets } from './internal/insets';

export type ImageViewerProps = {
  uri: string | null | undefined;
  visible: boolean;
  onClose: () => void;
  /** Accessible description of the image. */
  caption?: string;
  testID?: string;
};

/** Photo viewing surface: always black / white regardless of theme. */
const VIEWER_BG = '#000000';
const VIEWER_FG = '#FFFFFF';
const ZOOM_STEPS = [1, 1.75, 2.5, 4];

/**
 * Full-screen image viewer. iOS supports pinch-to-zoom natively; every platform (incl. web and Android)
 * gets zoom +/- buttons. Close with the button, hardware back or Escape (web).
 */
export function ImageViewer({ uri, visible, onClose, caption, testID }: ImageViewerProps) {
  if (!visible || !uri) return null;
  // keyed so zoom / loading state starts fresh for every image and every open
  return <ViewerContent key={uri} uri={uri} onClose={onClose} caption={caption} testID={testID} />;
}

function ViewerContent({ uri, onClose, caption, testID }: { uri: string; onClose: () => void; caption?: string; testID?: string }) {
  const insets = useInsets();
  const { width, height } = useWindowDimensions();
  const [zoomIdx, setZoomIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const zoom = ZOOM_STEPS[zoomIdx];

  // Web: the RN modal only hears Escape while focus is inside it; the opener often keeps focus (e.g. a chat composer).
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
      <View testID={testID} style={{ flex: 1, backgroundColor: VIEWER_BG }}>
        <ScrollView
          horizontal
          style={{ flex: 1 }}
          contentContainerStyle={{ width: width * zoom, minHeight: '100%' }}
          showsHorizontalScrollIndicator={zoom > 1}
          bounces={zoom > 1}
        >
          <ScrollView
            style={{ width: width * zoom }}
            contentContainerStyle={{ height: height * zoom, justifyContent: 'center' }}
            maximumZoomScale={Platform.OS === 'ios' ? 4 : 1}
            minimumZoomScale={1}
            centerContent
            showsVerticalScrollIndicator={zoom > 1}
            showsHorizontalScrollIndicator={false}
            bounces={zoom > 1}
          >
            {failed ? (
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <Text color={VIEWER_FG}>
                  Could not load image
                </Text>
              </View>
            ) : (
              <Image
                source={{ uri, cacheKey: stableImageKey(uri) }}
                style={{ width: width * zoom, height: height * zoom }}
                contentFit="contain"
                cachePolicy="memory-disk"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
                accessibilityLabel={caption ?? 'Image'}
              />
            )}
          </ScrollView>
        </ScrollView>

        {loading && !failed ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <Spinner size="large" color={VIEWER_FG} />
          </View>
        ) : null}

        <View style={{ position: 'absolute', top: insets.top + spacing.sm, right: spacing.md, flexDirection: 'row', gap: spacing.sm }}>
          <IconButton icon="zoom-out" variant="filled" size="md" accessibilityLabel="Zoom out" disabled={zoomIdx === 0} onPress={() => setZoomIdx((i) => Math.max(0, i - 1))} />
          <IconButton
            icon="zoom-in"
            variant="filled"
            size="md"
            accessibilityLabel="Zoom in"
            disabled={zoomIdx === ZOOM_STEPS.length - 1}
            onPress={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
          />
          <IconButton icon="x" variant="filled" size="md" accessibilityLabel="Close image" onPress={onClose} />
        </View>
      </View>
    </RNModal>
  );
}
