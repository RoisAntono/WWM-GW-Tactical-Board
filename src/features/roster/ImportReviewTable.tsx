import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { updateImportRowField } from '../../app/data/importValidation';
import { memberRankOptions, memberRoleOrder, memberTeamOptions } from '../../shared/constants';
import type { ImportRow } from '../../types/domain';

type ImportReviewTableProps = {
  rows: ImportRow[];
  mode?: 'member' | 'match';
  onRowsChange: (rows: ImportRow[]) => void;
  onApply: (mode: 'append' | 'replace') => void;
  onClear: () => void;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  showSecondary?: boolean;
  metaContent?: ReactNode;
};

type ReviewField = {
  key: keyof ImportRow;
  label: string;
  type?: 'number' | 'memberRole' | 'rank' | 'team';
  className?: string;
};

const memberFields: ReviewField[] = [
  { key: 'ign', label: 'IGN' },
  { key: 'memberRole', label: 'Role', type: 'memberRole', className: 'role-col' },
  { key: 'rank', label: 'Rank', type: 'rank', className: 'role-col' },
  { key: 'team', label: 'Team', type: 'team', className: 'optional-col' },
  { key: 'party', label: 'Party', className: 'optional-col' },
  { key: 'attendance', label: 'Attendance', type: 'number', className: 'stat-col' },
  { key: 'lastPlayed', label: 'Last Played', className: 'optional-col' },
  { key: 'defeated', label: 'Defeated AVG', type: 'number', className: 'stat-col' },
  { key: 'assist', label: 'Assist AVG', type: 'number', className: 'stat-col' },
  { key: 'deaths', label: 'Deaths AVG', type: 'number', className: 'stat-col' },
  { key: 'dpsAvg', label: 'Damage', type: 'number', className: 'stat-col' },
  { key: 'tankAvg', label: 'Tank', type: 'number', className: 'stat-col' },
  { key: 'healAvg', label: 'Heal', type: 'number', className: 'stat-col' },
  { key: 'siegeAvg', label: 'Siege Damage', type: 'number', className: 'stat-col-wide' },
  { key: 'coinAvg', label: 'Fun Coin', type: 'number', className: 'stat-col' },
];

const matchFields: ReviewField[] = [
  { key: 'ign', label: 'IGN' },
  { key: 'matchTime', label: 'Match Time', className: 'timestamp-col' },
  { key: 'defeated', label: 'Kills', type: 'number', className: 'stat-col' },
  { key: 'assist', label: 'Assist', type: 'number', className: 'stat-col' },
  { key: 'deaths', label: 'Deaths', type: 'number', className: 'stat-col' },
  { key: 'coinAvg', label: 'Fun Coin', type: 'number', className: 'stat-col' },
  { key: 'dpsAvg', label: 'Damage', type: 'number', className: 'stat-col' },
  { key: 'tankAvg', label: 'Tank', type: 'number', className: 'stat-col' },
  { key: 'healAvg', label: 'Heal', type: 'number', className: 'stat-col' },
  { key: 'siegeAvg', label: 'Siege Damage', type: 'number', className: 'stat-col-wide' },
];

