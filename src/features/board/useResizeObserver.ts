import { RefObject, useEffect, useState } from 'react';

export type Size = {
  width: number;
  height: number;
};

export function useResizeObserver(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 960, height: 640 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
