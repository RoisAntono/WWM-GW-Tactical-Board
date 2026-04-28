import { describe, expect, it } from 'vitest';
import { prepareTextDownload } from './download';

describe('download helpers', () => {
  it('adds a UTF-8 BOM and charset for CSV downloads', () => {
    const prepared = prepareTextDownload('members.csv', 'IGN\n宴韵', 'text/csv');

    expect(prepared.content).toBe('\uFEFFIGN\n宴韵');
    expect(prepared.type).toBe('text/csv;charset=utf-8');
  });

  it('does not change non-CSV downloads', () => {
    const prepared = prepareTextDownload('workspace.json', '{"ign":"宴韵"}', 'application/json');

    expect(prepared.content).toBe('{"ign":"宴韵"}');
    expect(prepared.type).toBe('application/json');
  });
});
