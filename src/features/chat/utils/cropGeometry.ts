/**
 * Pure geometry of the photo crop tool (`AttachmentCrop`): the displayed image rectangle inside its container
 * (contentFit "contain" letterboxing), moving / resizing / aspect-locking the crop rectangle, and the mapping from the
 * rectangle on screen to ORIGINAL-image pixels for `expo-image-manipulator`. Framework free (unit-tested).
 *
 * Coordinates: the crop rectangle lives in IMAGE-LOCAL display coordinates, i.e. (0,0) is the top-left corner of the
 * displayed photo (not of the container) and the bounds are `{ 0, 0, displayedWidth, displayedHeight }`.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AspectKey = 'free' | '1:1' | '4:3' | '16:9';

export const ASPECT_PRESETS: readonly { key: AspectKey; label: string; ratio: number | null }[] = [
  { key: 'free', label: 'Free', ratio: null },
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:3', label: '4:3', ratio: 4 / 3 },
  { key: '16:9', label: '16:9', ratio: 16 / 9 },
];

/** Width / height of a preset (`null` = free). */
export function aspectRatioOf(key: AspectKey): number | null {
  return ASPECT_PRESETS.find((p) => p.key === key)?.ratio ?? null;
}

/** Smallest side of the crop rectangle on screen, in px. */
export const MIN_CROP_SIDE = 48;

export type Corner = 'tl' | 'tr' | 'bl' | 'br';

const isPositive = (n: number) => Number.isFinite(n) && n > 0;

/** The rectangle the photo occupies inside a container with `contentFit="contain"` (centered, letterboxed, may upscale). */
export function fitContain(natural: Size, container: Size): Rect {
  if (!isPositive(natural.width) || !isPositive(natural.height) || !isPositive(container.width) || !isPositive(container.height)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(container.width / natural.width, container.height / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height };
}

/** Normalised (0..1 of the displayed photo) -> image-local pixels. */
export const rectToPx = (norm: Rect, displayed: Size): Rect => ({
  x: norm.x * displayed.width,
  y: norm.y * displayed.height,
  width: norm.width * displayed.width,
  height: norm.height * displayed.height,
});

/** Image-local pixels -> normalised (0..1), so the selection survives a layout change (rotation, resize). */
export const rectToNorm = (px: Rect, displayed: Size): Rect => ({
  x: px.x / displayed.width,
  y: px.y / displayed.height,
  width: px.width / displayed.width,
  height: px.height / displayed.height,
});

export const FULL_NORM: Rect = { x: 0, y: 0, width: 1, height: 1 };

/** Bounds of the image-local space for a displayed image. */
export const boundsOf = (displayed: Size): Rect => ({ x: 0, y: 0, width: displayed.width, height: displayed.height });

/** The smallest allowed side, never larger than the bounds themselves. */
function minSideFor(bounds: Rect, min: number): number {
  return Math.max(1, Math.min(min, bounds.width, bounds.height));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Forces `rect` inside `bounds` (size first, then position) and at least `min` on each side. */
export function clampRect(rect: Rect, bounds: Rect, min: number = MIN_CROP_SIDE): Rect {
  const m = minSideFor(bounds, min);
  const width = clamp(rect.width, m, bounds.width);
  const height = clamp(rect.height, m, bounds.height);
  return {
    x: clamp(rect.x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(rect.y, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

/** Drags the whole rectangle by (dx, dy); it stops at the edges of the image and keeps its size. */
export function moveRect(rect: Rect, dx: number, dy: number, bounds: Rect): Rect {
  return {
    ...rect,
    x: clamp(rect.x + dx, bounds.x, bounds.x + bounds.width - rect.width),
    y: clamp(rect.y + dy, bounds.y, bounds.y + bounds.height - rect.height),
  };
}

/**
 * Drags one corner by (dx, dy) measured from the rectangle as it was when the drag began (`start`); the opposite corner stays
 * put. The result stays inside `bounds`, at least `min` per side, and keeps `ratio` (width / height) when one is given.
 */
export function resizeRect(start: Rect, corner: Corner, dx: number, dy: number, bounds: Rect, min: number = MIN_CROP_SIDE, ratio: number | null = null): Rect {
  const m = minSideFor(bounds, min);
  const right = corner === 'tr' || corner === 'br';
  const bottom = corner === 'bl' || corner === 'br';
  const anchorX = right ? start.x : start.x + start.width;
  const anchorY = bottom ? start.y : start.y + start.height;
  const room = {
    width: right ? bounds.x + bounds.width - anchorX : anchorX - bounds.x,
    height: bottom ? bounds.y + bounds.height - anchorY : anchorY - bounds.y,
  };
  let width = start.width + (right ? dx : -dx);
  let height = start.height + (bottom ? dy : -dy);
  if (ratio && ratio > 0) {
    // follow the finger on both axes: the mean of what each axis asks for
    width = (width + height * ratio) / 2;
    const maxWidth = Math.min(room.width, room.height * ratio);
    const minWidth = Math.max(m, m * ratio);
    width = clamp(width, Math.min(minWidth, maxWidth), maxWidth);
    height = width / ratio;
  } else {
    width = clamp(width, Math.min(m, room.width), room.width);
    height = clamp(height, Math.min(m, room.height), room.height);
  }
  return { x: right ? anchorX : anchorX - width, y: bottom ? anchorY : anchorY - height, width, height };
}

/**
 * Re-shapes `rect` to `ratio`: the largest rectangle of that ratio that fits in `bounds`, centred on the current centre
 * (shifted back inside when needed). `null` (free) leaves the rectangle as it is.
 */
export function applyAspect(rect: Rect, ratio: number | null, bounds: Rect): Rect {
  if (!ratio || ratio <= 0 || bounds.width <= 0 || bounds.height <= 0) return rect;
  const width = Math.min(bounds.width, bounds.height * ratio);
  const height = width / ratio;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    x: clamp(cx - width / 2, bounds.x, bounds.x + bounds.width - width),
    y: clamp(cy - height / 2, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

export interface SourceCrop {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * Maps the crop rectangle (image-local display coordinates, photo displayed at `displayed`) to pixels of the original
 * image of `natural` size: `scale = natural / displayed` per axis (the contain letterboxing is already out of the picture
 * because the rectangle is image-local). Integer, inside the image, at least 1 x 1.
 */
export function toSourceCrop(rect: Rect, displayed: Size, natural: Size): SourceCrop {
  const sx = natural.width / displayed.width;
  const sy = natural.height / displayed.height;
  const originX = clamp(Math.round(rect.x * sx), 0, Math.max(0, natural.width - 1));
  const originY = clamp(Math.round(rect.y * sy), 0, Math.max(0, natural.height - 1));
  const width = clamp(Math.round(rect.width * sx), 1, natural.width - originX);
  const height = clamp(Math.round(rect.height * sy), 1, natural.height - originY);
  return { originX, originY, width, height };
}

/** True when the rectangle covers (nearly) the whole photo: cropping would change nothing. */
export function isFullRect(rect: Rect, bounds: Rect, tolerance = 1): boolean {
  return (
    Math.abs(rect.x - bounds.x) <= tolerance &&
    Math.abs(rect.y - bounds.y) <= tolerance &&
    Math.abs(rect.width - bounds.width) <= tolerance &&
    Math.abs(rect.height - bounds.height) <= tolerance
  );
}
