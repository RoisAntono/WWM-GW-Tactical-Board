export function downloadTextFile(filename: string, content: string, type = 'application/json'): void {
  const prepared = prepareTextDownload(filename, content, type);
  const blob = new Blob([prepared.content], { type: prepared.type });
  const url = URL.createObjectURL(blob);
  triggerDownload(filename, url);
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(filename: string, dataUrl: string): void {
  triggerDownload(filename, dataUrl);
}

function triggerDownload(filename: string, url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

export function prepareTextDownload(filename: string, content: string, type = 'application/json') {
  if (!isCsvDownload(filename, type)) {
    return { content, type };
  }

  return {
    content: content.startsWith('\uFEFF') ? content : `\uFEFF${content}`,
    type: ensureUtf8CsvType(type),
  };
}

function isCsvDownload(filename: string, type: string): boolean {
  return filename.toLowerCase().endsWith('.csv') || type.toLowerCase().includes('csv');
}

function ensureUtf8CsvType(type: string): string {
  return type.toLowerCase().includes('charset=') ? type : `${type};charset=utf-8`;
}
