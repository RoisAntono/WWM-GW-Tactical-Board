import type { ImportBatchFile, ImportSource } from '../../types/domain';

type ImportAuditMetaProps = {
  source: ImportSource;
  model?: string;
  files?: ImportBatchFile[];
  rowCount: number;
  acceptedCount: number;
  warningCount: number;
  duplicateCount?: number;
  detectedMatchTime?: string;
};

export function ImportAuditMeta({
  source,
  model,
  files = [],
  rowCount,
  acceptedCount,
  warningCount,
  duplicateCount,
  detectedMatchTime,
}: ImportAuditMetaProps) {
  const timestampOnlyCount = files.filter((file) => file.timestampOnly).length;
  const errorCount = files.filter((file) => file.error).length;
  const showFileMatchTime = files.some((file) => file.detectedMatchTime && file.detectedMatchTime !== detectedMatchTime);

  return (
    <div className="import-audit">
      <div className="import-audit-summary" aria-label="Import audit summary">
        <AuditStat label="Source" value={model ? `${source} ${model}` : source} />
        <AuditStat label="Detected" value={String(rowCount)} />
        <AuditStat label="Accepted" value={String(acceptedCount)} />
        <AuditStat label="Warnings" value={String(warningCount)} />
        {duplicateCount !== undefined ? <AuditStat label="Merged" value={String(duplicateCount)} /> : null}
        {detectedMatchTime ? <AuditStat label="Match Time" value={detectedMatchTime} /> : null}
        {files.length ? <AuditStat label="Files" value={String(files.length)} /> : null}
        {timestampOnlyCount ? <AuditStat label="Time Only" value={String(timestampOnlyCount)} /> : null}
        {errorCount ? <AuditStat label="Errors" value={String(errorCount)} /> : null}
      </div>

      {files.length ? (
        <div className="import-audit-file-wrap">
          <table className="import-audit-file-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Rows</th>
                <th>Accepted</th>
                <th>Warnings</th>
                {showFileMatchTime ? <th>Match Time</th> : null}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id}>
                  <td title={file.fileName}>{file.fileName ?? 'Unknown file'}</td>
                  <td>{file.rowCount}</td>
                  <td>{file.acceptedCount}</td>
                  <td>{file.warningCount}</td>
                  {showFileMatchTime ? <td>{file.detectedMatchTime ?? '-'}</td> : null}
                  <td title={file.error}>{file.error ? 'Error' : file.timestampOnly ? 'Timestamp only' : 'Rows detected'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function AuditStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
