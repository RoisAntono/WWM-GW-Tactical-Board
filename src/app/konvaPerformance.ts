import Konva from 'konva';

type NavigatorWithMemory = Navigator & {
  deviceMemory?: number;
};

export function configureKonvaPerformance(): void {
  const pixelRatio = getCanvasPixelRatioCap();
  Konva.pixelRatio = pixelRatio;
}

export function shouldReduceCanvasEffects(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const memory = (navigator as NavigatorWithMemory).deviceMemory;
  return coarsePointer || (typeof memory === 'number' && memory <= 4);
}

function getCanvasPixelRatioCap(): number {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 1;
  }

  const deviceRatio = window.devicePixelRatio || 1;
  const memory = (navigator as NavigatorWithMemory).deviceMemory;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;

  if (coarsePointer || (typeof memory === 'number' && memory <= 4)) {
    return Math.min(deviceRatio, 1);
  }

  return Math.min(deviceRatio, 1.5);
}
