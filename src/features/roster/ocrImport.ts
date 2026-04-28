import type { ImportRow } from '../../types/domain';
import { parseMatchTime } from '../../app/data/matchTime';
import { buildImportRow } from './importMapping';
import { preprocessRosterScreenshot, type PreprocessedRosterScreenshot } from './ocrPreprocess';

export type OcrProgress = {
  status: string;
  progress: number;
};

type OcrWorker = {
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  recognize: (
    image: HTMLCanvasElement,
    options?: Record<string, unknown>,
    output?: Record<string, boolean>,
  ) => Promise<{ data: OcrPage & { confidence: number } }>;
  terminate: () => Promise<unknown>;
};

type OcrWord = {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
};

type OcrLine = {
  words: OcrWord[];
  text: string;
  confidence: number;
  bbox: OcrWord['bbox'];
};

type OcrPage = {
  text: string;
  confidence?: number;
  blocks?: Array<{
    paragraphs?: Array<{
      lines?: OcrLine[];
    }>;
  }> | null;
};

type OcrRowGroup = {
  words: OcrWord[];
  centerY: number;
  height: number;
};

type ParsedLayoutRow = {
  row: ImportRow;
  centerY: number;
  height: number;
};

export type RecognizedRosterScreenshot = {
  rows: ImportRow[];
  matchTime?: string;
};

const scoreboardColumns = {
  ignEnd: 0.18,
  defeated: [0.18, 0.255],
  assist: [0.255, 0.365],
  deaths: [0.365, 0.465],
  coin: [0.465, 0.565],
  dps: [0.565, 0.69],
  tank: [0.675, 0.79],
  heal: [0.77, 0.865],
  siege: [0.865, 1.02],
} as const;

export async function recognizeRosterScreenshot(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
): Promise<ImportRow[]> {
  return (await recognizeRosterScreenshotWithMeta(file, onProgress)).rows;
}

export async function recognizeRosterScreenshotWithMeta(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
): Promise<RecognizedRosterScreenshot> {
  const { default: Tesseract } = await import('tesseract.js');
  const preprocessed = await preprocessRosterScreenshot(file, (status, progress) => onProgress?.({ status, progress }));
  let progressOffset = 0.25;
  let progressScale = 0.65;
  const workerOptions = {
    logger: (message: { status?: unknown; progress?: unknown }) => {
      if ('status' in message && 'progress' in message) {
        onProgress?.({
          status: String(message.status),
          progress: progressOffset + Number(message.progress) * progressScale,
        });
      }
    },
  };
  let worker: OcrWorker = await Tesseract.createWorker('eng+chi_sim+chi_tra+jpn', Tesseract.OEM.DEFAULT, workerOptions)
    .catch(() => Tesseract.createWorker('eng+chi_sim', Tesseract.OEM.DEFAULT, workerOptions))
    .catch(() => Tesseract.createWorker('eng', Tesseract.OEM.DEFAULT, workerOptions));

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      preserve_interword_spaces: '1',
      user_defined_dpi: '300',
    });

    const result = await worker.recognize(preprocessed.canvas, undefined, { text: true, blocks: true });
    const layoutRows = parseOcrLayout(result.data as OcrPage, preprocessed.canvas.width, preprocessed.margin, result.data.confidence);
    const rows =
      layoutRows.length >= 3
        ? finalizeOcrRows(await improveIgnsWithRowNameOcr(layoutRows, preprocessed, worker))
        : finalizeOcrRows(parseOcrText(result.data.text, result.data.confidence));

    progressOffset = 0.91;
    progressScale = 0.08;
    onProgress?.({ status: 'Reading match time', progress: 0.91 });
    const matchTime = await recognizeMatchTimeFromScreenshot(preprocessed.sourceCanvas, worker);

    return { rows, matchTime };
  } finally {
    await worker.terminate();
  }
}

export function parseOcrText(text: string, confidence?: number): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/[|]+/g, ' ').trim())
    .filter(Boolean);

  return lines
    .map((line) => lineToImportRow(line, confidence))
    .filter((row) => row.ign && !looksLikeHeader(row.ign) && hasUsefulOcrData(row));
}

