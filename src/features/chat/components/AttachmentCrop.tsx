import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { useLatestRef } from '@/lib/realtime/useLatestRef';
import { spacing, useTheme } from '@/theme';

import type { PickedAttachment } from '../hooks/usePickAttachment';
import { cropAttachment } from '../utils/cropImage';
import {
  FULL_NORM,
  MIN_CROP_SIDE,
  applyAspect,
  aspectRatioOf,
  boundsOf,
  fitContain,
  isFullRect,
  moveRect,
  rectToNorm,
  rectToPx,
  resizeRect,
  toSourceCrop,
  type AspectKey,
  type Corner,
  type Rect,
  type Size,
} from '../utils/cropGeometry';
import { AspectChips, HANDLE_HIT, TOOL_FG, cornerBracketStyle } from './CropControls';

/** Space around the photo so the corner handles at the photo's edge stay inside the touch surface. */
const SURFACE_PAD = HANDLE_HIT / 2;
const DIM = 'rgba(0,0,0,0.62)';
const CORNERS: readonly Corner[] = ['tl', 'tr', 'bl', 'br'];
const CORNER_LABEL: Record<Corner, string> = { tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' };
const CORNER_CURSOR: Record<Corner, string> = { tl: 'nwse-resize', br: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize' };

/** Web: no browser scroll / zoom / text selection while a finger or the mouse drags a handle. */
const webGesture = (cursor: string): object => (Platform.OS === 'web' ? { touchAction: 'none', userSelect: 'none', cursor } : {});

export interface AttachmentCropProps {
  attachment: PickedAttachment;
  /** Leave the crop step; the attachment stays as it is. */
  onCancel: () => void;
  /** The cropped photo: the caller makes it the pending attachment. */
  onApply: (next: PickedAttachment) => void;
  /** Reset on an already cropped photo: the caller swaps `attachment` back to its `original` (this screen is then rebuilt). */
  onResetToOriginal?: () => void;
}

type Drag = 'move' | Corner;

/**
 * The crop step of the attachment preview: the photo with a draggable, resizable crop rectangle (4 corner handles, drag
 * inside to move, dimmed outside, minimum size), aspect presets, and Reset / Cancel / Done. Gestures use `PanResponder`
 * (touch and mouse, native and web). The rectangle is kept normalised (0..1 of the displayed photo) so it survives a
 * layout change; Done maps it to ORIGINAL-image pixels (`toSourceCrop`) and crops with `expo-image-manipulator`.
 */
export function AttachmentCrop({ attachment, onCancel, onApply, onResetToOriginal }: AttachmentCropProps) {
  const { colors } = useTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const [surface, setSurface] = useState<Size | null>(null);
  const [natural, setNatural] = useState<Size | null>(
    attachment.width && attachment.height ? { width: attachment.width, height: attachment.height } : null,
  );
  const [norm, setNorm] = useState<Rect>(FULL_NORM);
  const [aspect, setAspect] = useState<AspectKey>('free');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; // a crop that finishes after Cancel / close must not bring the preview back
    };
  }, []);

  const ratio = aspectRatioOf(aspect);
  const area = surface ? { width: Math.max(0, surface.width - 2 * SURFACE_PAD), height: Math.max(0, surface.height - 2 * SURFACE_PAD) } : null;
  const img = natural && area ? fitContain(natural, area) : null; // the photo inside the area (contain letterboxing)
  const ready = !!img && img.width > 0 && img.height > 0;
  const rect = ready && img ? rectToPx(norm, img) : null;

  const live = useLatestRef({ img: ready ? img : null, norm, ratio });
  const responders = useMemo(() => {
    const make = (kind: Drag) => {
      let start: Rect | null = null;
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const { img: shown, norm: current } = live.current;
          start = shown ? rectToPx(current, shown) : null;
        },
        onPanResponderMove: (_e, g) => {
          const { img: shown, ratio: lock } = live.current;
          if (!start || !shown) return;
          const bounds = boundsOf(shown);
          const next = kind === 'move' ? moveRect(start, g.dx, g.dy, bounds) : resizeRect(start, kind, g.dx, g.dy, bounds, MIN_CROP_SIDE, lock);
          setNorm(rectToNorm(next, shown));
        },
        onPanResponderRelease: () => {
          start = null;
        },
        onPanResponderTerminate: () => {
          start = null;
        },
      });
    };
    return { move: make('move'), tl: make('tl'), tr: make('tr'), bl: make('bl'), br: make('br') } as const;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; the handlers read the latest state through `live`
  }, []);

  const source = ready && img && natural && rect ? toSourceCrop(rect, img, natural) : null;

  const pickAspect = (key: AspectKey) => {
    setAspect(key);
    setError(null);
    if (!ready || !img) return;
    const px = rectToPx(norm, img);
    // a preset re-shapes the rectangle to the largest one of that ratio around the same centre; "Free" keeps it
    setNorm(rectToNorm(applyAspect(px, aspectRatioOf(key), boundsOf(img)), img));
  };

  const reset = () => {
    setError(null);
    setAspect('free');
    setNorm(FULL_NORM);
    if (attachment.original) onResetToOriginal?.();
  };

  const done = async () => {
    if (busy || !ready || !img || !natural || !rect || !source) return;
    if (isFullRect(rect, boundsOf(img), 1.5)) {
      onCancel(); // the whole photo: nothing to crop
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const next = await cropAttachment(attachment, source);
      if (alive.current) onApply(next);
    } catch {
      if (alive.current) setError('Could not crop this photo. The original is unchanged.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const onSurfaceLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSurface((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const ox = SURFACE_PAD + (img?.x ?? 0);
  const oy = SURFACE_PAD + (img?.y ?? 0);

  return (
    <View style={{ flex: 1 }} testID="attachment-crop">
      <View style={{ paddingTop: (insets?.top ?? 0) + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Text variant="bodyStrong" color={TOOL_FG} accessibilityRole="header">
          Crop photo
        </Text>
      </View>

      <View style={{ flex: 1 }} onLayout={onSurfaceLayout} testID="attachment-crop-surface">
        {area ? (
          <Image
            source={{ uri: attachment.uri }}
            style={{ position: 'absolute', left: SURFACE_PAD, top: SURFACE_PAD, width: area.width, height: area.height }}
            contentFit="contain"
            onLoad={(e) => {
              const { width, height } = e.source;
              if (width > 0 && height > 0) setNatural((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
            }}
            accessibilityLabel="Photo to crop"
            testID="attachment-crop-image"
          />
        ) : null}

        {ready && img && rect ? (
          <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
            {/* dimmed area outside the crop rectangle */}
            <View pointerEvents="none" style={{ position: 'absolute', left: ox, top: oy, width: img.width, height: rect.y, backgroundColor: DIM }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: ox, top: oy + rect.y + rect.height, width: img.width, height: img.height - rect.y - rect.height, backgroundColor: DIM }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: ox, top: oy + rect.y, width: rect.x, height: rect.height, backgroundColor: DIM }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: ox + rect.x + rect.width, top: oy + rect.y, width: img.width - rect.x - rect.width, height: rect.height, backgroundColor: DIM }} />

            {/* the rectangle: border, rule-of-thirds guides, drag-to-move body */}
            <View
              {...responders.move.panHandlers}
              accessible
              accessibilityLabel="Crop area. Drag to move."
              testID="attachment-crop-rect"
              style={[
                { position: 'absolute', left: ox + rect.x, top: oy + rect.y, width: rect.width, height: rect.height, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)' },
                webGesture('move'),
              ]}
            >
              {[1, 2].map((n) => (
                <View key={`v${n}`} pointerEvents="none" style={{ position: 'absolute', left: `${(n * 100) / 3}%`, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
              ))}
              {[1, 2].map((n) => (
                <View key={`h${n}`} pointerEvents="none" style={{ position: 'absolute', top: `${(n * 100) / 3}%`, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
              ))}
            </View>

            {CORNERS.map((corner) => (
              <View
                key={corner}
                {...responders[corner].panHandlers}
                accessible
                accessibilityLabel={`Crop handle ${CORNER_LABEL[corner]}`}
                testID={`attachment-crop-handle-${corner}`}
                style={[
                  {
                    position: 'absolute',
                    width: HANDLE_HIT,
                    height: HANDLE_HIT,
                    left: ox + rect.x + (corner === 'tl' || corner === 'bl' ? 0 : rect.width) - HANDLE_HIT / 2,
                    top: oy + rect.y + (corner === 'tl' || corner === 'tr' ? 0 : rect.height) - HANDLE_HIT / 2,
                  },
                  webGesture(CORNER_CURSOR[corner]),
                ]}
              >
                <View pointerEvents="none" style={cornerBracketStyle(corner)} />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.sm }}>
        <Text variant="caption" color="#B5B5B5" align="center" testID="attachment-crop-size">
          {source ? `${source.width} × ${source.height} px` : ' '}
        </Text>
        <AspectChips value={aspect} onChange={pickAspect} />
        {error ? (
          <Text variant="callout" color="#FF8A80" align="center" style={{ paddingHorizontal: spacing.lg }} accessibilityRole="alert" testID="attachment-crop-error">
            {error}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: spacing.md,
          paddingTop: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: Math.max(insets?.bottom ?? 0, spacing.md),
          backgroundColor: colors.surface,
        }}
      >
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="secondary" fullWidth onPress={onCancel} disabled={busy} testID="attachment-crop-cancel" />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Reset" variant="secondary" icon="rotate-ccw" fullWidth onPress={reset} disabled={busy} testID="attachment-crop-reset" />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Done" icon="check" fullWidth onPress={() => void done()} loading={busy} disabled={!ready} accessibilityLabel="Apply crop" testID="attachment-crop-done" />
        </View>
      </View>
    </View>
  );
}
