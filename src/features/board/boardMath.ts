import type { Coordinate } from '../../types/domain';

export const mapSize = {
  width: 5792,
  height: 4344,
};

export const maxOverlayScale = 5;

export function denormalize(point: Coordinate): Coordinate {
  return {
    x: point.x * mapSize.width,
    y: point.y * mapSize.height,
  };
}

export function normalize(point: Coordinate): Coordinate {
  return {
    x: clamp(point.x / mapSize.width),
    y: clamp(point.y / mapSize.height),
  };
}

export function routePoints(points: Coordinate[]): number[] {
  return points.flatMap((point) => {
    const pixel = denormalize(point);
    return [pixel.x, pixel.y];
  });
}

export function overlayScaleForView(viewScale: number): number {
  if (!Number.isFinite(viewScale) || viewScale <= 0) {
    return maxOverlayScale;
  }

  return Math.min(1 / viewScale, maxOverlayScale);
}

export function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