function parseOcrLayout(page: OcrPage, canvasWidth: number, margin: number, confidence?: number): ParsedLayoutRow[] {
  return groupWordsIntoRows(getOcrWords(page))
    .map((group) => {
      const row = wordsToLayoutImportRow(group.words, canvasWidth, margin, confidence);
      return row ? { row, centerY: group.centerY, height: group.height } : undefined;
    })
    .filter((row): row is ParsedLayoutRow => Boolean(row))
    .filter(({ row }) => !looksLikeHeader(row.ign) && hasUsefulOcrData(row));
}

function getOcrWords(page: OcrPage): OcrWord[] {
  return (
    page.blocks?.flatMap((block) =>
      block.paragraphs?.flatMap((paragraph) => paragraph.lines?.flatMap((line) => line.words) ?? []) ?? [],
    ) ?? []
  );
}

function groupWordsIntoRows(words: OcrWord[]): OcrRowGroup[] {
  const sortedWords = words
    .filter((word) => normalizeOcrToken(word.text) && (word.confidence >= 4 || /\d/.test(word.text)))
    .sort((first, second) => getWordCenterY(first) - getWordCenterY(second));

  if (sortedWords.length === 0) {
    return [];
  }

  const medianHeight = getMedian(sortedWords.map((word) => Math.max(1, word.bbox.y1 - word.bbox.y0)));
  const threshold = Math.max(20, medianHeight * 1.55);
  const rows: Array<{ centerY: number; words: OcrWord[] }> = [];

  sortedWords.forEach((word) => {
    const centerY = getWordCenterY(word);
    const row = rows.find((candidate) => Math.abs(candidate.centerY - centerY) <= threshold);

    if (!row) {
      rows.push({ centerY, words: [word] });
      return;
    }

    row.words.push(word);
    row.centerY =
      row.words.reduce((total, currentWord) => total + getWordCenterY(currentWord), 0) / row.words.length;
  });

  return rows
    .map((row) => {
      const sortedRowWords = row.words.sort((first, second) => first.bbox.x0 - second.bbox.x0);
      const minY = Math.min(...sortedRowWords.map((word) => word.bbox.y0));
      const maxY = Math.max(...sortedRowWords.map((word) => word.bbox.y1));

      return {
        words: sortedRowWords,
        centerY: row.centerY,
        height: Math.max(medianHeight, maxY - minY),
      };
    })
    .filter((row) => row.words.length > 0);
}

function wordsToLayoutImportRow(words: OcrWord[], canvasWidth: number, margin: number, confidence?: number): ImportRow | undefined {
  const buckets: Record<'ign' | 'defeated' | 'assist' | 'deaths' | 'coin' | 'dps' | 'tank' | 'heal' | 'siege', string[]> = {
    ign: [],
    defeated: [],
    assist: [],
    deaths: [],
    coin: [],
    dps: [],
    tank: [],
    heal: [],
    siege: [],
  };

  const usableWidth = Math.max(1, canvasWidth - margin * 2);

  words.forEach((word) => {
    const text = normalizeOcrToken(word.text);
    if (!text || (word.confidence < 4 && !/\d/.test(text))) {
      return;
    }

    const centerX = (word.bbox.x0 + word.bbox.x1) / 2;
    const normalizedX = (centerX - margin) / usableWidth;
    const bucket = getScoreboardBucket(normalizedX);

    if (!bucket) {
      return;
    }

    buckets[bucket].push(text);
  });

  const ign = cleanIgn(buckets.ign.join(' '));
  const row = buildImportRow(
    {
      IGN: ign,
      Defeated: getScoreboardNumber(buckets.defeated),
      Assist: getScoreboardNumber(buckets.assist),
      Deaths: getScoreboardNumber(buckets.deaths),
      'Coin AVG': getScoreboardNumber(buckets.coin),
      'DPS AVG': getScoreboardNumber(buckets.dps),
      'Tank AVG': getScoreboardNumber(buckets.tank),
      'Heal AVG': getScoreboardNumber(buckets.heal),
      'Siege AVG': getScoreboardNumber(buckets.siege),
    },
    'ocr',
    confidence,
  );

  return hasUsefulOcrData(row) ? row : undefined;
}

