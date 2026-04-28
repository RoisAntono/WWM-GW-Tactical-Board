import type { ImportRow } from '../../types/domain';
import { parseMatchTime } from '../../app/data/matchTime';
import { buildImportRow } from './importMapping';
import type { OcrProgress } from './ocrImport';

export const geminiModel = 'gemini-2.5-flash';
const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;

type GeminiRawRow = {
  ign?: unknown;
  matchTime?: unknown;
  defeated?: unknown;
  deaths?: unknown;
  assist?: unknown;
  damage?: unknown;
  tank?: unknown;
  heal?: unknown;
  siegeDamage?: unknown;
  funCoin?: unknown;
  notes?: unknown;
  confidence?: unknown;
};

type GeminiPayload = {
  rows?: GeminiRawRow[];
  matchTime?: unknown;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const prompt = [
  'Extract Where Winds Meet guild war match scoreboard rows from this image.',
  'Return structured JSON only.',
  'Also read the visible match time from Battle Results, Match Time, or similar summary areas.',
  'Put that timestamp in top-level matchTime using YYYY/MM/DD HH:mm when visible.',
  'Map columns into ign, defeated, deaths if visible, assist, damage, tank, heal, siegeDamage, funCoin, matchTime, and notes.',
  'Use numbers only for stat fields. If a value is unreadable, omit it instead of guessing.',
  'If a row is uncertain, keep the best visible IGN and add a short note.',
].join(' ');

export type GeminiImportResult = {
  rows: ImportRow[];
  matchTime?: string;
};

export async function recognizeRosterScreenshotWithGemini(
  file: File,
  apiKey: string,
  onProgress?: (progress: OcrProgress) => void,
): Promise<ImportRow[]> {
  return (await recognizeRosterScreenshotWithGeminiMeta(file, apiKey, onProgress)).rows;
}

export async function recognizeRosterScreenshotWithGeminiMeta(
  file: File,
  apiKey: string,
  onProgress?: (progress: OcrProgress) => void,
): Promise<GeminiImportResult> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error('Gemini API key is required.');
  }

  onProgress?.({ status: 'Preparing image for Gemini', progress: 0.15 });
  const imageData = await fileToBase64(file);
  onProgress?.({ status: 'Sending image to Gemini', progress: 0.35 });

  const response = await fetch(geminiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': trimmedKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: file.type || 'image/png',
                data: imageData,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: responseSchema,
      },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as GeminiGenerateContentResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini import failed with status ${response.status}.`);
  }

  onProgress?.({ status: 'Mapping Gemini response', progress: 0.82 });
  const result = parseGeminiResponsePayloadWithMeta(payload);
  onProgress?.({ status: 'Gemini import ready', progress: 1 });
  return result;
}

export function parseGeminiResponsePayload(response: GeminiGenerateContentResponse): ImportRow[] {
  return parseGeminiResponsePayloadWithMeta(response).rows;
}

export function parseGeminiResponsePayloadWithMeta(response: GeminiGenerateContentResponse): GeminiImportResult {
  const text = response.candidates?.flatMap((candidate) => candidate.content?.parts?.map((part) => part.text ?? '') ?? [])
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini did not return import rows.');
  }

  const parsed = JSON.parse(text) as GeminiPayload | GeminiRawRow[];
  const rows = Array.isArray(parsed) ? parsed : parsed.rows;
  if (!Array.isArray(rows)) {
    throw new Error('Gemini response does not contain a rows array.');
  }

  const rowImportRows = mapGeminiRowsToImportRows(rows);
  const topLevelMatchTime = !Array.isArray(parsed) ? parseMatchTime(stringValue(parsed.matchTime))?.display : undefined;

  return {
    rows: rowImportRows,
    matchTime: topLevelMatchTime,
  };
}

export function mapGeminiRowsToImportRows(rows: GeminiRawRow[]): ImportRow[] {
  return rows.map((row) => {
    const confidence = readConfidence(row.confidence);
    const importRow = buildImportRow(
      {
        IGN: stringValue(row.ign),
        MatchTime: stringValue(row.matchTime),
        Defeated: row.defeated,
        Deaths: row.deaths,
        Assist: row.assist,
        Damage: row.damage,
        Tank: row.tank,
        Heal: row.heal,
        'Siege Damage': row.siegeDamage,
        'Fun Coin': row.funCoin,
        Notes: stringValue(row.notes),
      },
      'gemini',
      confidence,
    );

    if (confidence !== undefined && confidence < 65) {
      return {
        ...importRow,
        warnings: [...importRow.warnings, 'Low Gemini confidence'],
      };
    }

    return importRow;
  });
}

function stringValue(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

function readConfidence(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const [, data] = result.split(',');
      resolve(data || result);
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}

const responseSchema = {
  type: 'object',
  properties: {
    matchTime: { type: 'string' },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ign: { type: 'string' },
          matchTime: { type: 'string' },
          defeated: { type: 'number' },
          deaths: { type: 'number' },
          assist: { type: 'number' },
          damage: { type: 'number' },
          tank: { type: 'number' },
          heal: { type: 'number' },
          siegeDamage: { type: 'number' },
          funCoin: { type: 'number' },
          notes: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
  },
  required: ['rows'],
} as const;
