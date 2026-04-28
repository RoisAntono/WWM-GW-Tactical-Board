import { useEffect, useState } from 'react';

export function useImageElement(src: string, fallbackSrc?: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement>();

  useEffect(() => {
    let cancelled = false;
    const nextImage = new Image();
    const fallbackImage = fallbackSrc ? new Image() : undefined;

    setImage(undefined);

    nextImage.src = src;
    nextImage.onload = () => {
      if (!cancelled) {
        setImage(nextImage);
      }
    };
    nextImage.onerror = () => {
      if (!fallbackImage) {
        return;
      }
      fallbackImage.src = fallbackSrc ?? '';
    };

    if (fallbackImage) {
      fallbackImage.onload = () => {
        if (!cancelled) {
          setImage(fallbackImage);
        }
      };
    }

    return () => {
      cancelled = true;
      nextImage.onload = null;
      nextImage.onerror = null;
      if (fallbackImage) {
        fallbackImage.onload = null;
      }
    };
  }, [fallbackSrc, src]);

  return image;
}