function getScoreboardBucket(
  normalizedX: number,
): 'ign' | 'defeated' | 'assist' | 'deaths' | 'coin' | 'dps' | 'tank' | 'heal' | 'siege' | undefined {
  if (normalizedX < 0 || normalizedX > 1.04) {
    return undefined;
  }

  if (normalizedX < scoreboardColumns.ignEnd) {
    return 'ign';
  }

  if (isInsideRange(normalizedX, scoreboardColumns.defeated)) {
    return 'defeated';
  }
  if (isInsideRange(normalizedX, scoreboardColumns.assist)) {
    return 'assist';
  }
  if (isInsideRange(normalizedX, scoreboardColumns.deaths)) {
    return 'deaths';
  }
  if (isInsideRange(normalizedX, scoreboardColumns.coin)) {
    return 'coin';
  }
  if (isInsideRange(normalizedX, scoreboardColumns.dps)) {
    return 'dps';
  }
  if (isInsideRange(normalizedX, scoreboardColumns.tank)) {
    return 'tank';
  }
  if (isInsideRange(normalizedX, scoreboardColumns.heal)) {
    return 'heal';
  }
  if (isInsideRange(normalizedX, scoreboardColumns.siege)) {
    return 'siege';
  }

  return undefined;
}

async function improveIgnsWithRowNameOcr(
  layoutRows: ParsedLayoutRow[],
  preprocessed: PreprocessedRosterScreenshot,
  worker: OcrWorker,
): Promise<ImportRow[]> {
  const needsFallback = layoutRows.some(({ row }) => shouldImproveIgn(row.ign));
  if (!needsFallback) {
    return layoutRows.map(({ row }) => row);
  }

  const improvedRows: ImportRow[] = [];
  for (const layoutRow of layoutRows) {
    const { row } = layoutRow;
    if (!shouldImproveIgn(row.ign)) {
      improvedRows.push(row);
      continue;
    }

    const fallbackName = await recognizeRowName(preprocessed, worker, layoutRow);
    improvedRows.push(fallbackName && !shouldImproveIgn(fallbackName) ? { ...row, ign: fallbackName } : row);
  }

  return improvedRows;
}

async function recognizeRowName(
  preprocessed: PreprocessedRosterScreenshot,
  worker: OcrWorker,
  row: ParsedLayoutRow,
): Promise<string | undefined> {
  const nameCanvas = createRowNameCanvas(preprocessed, row);

  await worker.setParameters({
    tessedit_pageseg_mode: '7',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });

  const result = await worker.recognize(nameCanvas, undefined, { text: true });
  const name = cleanIgn(result.data.text.replace(/\r?\n/g, ' '));

  if (!name || looksLikeHeader(name) || name.length < 2) {
    return undefined;
  }

  return name;
}

function createRowNameCanvas(preprocessed: PreprocessedRosterScreenshot, row: ParsedLayoutRow): HTMLCanvasElement {
  const sourceX = Math.round(preprocessed.crop.x + preprocessed.crop.width * 0.016);
  const rowCenterY = preprocessed.crop.y + (row.centerY - preprocessed.margin) / preprocessed.scale;
  const rowHeight = Math.max(32, (row.height / preprocessed.scale) * 2.5);
  const sourceY = Math.max(preprocessed.crop.y, Math.round(rowCenterY - rowHeight / 2));
  const sourceWidth = Math.round(preprocessed.crop.width * 0.155);
  const sourceHeight = Math.min(
    Math.round(rowHeight),
    Math.round(preprocessed.crop.y + preprocessed.crop.height - sourceY),
  );
  const scale = Math.max(4, preprocessed.scale * 1.35);
  const margin = 32;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sourceWidth * scale) + margin * 2;
  canvas.height = Math.round(sourceHeight * scale) + margin * 2;

  const context = get2dContext(canvas);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    preprocessed.sourceCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    margin,
    margin,
    Math.round(sourceWidth * scale),
    Math.round(sourceHeight * scale),
  );

  binarizeNameCanvas(canvas);
  return canvas;
}

function binarizeNameCanvas(canvas: HTMLCanvasElement): void {
  const context = get2dContext(canvas);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luma = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
    const isText = luma > 112 && luma < 245;
    const value = isText ? 0 : 255;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
}

