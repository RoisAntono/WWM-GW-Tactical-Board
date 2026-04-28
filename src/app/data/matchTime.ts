export type ParsedMatchTime = {
  date: string;
  time?: string;
  display: string;
};

export function parseMatchTime(value?: string): ParsedMatchTime | undefined {
  const normalized = normalizeMatchTimeText(value);
  if (!normalized) {
    return undefined;
  }

  const match = normalized.match(/((?:19|20)\d{2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s+(\d{1,2})\s*[:.]\s*(\d{2}))?/);
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour, minute] = match;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== Number(year) ||
    parsedDate.getMonth() !== Number(month) - 1 ||
    parsedDate.getDate() !== Number(day)
  ) {
    return undefined;
  }

  const parsedHour = hour === undefined ? undefined : Number(hour);
  const parsedMinute = minute === undefined ? undefined : Number(minute);
  if (
    (parsedHour !== undefined && (parsedHour < 0 || parsedHour > 23)) ||
    (parsedMinute !== undefined && (parsedMinute < 0 || parsedMinute > 59))
  ) {
    return undefined;
  }

  const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const time = hour && minute ? `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}` : undefined;
  return {
    date,
    time,
    display: combineMatchDateTime(date, time),
  };
}

export function combineMatchDateTime(date: string, time?: string): string {
  const trimmedDate = date.trim();
  if (!trimmedDate) {
    return '';
  }

  return time?.trim() ? `${trimmedDate} ${time.trim()}` : trimmedDate;
}

function normalizeMatchTimeText(value?: string): string {
  return String(value ?? '')
    .replace(/[年月]/g, '/')
    .replace(/[日]/g, ' ')
    .replace(/[：]/g, ':')
    .replace(/[|]/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}