export function ImportReviewTable({
  rows,
  mode = 'member',
  onRowsChange,
  onApply,
  onClear,
  description = 'Review OCR/CSV output before applying it to the roster. Suspicious rows stay editable here.',
  primaryLabel = 'Apply Append',
  secondaryLabel = 'Replace Roster',
  showSecondary = true,
  metaContent,
}: ImportReviewTableProps) {
  const editableFields = mode === 'match' ? matchFields : memberFields;
  const showSourceColumn = shouldShowSourceColumn(rows);
  const sourceColumnIndex = mode === 'match' ? 2 : 1;
  const leadingFields = showSourceColumn ? editableFields.slice(0, sourceColumnIndex) : editableFields;
  const trailingFields = showSourceColumn ? editableFields.slice(sourceColumnIndex) : [];

  const updateRow = (id: string, key: keyof ImportRow, value: string) => {
    onRowsChange(
      rows.map((row) => {
        if (row.id !== id) {
          return row;
        }

        return updateImportRowField(row, key, value, mode);
      }),
    );
  };

  if (rows.length === 0) {
    return null;
  }

  return createPortal(
    <div className="modal-backdrop" role="presentation">
      <section
        className={`import-review-modal${metaContent ? ' has-meta' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-review-title"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Import Review</p>
            <h2 id="import-review-title">{rows.length} detected rows</h2>
          </div>
          <button className="ghost-button" onClick={onClear}>
            Close
          </button>
        </div>

        <div className="review-summary">{description}</div>
        {metaContent ? <div className="review-meta">{metaContent}</div> : null}

        <div className="review-table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <ReviewHeaderFields fields={leadingFields} />
                {showSourceColumn ? <th className="source-col">Source</th> : null}
                <ReviewHeaderFields fields={trailingFields} />
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.warnings.length ? 'has-warning' : ''}>
                  <ReviewInputFields fields={leadingFields} row={row} updateRow={updateRow} />
                  {showSourceColumn ? (
                    <td className="source-col">
                      <SourceCell row={row} />
                    </td>
                  ) : null}
                  <ReviewInputFields fields={trailingFields} row={row} updateRow={updateRow} />
                  <td>{row.warnings.join(', ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-actions">
          <button className="primary-button" onClick={() => onApply('append')}>
            {primaryLabel}
          </button>
          {showSecondary ? (
            <button className="secondary-button" onClick={() => onApply('replace')}>
              {secondaryLabel}
            </button>
          ) : null}
          <button className="ghost-button" onClick={onClear}>
            Cancel
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function ReviewHeaderFields({ fields }: { fields: ReviewField[] }) {
  return (
    <>
      {fields.map((field) => (
        <th key={field.key} className={field.className}>
          {field.label}
        </th>
      ))}
    </>
  );
}

function ReviewInputFields({
  fields,
  row,
  updateRow,
}: {
  fields: ReviewField[];
  row: ImportRow;
  updateRow: (id: string, key: keyof ImportRow, value: string) => void;
}) {
  return (
    <>
      {fields.map((field) => (
        <td key={field.key} className={field.className}>
          {field.type === 'memberRole' ? (
            <select value={row.memberRole ?? ''} onChange={(event) => updateRow(row.id, field.key, event.target.value)}>
              <option value="">DPS</option>
              {memberRoleOrder.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          ) : field.type === 'rank' ? (
            <select value={row.rank ?? ''} onChange={(event) => updateRow(row.id, field.key, event.target.value)}>
              <option value="">Member</option>
              {memberRankOptions.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </select>
          ) : field.type === 'team' ? (
            <select value={(row.team as string | undefined) ?? ''} onChange={(event) => updateRow(row.id, field.key, event.target.value)}>
              <option value="">No Team</option>
              {row.team && !memberTeamOptions.some((team) => team.label === row.team || team.id === row.team) ? (
                <option value={row.team}>{row.team}</option>
              ) : null}
              {memberTeamOptions.map((team) => (
                <option key={team.id} value={team.label}>
                  {team.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type === 'number' ? 'number' : 'text'}
              value={(row[field.key] as string | number | undefined) ?? ''}
              onChange={(event) => updateRow(row.id, field.key, event.target.value)}
            />
          )}
        </td>
      ))}
    </>
  );
}

function SourceCell({ row }: { row: ImportRow }) {
  const sourceLabel = getImportRowSourceLabel(row);
  if (row.mergedSourceRows?.length) {
    return (
      <details className="source-drilldown">
        <summary title={sourceLabel}>{row.mergedSourceRows.length} sources</summary>
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>IGN</th>
              <th>K</th>
              <th>A</th>
              <th>D</th>
              <th>Dmg</th>
              <th>Warn</th>
            </tr>
          </thead>
          <tbody>
            {row.mergedSourceRows.map((sourceRow) => (
              <tr key={sourceRow.id}>
                <td title={sourceRow.sourceFileName}>{sourceRow.sourceFileName ?? '-'}</td>
                <td>{sourceRow.ign || '-'}</td>
                <td>{formatOptionalNumber(sourceRow.defeated)}</td>
                <td>{formatOptionalNumber(sourceRow.assist)}</td>
                <td>{formatOptionalNumber(sourceRow.deaths)}</td>
                <td>{formatOptionalNumber(sourceRow.dpsAvg)}</td>
                <td title={sourceRow.warnings.join(', ')}>{sourceRow.warnings.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    );
  }

  return (
    <span className="source-cell" title={sourceLabel}>
      {sourceLabel || '-'}
    </span>
  );
}

function formatOptionalNumber(value: number | undefined): string {
  return value === undefined ? '-' : String(value);
}

function getImportRowSourceLabel(row: ImportRow): string {
  const names = row.sourceFileNames?.length ? row.sourceFileNames : row.sourceFileName ? [row.sourceFileName] : [];
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).join(', ');
}

function shouldShowSourceColumn(rows: ImportRow[]): boolean {
  if (rows.some((row) => row.mergedSourceRows?.length)) {
    return true;
  }

  const sourceLabels = new Set(rows.map(getImportRowSourceLabel).filter(Boolean));
  return sourceLabels.size > 1;
}
