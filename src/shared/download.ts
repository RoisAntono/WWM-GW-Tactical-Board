export function downloadTextFile(filename: string, content: string, type = 'application/json'): void {
  const blob = new Blob([content], { type });
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