function lineToImportRow(line: string, confidence?: number): ImportRow {
  const normalizedLine = normalizeOcrLine(line);
  const cells = normalizedLine.split(/\s{2,}|\t+/).filter(Boolean);

  if (cells.length <= 1) {
    const fallback = normalizedLine.split(/\s+/);
    const firstNumericIndex = fallback.findIndex(isNumericToken);
    const ign = firstNumericIndex > 0 ? fallback.slice(0, firstNumericIndex).join(' ') : fallback[0] ?? '';
    const stats = firstNumericIndex > 0 ? fallback.slice(firstNumericIndex).map(cleanNumberToken) : fallback.slice(1);

    return buildStatsImportRow(ign, stats, confidence);
  }

  const firstNumericIndex = cells.findIndex(isNumericToken);
  const ign = firstNumericIndex > 0 ? cells.slice(0, firstNumericIndex).join(' ') : cells[0] ?? '';
  const stats = (firstNumericIndex > 0 ? cells.slice(firstNumericIndex) : cells.slice(1)).map(cleanNumberToken);

  return buildStatsImportRow(ign, stats, confidence);
}

function buildStatsImportRow(ign: string, stats: string[], confidence?: number): ImportRow {
  if (stats.length >= 8) {
    return buildImportRow(
      {
        IGN: ign,
        Defeated: getTextScoreboardNumber(stats[0]),
        Assist: getTextScoreboardNumber(stats[1]),
        Deaths: getTextScoreboardNumber(stats[2]),
        'Coin AVG': getTextScoreboardNumber(stats[3]),
        'DPS AVG': getTextScoreboardNumber(stats[4]),
        'Tank AVG': getTextScoreboardNumber(stats[5]),
        'Heal AVG': getTextScoreboardNumber(stats[6]),
        'Siege AVG': getTextScoreboardNumber(stats[7]),
      },
      'ocr',
      confidence,
    );
  }

  return buildImportRow(
    {
      IGN: ign,
      Attendance: stats[0],
      'Last Played': stats[1],
      'DPS AVG': stats[2],
      'Heal AVG': stats[3],
      'Tank AVG': stats[4],
      'Siege AVG': stats[5],
      'Coin AVG': stats[6],
    },
    'ocr',
    confidence,
  );
}

function looksLikeHeader(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('ign') || normalized.includes('player') || normalized.includes('attendance');
}

