import {
  ASPECT_PRESETS,
  FULL_NORM,
  MIN_CROP_SIDE,
  applyAspect,
  aspectRatioOf,
  boundsOf,
  clampRect,
  fitContain,
  isFullRect,
  moveRect,
  rectToNorm,
  rectToPx,
  resizeRect,
  toSourceCrop,
} from '../cropGeometry';

const B = boundsOf({ width: 300, height: 200 });

describe('fitContain', () => {
  it('letterboxes a wide photo in a tall container (bars top and bottom)', () => {
    expect(fitContain({ width: 4000, height: 2000 }, { width: 400, height: 600 })).toEqual({ x: 0, y: 200, width: 400, height: 200 });
  });
  it('pillarboxes a tall photo in a wide container (bars left and right)', () => {
    expect(fitContain({ width: 1000, height: 2000 }, { width: 400, height: 400 })).toEqual({ x: 100, y: 0, width: 200, height: 400 });
  });
  it('also scales a small photo up to fill', () => {
    expect(fitContain({ width: 100, height: 100 }, { width: 300, height: 200 })).toEqual({ x: 50, y: 0, width: 200, height: 200 });
  });
  it('answers an empty rect for unknown / zero sizes', () => {
    expect(fitContain({ width: 0, height: 10 }, { width: 10, height: 10 })).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(fitContain({ width: 10, height: 10 }, { width: 0, height: 10 })).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('clampRect / moveRect', () => {
  it('keeps the rectangle inside the bounds and above the minimum size', () => {
    expect(clampRect({ x: -20, y: 190, width: 500, height: 10 }, B)).toEqual({ x: 0, y: 200 - MIN_CROP_SIDE, width: 300, height: MIN_CROP_SIDE });
  });
  it('lowers the minimum when the photo itself is smaller', () => {
    const tiny = boundsOf({ width: 30, height: 20 });
    expect(clampRect({ x: 0, y: 0, width: 1, height: 1 }, tiny)).toEqual({ x: 0, y: 0, width: 20, height: 20 });
  });
  it('moves with the finger and stops at every edge without resizing', () => {
    const r = { x: 50, y: 50, width: 100, height: 80 };
    expect(moveRect(r, 20, -10, B)).toEqual({ x: 70, y: 40, width: 100, height: 80 });
    expect(moveRect(r, -500, -500, B)).toEqual({ x: 0, y: 0, width: 100, height: 80 });
    expect(moveRect(r, 500, 500, B)).toEqual({ x: 200, y: 120, width: 100, height: 80 });
  });
});

describe('resizeRect (free)', () => {
  const start = { x: 100, y: 60, width: 100, height: 80 };
  it('the opposite corner stays put for every handle', () => {
    expect(resizeRect(start, 'br', 20, 10, B)).toEqual({ x: 100, y: 60, width: 120, height: 90 });
    expect(resizeRect(start, 'tl', -20, -10, B)).toEqual({ x: 80, y: 50, width: 120, height: 90 });
    expect(resizeRect(start, 'tr', 20, -10, B)).toEqual({ x: 100, y: 50, width: 120, height: 90 });
    expect(resizeRect(start, 'bl', -20, 10, B)).toEqual({ x: 80, y: 60, width: 120, height: 90 });
  });
  it('shrinks to the minimum and no further, keeping the anchor', () => {
    expect(resizeRect(start, 'br', -500, -500, B)).toEqual({ x: 100, y: 60, width: MIN_CROP_SIDE, height: MIN_CROP_SIDE });
    expect(resizeRect(start, 'tl', 500, 500, B)).toEqual({ x: 200 - MIN_CROP_SIDE, y: 140 - MIN_CROP_SIDE, width: MIN_CROP_SIDE, height: MIN_CROP_SIDE });
  });
  it('cannot grow past the image edges', () => {
    expect(resizeRect(start, 'br', 900, 900, B)).toEqual({ x: 100, y: 60, width: 200, height: 140 });
    expect(resizeRect(start, 'tl', -900, -900, B)).toEqual({ x: 0, y: 0, width: 200, height: 140 });
  });
});

describe('resizeRect (aspect locked)', () => {
  const start = { x: 0, y: 0, width: 160, height: 160 };
  it('keeps the ratio while dragging and anchors the opposite corner', () => {
    const r = resizeRect(start, 'br', 40, 40, B, MIN_CROP_SIDE, 1);
    expect(r.width / r.height).toBeCloseTo(1, 6);
    expect(r).toMatchObject({ x: 0, y: 0, width: 200, height: 200 });
  });
  it('is limited by the tighter axis of the image', () => {
    const r = resizeRect(start, 'br', 400, 400, B, MIN_CROP_SIDE, 1);
    expect(r).toMatchObject({ width: 200, height: 200 }); // the image is only 200 high
    const w = resizeRect({ x: 0, y: 0, width: 160, height: 90 }, 'br', 400, 400, B, MIN_CROP_SIDE, 16 / 9);
    expect(w.width / w.height).toBeCloseTo(16 / 9, 6);
    expect(w.y + w.height).toBeLessThanOrEqual(200 + 1e-6);
    expect(w.x + w.width).toBeLessThanOrEqual(300 + 1e-6);
  });
  it('keeps both sides at least the minimum for a wide ratio', () => {
    const r = resizeRect({ x: 100, y: 50, width: 160, height: 90 }, 'br', -500, -500, B, MIN_CROP_SIDE, 16 / 9);
    expect(r.height).toBeGreaterThanOrEqual(MIN_CROP_SIDE - 1e-6);
    expect(r.width / r.height).toBeCloseTo(16 / 9, 6);
  });
  it('works from the top-left handle too', () => {
    const r = resizeRect({ x: 100, y: 100, width: 100, height: 100 }, 'tl', -50, -50, B, MIN_CROP_SIDE, 1);
    expect(r).toMatchObject({ x: 50, y: 50, width: 150, height: 150 });
  });
});

describe('applyAspect', () => {
  it('free keeps the rectangle', () => {
    const r = { x: 10, y: 10, width: 100, height: 50 };
    expect(applyAspect(r, null, B)).toBe(r);
  });
  it('1:1 gives the largest square around the same centre, shifted inside the image', () => {
    expect(applyAspect({ x: 100, y: 50, width: 100, height: 100 }, 1, B)).toEqual({ x: 50, y: 0, width: 200, height: 200 });
    expect(applyAspect({ x: 0, y: 0, width: 40, height: 40 }, 1, B)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
  });
  it('16:9 and 4:3 fill the width / height of a 3:2 image', () => {
    const w = applyAspect({ x: 0, y: 0, width: 300, height: 200 }, 16 / 9, B);
    expect(w.width).toBe(300);
    expect(w.height).toBeCloseTo(168.75, 6);
    expect(w.y).toBeCloseTo((200 - 168.75) / 2, 6);
    const f = applyAspect({ x: 0, y: 0, width: 300, height: 200 }, 4 / 3, B);
    expect(f.height).toBeCloseTo(200, 6);
    expect(f.width).toBeCloseTo(266.67, 1);
  });
});

describe('presets', () => {
  it('knows the four presets', () => {
    expect(ASPECT_PRESETS.map((p) => p.key)).toEqual(['free', '1:1', '4:3', '16:9']);
    expect(aspectRatioOf('free')).toBeNull();
    expect(aspectRatioOf('16:9')).toBeCloseTo(16 / 9);
  });
});

describe('normalised <-> px', () => {
  it('round-trips and survives a different display size', () => {
    const px = { x: 30, y: 20, width: 150, height: 100 };
    const norm = rectToNorm(px, { width: 300, height: 200 });
    expect(norm).toEqual({ x: 0.1, y: 0.1, width: 0.5, height: 0.5 });
    expect(rectToPx(norm, { width: 600, height: 400 })).toEqual({ x: 60, y: 40, width: 300, height: 200 });
    expect(rectToPx(FULL_NORM, { width: 300, height: 200 })).toEqual(B);
  });
});

describe('toSourceCrop', () => {
  it('scales display pixels to original pixels (photo shown at 300x200, original 3000x2000)', () => {
    expect(toSourceCrop({ x: 30, y: 20, width: 150, height: 100 }, { width: 300, height: 200 }, { width: 3000, height: 2000 })).toEqual({
      originX: 300,
      originY: 200,
      width: 1500,
      height: 1000,
    });
  });
  it('is independent of the letterbox: the rectangle is image-local, so bars never shift the origin', () => {
    const natural = { width: 4000, height: 2000 };
    const shown = fitContain(natural, { width: 400, height: 600 }); // bars of 200px above and below
    expect(shown.y).toBe(200);
    expect(toSourceCrop({ x: 0, y: 0, width: shown.width, height: shown.height }, shown, natural)).toEqual({ originX: 0, originY: 0, width: 4000, height: 2000 });
    expect(toSourceCrop({ x: 200, y: 100, width: 200, height: 100 }, shown, natural)).toEqual({ originX: 2000, originY: 1000, width: 2000, height: 1000 });
  });
  it('scales each axis on its own and clamps to the image', () => {
    expect(toSourceCrop({ x: 290, y: 190, width: 50, height: 50 }, { width: 300, height: 200 }, { width: 600, height: 800 })).toEqual({
      originX: 580,
      originY: 760,
      width: 20,
      height: 40,
    });
    expect(toSourceCrop({ x: 0, y: 0, width: 0.1, height: 0.1 }, { width: 300, height: 200 }, { width: 600, height: 400 })).toMatchObject({ width: 1, height: 1 });
  });
});

describe('isFullRect', () => {
  it('is true for the whole photo within a pixel, false otherwise', () => {
    expect(isFullRect({ x: 0.4, y: 0, width: 299.5, height: 200 }, B)).toBe(true);
    expect(isFullRect({ x: 5, y: 0, width: 295, height: 200 }, B)).toBe(false);
  });
});
