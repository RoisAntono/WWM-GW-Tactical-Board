export type OcrPreprocessProgress = (status: string, progress: number) => void;

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreprocessedRosterScreenshot = {
  canvas: HTMLCanvasElement;
  sourceCanvas: HTMLCanvasElement;
  crop: CropRect;
  scale: number;
  margin: number;
};

const landscapeRosterBodyCrop: CropRect = {
  x: 0.115,
  y: 0.24,
  width: 0.805,
  height: 0.64,
};

const landscapeHeaderCrop: CropRect = {
  x: 0.05,
  y: 0.17,
  width: 0.9,
  height: 0.08,
};

const outputMargin = 28;

export async function preprocessRosterScreenshot(
  file: File,
  onProgress?: OcrPreprocessProgress,
): Promise<PreprocessedRosterScreenshot> {
  onProgress?.('Loading screenshot', 0.04);
  const image = await loadImage(file);
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = image.width;
  sourceCanvas.height = image.height;

  const sourceContext = get2dContext(sourceCanvas);
  sourceContext.drawImage(image, 0, 0);

  const crop = getRosterCrop(sourceCanvas);
  const scale = getPreprocessScale(crop.width, crop.height);
  const workingCanvas = document.createElement('canvas');
  workingCanvas.width = Math.round(crop.width * scale);
  workingCanvas.height = Math.round(crop.height * scale);

  const workingContext = get2dContext(workingCanvas);
  workingContext.imageSmoothingEnabled = true;
  workingContext.imageSmoothingQuality = 'high';
  workingContext.drawImage(
    sourceCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    workingCanvas.width,
    workingCanvas.height,
  );

  onProgress?.('Cleaning UI background', 0.14);
  const processedCanvas = binarizeForOcr(workingCanvas);

  onProgress?.('Preparing OCR canvas', 0.2);
  return {
    canvas: addWhiteMargin(processedCanvas, outputMargin),
    sourceCanvas,
    crop,
    scale,
    margin: outputMargin,
  };
}

async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file);
  }

  const image = new Image();
  image.decoding = 'async';
  const url = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to load screenshot image.'));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getRosterCrop(canvas: HTMLCanvasElement): CropRect {
  const aspectRatio = canvas.width / canvas.height;
  const relativeCrop = aspectRatio > 1.35 ? landscapeRosterBodyCrop : { x: 0, y: 0, width: 1, height: 1 };
  const headerCrop = aspectRatio > 1.35 ? landscapeHeaderCrop : undefined;

  if (headerCrop && !hasGameRosterHeader(canvas, headerCrop)) {
    return {
      x: Math.round(canvas.width * 0.04),
      y: Math.round(canvas.height * 0.12),
      width: Math.round(canvas.width * 0.92),
      height: Math.round(canvas.height * 0.76),
    };
  }

  return {
    x: Math.round(canvas.width * relativeCrop.x),
    y: Math.round(canvas.height * relativeCrop.y),
    width: Math.round(canvas.width * relativeCrop.width),
    height: Math.round(canvas.height * relativeCrop.height),
  };
}

function hasGameRosterHeader(canvas: HTMLCanvasElement, crop: CropRect): boolean {
  const context = get2dContext(canvas);
  const x = Math.round(canvas.width * crop.x);
  const y = Math.round(canvas.height * crop.y);
  const width = Math.round(canvas.width * crop.width);
  const height = Math.round(canvas.height * crop.height);
  const data = context.getImageData(x, y, width, height).data;
  let bluishPixels = 0;
  let sampledPixels = 0;

  for (let index = 0; index < data.length; index += 16) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luma = getLuma(red, green, blue);
    sampledPixels += 1;

    if (blue > red + 8 && blue > green - 4 && luma > 24 && luma < 112) {
      bluishPixels += 1;
    }
  }

  return sampledPixels > 0 && bluishPixels / sampledPixels > 0.08;
}

function getPreprocessScale(width: number, height: number): number {
  const targetWidth = 2400;
  const scale = targetWidth / width;
  return Math.min(3.2, Math.max(2.2, scale, 1800 / height));
}

function binarizeForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const context = get2dContext(canvas);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const lumas = new Uint8Array(data.length / 4);

  for (let pixel = 0, dataIndex = 0; dataIndex < data.length; pixel += 1, dataIndex += 4) {
    lumas[pixel] = getLuma(data[dataIndex], data[dataIndex + 1], data[dataIndex + 2]);
  }

  const threshold = getAdaptiveThreshold(lumas);
  const binary = new Uint8Array(lumas.length);

  for (let pixel = 0, dataIndex = 0; dataIndex < data.length; pixel += 1, dataIndex += 4) {
    const red = data[dataIndex];
    const green = data[dataIndex + 1];
    const blue = data[dataIndex + 2];
    const luma = lumas[pixel];
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
    const isText = luma >= threshold || (luma >= threshold - 24 && saturation > 18);
    binary[pixel] = isText ? 1 : 0;
  }

  const thickened = thickenText(binary, canvas.width, canvas.height);

  for (let pixel = 0, dataIndex = 0; dataIndex < data.length; pixel += 1, dataIndex += 4) {
    const value = thickened[pixel] ? 0 : 255;
    data[dataIndex] = value;
    data[dataIndex + 1] = value;
    data[dataIndex + 2] = value;
    data[dataIndex + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function getAdaptiveThreshold(lumas: Uint8Array): number {
  const histogram = new Uint32Array(256);
  lumas.forEach((luma) => {
    histogram[luma] += 1;
  });

  const target = Math.floor(lumas.length * 0.78);
  let cumulative = 0;
  for (let luma = 0; luma < histogram.length; luma += 1) {
    cumulative += histogram[luma];
    if (cumulative >= target) {
      return Math.min(150, Math.max(104, luma + 12));
    }
  }

  return 118;
}

function thickenText(binary: Uint8Array, width: number, height: number): Uint8Array {
  const output = new Uint8Array(binary);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (!binary[index]) {
        continue;
      }

      output[index - 1] = 1;
      output[index + 1] = 1;
      output[index + width] = 1;
    }
  }

  return output;
}

function addWhiteMargin(canvas: HTMLCanvasElement, margin: number): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = canvas.width + margin * 2;
  output.height = canvas.height + margin * 2;

  const context = get2dContext(output);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(canvas, margin, margin);
  return output;
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  return context;
}

function getLuma(red: number, green: number, blue: number): number {
  return Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
}