function normalizeOcrLine(line: string): string {
  return line
    .replace(/[|]+/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .trim();
}

function normalizeOcrToken(token: string): string {
  return normalizeOcrLine(token).replace(/[{}[\]“”"]/g, '').trim();
}

function isNumericToken(value: string): boolean {
  return /\d/.test(value) && /^[\d,.\s/()OoIl!]+$/.test(value);
}

function cleanNumberToken(value: string): string {
  return value
    .replace(/[Oo]/g, '0')
    .replace(/[Il!]/g, '1')
    .replace(/[^\d.]/g, '');
}

function cleanJoinedNumber(tokens: string[]): string {
  return cleanNumberToken(tokens.join(''));
}

function getScoreboardNumber(tokens: string[]): string {
  return cleanJoinedNumber(tokens) || '0';
}

function getTextScoreboardNumber(value?: string): string {
  return cleanNumberToken(value ?? '') || '0';
}

function cleanIgn(value: string): string {
  return value
    .replace(/^[^A-Za-z0-9\u3400-\u9fff]+/g, '')
    .replace(/[^A-Za-z0-9\u3400-\u9fff._'’\-\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldImproveIgn(ign: string): boolean {
  const cleanedIgn = cleanIgn(ign);
  const meaningfulCharacters = cleanedIgn.replace(/[\d\s._'’\-]/g, '');
  return cleanedIgn.length < 3 || meaningfulCharacters.length < 2;
}

function finalizeOcrRows(rows: ImportRow[]): ImportRow[] {
  return rows.map((row, index) => {
    if (!shouldImproveIgn(row.ign)) {
      return row;
    }

    const fallbackIgn = `Review IGN ${String(index + 1).padStart(2, '0')}`;
    const warning = 'IGN OCR uncertain; edit manually';

    return {
      ...row,
      ign: fallbackIgn,
      warnings: row.warnings.includes(warning) ? row.warnings : [...row.warnings, warning],
    };
  });
}

function hasUsefulOcrData(row: ImportRow): boolean {
  const numericCount = [
    row.defeated ?? row.attendance,
    row.assist,
    row.deaths,
    row.dpsAvg,
    row.healAvg,
    row.tankAvg,
    row.siegeAvg,
    row.coinAvg,
  ].filter((value) => value !== undefined && Number.isFinite(value)).length;
  const meaningfulIgn = cleanIgn(row.ign).replace(/[\d\s._'’\-]/g, '').length >= 2;

  return numericCount >= 2 || (numericCount >= 1 && meaningfulIgn);
}

async function recognizeMatchTimeFromScreenshot(sourceCanvas: HTMLCanvasElement, worker: OcrWorker): Promise<string | undefined> {
  const candidates = [
    createMatchTimeCropCanvas(sourceCanvas, { x: 0.48, y: 0.22, width: 0.5, height: 0.56 }, true),
    createMatchTimeCropCanvas(sourceCanvas, { x: 0.58, y: 0.18, width: 0.38, height: 0.64 }, true),
    createMatchTimeCropCanvas(sourceCanvas, { x: 0.48, y: 0, width: 0.5, height: 0.3 }, true),
    createMatchTimeCropCanvas(sourceCanvas, { x: 0, y: 0, width: 1, height: 0.3 }, true),
    createMatchTimeCropCanvas(sourceCanvas, { x: 0, y: 0.16, width: 1, height: 0.68 }, true),
    createMatchTimeCropCanvas(sourceCanvas, { x: 0.48, y: 0.22, width: 0.5, height: 0.56 }, false),
  ];

  await worker.setParameters({
    tessedit_pageseg_mode: '6',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  });

  for (const canvas of candidates) {
    const result = await worker.recognize(canvas, undefined, { text: true });
    const parsed = parseMatchTime(result.data.text);
    if (parsed) {
      return parsed.display;
    }
  }

  return undefined;
}

function createMatchTimeCropCanvas(
  sourceCanvas: HTMLCanvasElement,
  crop: { x: number; y: number; width: number; height: number },
  binarize: boolean,
): HTMLCanvasElement {
  const sourceX = Math.round(sourceCanvas.width * crop.x);
  const sourceY = Math.round(sourceCanvas.height * crop.y);
  const sourceWidth = Math.round(sourceCanvas.width * crop.width);
  const sourceHeight = Math.round(sourceCanvas.height * crop.height);
  const scale = Math.min(5, Math.max(2.8, 1600 / Math.max(1, sourceWidth)));
  const margin = 24;
  const output = document.createElement('canvas');
  output.width = Math.round(sourceWidth * scale) + margin * 2;
  output.height = Math.round(sourceHeight * scale) + margin * 2;

  const context = get2dContext(output);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, output.width, output.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    sourceCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    margin,
    margin,
    Math.round(sourceWidth * scale),
    Math.round(sourceHeight * scale),
  );

  if (binarize) {
    binarizeMatchTimeCanvas(output);
  }

  return output;
}

function binarizeMatchTimeCanvas(canvas: HTMLCanvasElement): void {
  const context = get2dContext(canvas);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luma = Math.round(red * 0.299 + green * 0.587 + blue * 0.114);
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
    const isText = luma < 178 || (luma < 212 && saturation > 18);
    const value = isText ? 0 : 255;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
}

function isInsideRange(value: number, range: readonly [number, number]): boolean {
  return value >= range[0] && value < range[1];
}

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas 2D context is unavailable.');
  }

  return context;
}

function getWordCenterY(word: OcrWord): number {
  return (word.bbox.y0 + word.bbox.y1) / 2;
}

function getMedian(values: number[]): number {
  const sortedValues = [...values].sort((first, second) => first - second);
  const midpoint = Math.floor(sortedValues.length / 2);

  if (sortedValues.length === 0) {
    return 16;
  }

  if (sortedValues.length % 2 === 1) {
    return sortedValues[midpoint];
  }

  return (sortedValues[midpoint - 1] + sortedValues[midpoint]) / 2;
}
