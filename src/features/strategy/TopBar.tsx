import {
  Cloud,
  Database,
  EyeOff,
  FileDown,
  Redo2,
  RotateCcw,
  Settings as SettingsIcon,
  Share2,
  Sword,
  Undo2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, RefObject, useRef, useState } from 'react';
import { createPlanImportReport, createWorkspaceImportReport, type BackupCompatibilityReport } from '../../app/backupCompatibility';
import { usePlanStore } from '../../app/store';
import { createWorkspaceShortShareUrl } from '../../app/workspaceShortShare';
import { buildWorkspaceShareUrl, createWorkspaceShareHash, createWorkspaceSharePayload } from '../../app/workspaceShareLink';
import { parseWorkspaceBackup } from '../../app/workspaceSerialization';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { parsePlanJson } from './planSerialization';
import { ExportDialog } from './ExportDialog';
import { WorkspaceShareDialog } from './WorkspaceShareDialog';
import type { BoardCanvasHandle } from '../board/BoardCanvas';

type TopBarProps = {
  boardRef: RefObject<BoardCanvasHandle | null>;
  view: 'board' | 'members' | 'settings';
  onViewChange: (view: 'board' | 'members' | 'settings') => void;
  onBoardFocusOpen: () => void;
  onCloudSavesOpen: () => void;
};

export function TopBar({ boardRef, view, onViewChange, onBoardFocusOpen, onCloudSavesOpen }: TopBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState('');
  const [importReport, setImportReport] = useState<BackupCompatibilityReport>();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareError, setShareError] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const { plan, guild, activePhaseId, historyPast, historyFuture, undo, redo, setPlan, setWorkspaceBackup, setPlanMeta, resetPlan } =
    usePlanStore();

  const handleImportPlan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      try {
        const backup = parseWorkspaceBackup(content);
        setWorkspaceBackup(backup);
        setImportReport(createWorkspaceImportReport(backup));
      } catch {
        const importedPlan = parsePlanJson(content);
        setPlan(importedPlan);
        setImportReport(createPlanImportReport(importedPlan));
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import plan.');
    } finally {
      event.target.value = '';
    }
  };

  const handleCreateShareLink = async () => {
    setShareDialogOpen(true);
    setShareUrl('');
    setShareError('');
    setShareNotice('');
    setShareLoading(true);

    try {
      const payload = createWorkspaceSharePayload(plan, guild, activePhaseId);
      try {
        setShareUrl(await createWorkspaceShortShareUrl(payload, window.location.href));
        setShareNotice('Short link created. Encrypted snapshot was stored through /api/share.');
      } catch (error) {
        const hash = await createWorkspaceShareHash(payload);
        setShareUrl(buildWorkspaceShareUrl(hash, window.location.href));
        setShareNotice(
          `Short-link API unavailable, using long encrypted URL instead. ${
            error instanceof Error ? error.message : 'Run npm run dev:vercel to test Neon locally.'
          }`,
        );
      }
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Unable to create encrypted share link.');
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <>
      <header className="top-bar">
        <div className="brand-lockup">
          <Sword size={22} />
          <div>
            <p className="eyebrow">Where Winds Meet</p>
            <h1>Guild Wars Tactical Board</h1>
          </div>
        </div>

        <div className="plan-meta">
          <input
            value={plan.title}
            onChange={(event) => setPlanMeta({ title: event.target.value, opponent: plan.opponent ?? '' })}
            aria-label="Plan title"
          />
        </div>

        <div className="top-actions">
          <button className={`mode-toggle ${view === 'board' ? 'is-active' : ''}`} onClick={() => onViewChange('board')}>
            Board
          </button>
          <button className={`mode-toggle ${view === 'members' ? 'is-active' : ''}`} onClick={() => onViewChange('members')}>
            Member Data
          </button>
          <button
            className={`mode-toggle ${view === 'settings' ? 'is-active' : ''}`}
            onClick={() => onViewChange('settings')}
          >
            <SettingsIcon size={14} />
            Settings
          </button>
          <button className="icon-button" title="Undo (Ctrl+Z)" disabled={historyPast.length === 0} onClick={undo}>
            <Undo2 size={16} />
          </button>
          <button className="icon-button" title="Redo (Ctrl+Shift+Z)" disabled={historyFuture.length === 0} onClick={redo}>
            <Redo2 size={16} />
          </button>
          <button className="icon-button" title="Cloud slots" aria-label="Cloud slots" onClick={onCloudSavesOpen}>
            <Cloud size={16} />
          </button>
          <button className="icon-button" title="Share encrypted workspace link" aria-label="Share encrypted workspace link" onClick={handleCreateShareLink}>
            <Share2 size={16} />
          </button>
          <button className="icon-button" title="Focus workspace" aria-label="Focus workspace" disabled={view !== 'board'} onClick={onBoardFocusOpen}>
            <EyeOff size={16} />
          </button>
          <button className="icon-button" title="Import plan JSON" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
          </button>
          <button className="icon-button" title="Export workspace" aria-label="Export workspace" onClick={() => setExportDialogOpen(true)}>
            <Database size={16} />
          </button>
          <button className="icon-button" title="Quick export map PNG" onClick={() => boardRef.current?.exportPng()}>
            <FileDown size={16} />
          </button>
          <button className="icon-button danger" title="Reset local plan" onClick={() => setResetConfirmOpen(true)}>
            <RotateCcw size={16} />
          </button>
          <input ref={fileInputRef} hidden type="file" accept=".json,.wwm-plan.json,application/json" onChange={handleImportPlan} />
        </div>
      </header>
      <ConfirmDialog
        open={Boolean(importError)}
        eyebrow="Import Error"
        title="Unable to import plan"
        message={importError}
        confirmLabel="OK"
        variant="info"
        showCancel={false}
        onConfirm={() => setImportError('')}
      />
      <ConfirmDialog
        open={Boolean(importReport)}
        eyebrow="Import Compatibility"
        title={importReport?.title ?? 'Import complete'}
        message={importReport?.message ?? ''}
        confirmLabel="OK"
        variant="info"
        showCancel={false}
        onConfirm={() => setImportReport(undefined)}
      />
      <WorkspaceShareDialog
        open={shareDialogOpen}
        shareUrl={shareUrl}
        loading={shareLoading}
        error={shareError}
        notice={shareNotice}
        onClose={() => setShareDialogOpen(false)}
      />
      <ExportDialog
        open={exportDialogOpen}
        plan={plan}
        guild={guild}
        activePhaseId={activePhaseId}
        boardRef={boardRef}
        onClose={() => setExportDialogOpen(false)}
      />
      <ConfirmDialog
        open={resetConfirmOpen}
        eyebrow="Reset Local Plan"
        title="Reset all local plan data?"
        message="This will replace the current local plan with a fresh default plan. Export a workspace backup first if you need to keep this work."
        confirmLabel="Reset Plan"
        cancelLabel="Keep Plan"
        variant="danger"
        onConfirm={() => {
          resetPlan();
          setResetConfirmOpen(false);
        }}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </>
  );
}
