import { describe, expect, it } from 'vitest';
import { maxOverlayScale, overlayScaleForView } from './boardMath';

describe('board overlay scale', () => {
  it('keeps overlays screen-stable at normal zoom levels', () => {
    expect(overlayScaleForView(0.25)).toBeCloseTo(4);
    expect(overlayScaleForView(0.5)).toBeCloseTo(2);
  });

  it('caps overlays when the map is zoomed far out', () => {
    expect(overlayScaleForView(0.06)).toBe(maxOverlayScale);
  });

  it('falls back to the cap for invalid view scales', () => {
    expect(overlayScaleForView(0)).toBe(maxOverlayScale);
    expect(overlayScaleForView(Number.NaN)).toBe(maxOverlayScale);
  });
});
