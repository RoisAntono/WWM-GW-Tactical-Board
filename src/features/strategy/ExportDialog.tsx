import { Crosshair, Database, FileDown, FileJson, Sheet, X } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { selectMemberCsvRows, selectMemberStats } from '../../app/data/selectors';
import { serializeWorkspaceBackup } from '../../app/workspaceSerialization';
import { downloadBlob, downloadTextFile } from '../../shared/download';
import type { GuildDatabase, TacticalPlan } from '../../types/domain';
import type { BoardCanvasHandle } from '../board/BoardCanvas';
import { serializePlan } from './planSerialization';

type ExportDialogProps = {
  open: boolean;
  plan: TacticalPlan;
  guild: GuildDatabase;
  activePhaseId: string;
  boardRef: RefObject<BoardCanvasHandle | null>;
  onClose: () => void;
};

export function ExportDialog({ open, plan, guild, activePhaseId, boardRef, onClose }: ExportDialogProps) {
  if (!open) {
    return null;
  }

  const activePhase = plan.phases.find((phase) => phase.id === activePhaseId) ?? plan.phases[0];
  const baseName = safeName(plan.title);

  const exportMemberCsv = async () => {
    const { default: Papa } = await import('papaparse');
    const rows = selectMemberCsvRows(selectMemberStats(guild));
    downloadTextFile(`${baseName}-members.csv`, Papa.unparse(rows), 'text/csv');
  };

  const exportMemberXlsx = async () => {
    const { createRosterWorkbookBlob } = await import('../roster/xlsxExport');
    const blob = await createRosterWorkbookBlob(plan, guild);
    downloadBlob(`${baseName}-guild-data.xlsx`, blob);
  };

  return (
    <div className="share-preview-backdrop" role="presentation">
      <section className="export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Workspace Export</p>
            <h2 id="export-title">Export</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close export dialog">
            <X size={18} />
          </button>
        </div>

        <div className="export-grid">
          <ExportAction
            icon={<FileDown size={18} />}
            title="Map PNG"
            description="Full map export for the active phase, using the current visible board layers."
            action="Export PNG"
            onClick={() => boardRef.current?.exportPng()}
          />
          <ExportAction
            icon={<FileJson size={18} />}
            title="Plan JSON"
            description="Tactical plan only. Use this when you do not need guild database data."
            action="Export Plan"
            onClick={() => downloadTextFile(`${baseName}.wwm-plan.json`, serializePlan(plan))}
          />
          <ExportAction
            icon={<Database size={18} />}
            title="Workspace Backup"
            description="Plan plus guild database. Best option before reset or moving devices."
            action="Export Backup"
            onClick={() => downloadTextFile(`${baseName}-workspace-backup.json`, serializeWorkspaceBackup(plan, guild), 'application/json')}
          />
          <ExportAction
            icon={<Crosshair size={18} />}
            title="Objective Coordinates"
            description={`JSON coordinates for ${activePhase?.name ?? 'the active phase'}.`}
            action="Export JSON"
            onClick={() => {
              const payload = {
                version: 1,
                planTitle: plan.title,
                phaseId: activePhase?.id,
                phaseName: activePhase?.name,
                objectives: activePhase?.objectives ?? [],
              };
              downloadTextFile(`${baseName}-objective-coordinates.json`, JSON.stringify(payload, null, 2));
            }}
          />
          <ExportAction
            icon={<Sheet size={18} />}
            title="Member CSV"
            description="Guild member table in CSV format for spreadsheet import."
            action="Export CSV"
            onClick={() => {
              void exportMemberCsv();
            }}
          />
          <ExportAction
            icon={<Sheet size={18} />}
            title="Member XLSX"
            description="Styled Excel workbook with auto-width columns and guild data sheets."
            action="Export XLSX"
            onClick={() => {
              void exportMemberXlsx();
            }}
          />
        </div>
      </section>
    </div>
  );
}

function ExportAction({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="export-action">
      <div className="export-action-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button className="secondary-button" onClick={onClick}>
        {action}
      </button>
    </article>
  );
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'wwm-plan';
}
