import { ChangeEvent, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { createWorkspaceImportReport, type BackupCompatibilityReport } from '../../app/backupCompatibility';
import {
  selectMemberCsvRows,
  selectMemberStats,
} from '../../app/data/selectors';
import { countImportWarnings, getValidImportRows, validateImportRows } from '../../app/data/importValidation';
import { combineMatchDateTime } from '../../app/data/matchTime';
import { usePlanStore } from '../../app/store';
import { isWorkspaceBackup } from '../../app/workspaceSerialization';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { downloadBlob, downloadTextFile } from '../../shared/download';
import { createId } from '../../shared/id';
import type { GuildDatabase, GuildMember, ImportRow, ImportSource, MemberRank, MemberRole, MemberStatus } from '../../types/domain';
import { MemberDataDashboard } from './MemberDataDashboard';
import { MemberDataHeader } from './MemberDataHeader';
import { MemberDataTable } from './MemberDataTable';
import { MemberDataToolbar } from './MemberDataToolbar';
import {
  attachImportRowSource,
  buildImportFileAudit,
  buildScreenshotImportFiles,
  clampProgress,
  detectMatchTime,
  detectMatchTimeFromSessionFiles,
  fillRowsMatchTime,
  formatMatchTarget,
  formatScreenshotBatchName,
  mergeSessionFileRows,
  prepareImportRows,
  safeName,
  screenshotFileKey,
  updateSessionFile,
} from './memberDataImportUtils';
import { compareMemberStats, type SortKey } from './memberDataSorting';
import { ImportAuditMeta } from './ImportAuditMeta';
import { MatchScreenshotImportSession, type MatchScreenshotSessionFile } from '../roster/MatchScreenshotImportSession';
import { ImportReviewTable } from '../roster/ImportReviewTable';
import { parseRosterCsv } from '../roster/csvImport';
import { createRosterWorkbookBlob } from '../roster/xlsxExport';
import { geminiModel, recognizeRosterScreenshotWithGeminiMeta } from '../roster/geminiImport';
import { recognizeRosterScreenshotWithMeta, type OcrProgress } from '../roster/ocrImport';

type ImportContext = {
  kind: 'member' | 'match';
  source: ImportSource;
  fileName?: string;
  rowCount: number;
  model?: string;
  detectedMatchTime?: string;
  duplicateCount?: number;
  files?: GuildDatabase['importBatches'][number]['files'];
};
type ScreenshotImportSource = Extract<ImportSource, 'ocr' | 'gemini'>;
type ScreenshotImportSession = {
  source: ScreenshotImportSource;
  files: MatchScreenshotSessionFile[];
  processing: boolean;
  progress?: OcrProgress;
  rows: ImportRow[];
  duplicateCount: number;
};

type MemberDataPageProps = {
  onOpenSettings: (notice?: string) => void;
};

export function MemberDataPage({ onOpenSettings }: MemberDataPageProps) {
  const memberCsvInputRef = useRef<HTMLInputElement>(null);
  const matchCsvInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const geminiImageInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  const [filter, setFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<MemberRole | 'All'>('All');
  const [rankFilter, setRankFilter] = useState<MemberRank | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'All'>('All');
  const [sortKey, setSortKey] = useState<SortKey>('activity');
  const [newIgn, setNewIgn] = useState('');
  const [matchDate, setMatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [matchTime, setMatchTime] = useState('');
  const [matchOpponent, setMatchOpponent] = useState('');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importContext, setImportContext] = useState<ImportContext | null>(null);
  const [importError, setImportError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<GuildMember>();
  const [screenshotSession, setScreenshotSession] = useState<ScreenshotImportSession | null>(null);
  const [showOcrWarning, setShowOcrWarning] = useState(false);
  const [suppressOcrWarningDraft, setSuppressOcrWarningDraft] = useState(false);
  const [backupReport, setBackupReport] = useState<BackupCompatibilityReport>();
  const [xlsxExporting, setXlsxExporting] = useState(false);

  const {
    plan,
    guild,
    settings,
    addGuildMember,
    updateGuildMember,
    removeGuildMember,
    applyMemberImportRows,
    applyMatchImportRows,
    setGuildDatabase,
    setWorkspaceBackup,
    setSuppressOcrWarning,
  } = usePlanStore();

  const stats = useMemo(() => selectMemberStats(guild), [guild]);
  const latestMatchDate = useMemo(
    () => stats.map((item) => item.lastPlayed).filter((date): date is string => Boolean(date)).sort((a, b) => b.localeCompare(a))[0],
    [stats],
  );
  const tableRows = useMemo(
    () =>
      stats
        .filter((item) => {
          const member = item.member;
          const text = filter.toLowerCase();
          const matchesText =
            member.ign.toLowerCase().includes(text) ||
            member.alias?.toLowerCase().includes(text) ||
            member.teamId?.toLowerCase().includes(text);
          const matchesRole = roleFilter === 'All' || member.memberRole === roleFilter;
          const matchesRank = rankFilter === 'All' || member.rank === rankFilter;
          const matchesStatus = statusFilter === 'All' || member.status === statusFilter;
          return matchesText && matchesRole && matchesRank && matchesStatus;
        })
        .sort((a, b) => compareMemberStats(a, b, sortKey)),
    [filter, rankFilter, roleFilter, sortKey, stats, statusFilter],
  );

  const activeLatest = latestMatchDate ? stats.filter((item) => item.lastPlayed === latestMatchDate).length : 0;

  const readCsv = async (event: ChangeEvent<HTMLInputElement>, kind: ImportContext['kind']) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setImportError('');
      setImportRows([]);
      setImportContext(null);
      setScreenshotSession(null);
      const parsedRows = parseRosterCsv(await file.text());
      const fileId = createId('import-file');
      const sourcedRows = attachImportRowSource(parsedRows, fileId, file.name);
      const rows = prepareImportRows(sourcedRows, kind);
      const detectedMatchTime = kind === 'match' ? detectMatchTime(rows) : undefined;
      const auditFile = buildImportFileAudit({
        id: fileId,
        source: 'csv',
        fileName: file.name,
        rows: sourcedRows,
        kind,
        rowCount: parsedRows.length,
        detectedMatchTime: detectedMatchTime?.display,
      });
      if (kind === 'match') {
        if (detectedMatchTime) {
          setMatchDate(detectedMatchTime.date);
          setMatchTime(detectedMatchTime.time ?? '');
        }
      }
      setImportContext({
        kind,
        source: 'csv',
        fileName: file.name,
        rowCount: parsedRows.length,
        detectedMatchTime: detectedMatchTime?.display,
        files: [auditFile],
      });
      setImportRows(kind === 'match' ? fillRowsMatchTime(rows, detectedMatchTime?.display) : rows);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'CSV import failed.');
    } finally {
      event.target.value = '';
    }
  };

  const readScreenshotFiles = (event: ChangeEvent<HTMLInputElement>) => {
    appendScreenshotFiles('ocr', Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const readGeminiScreenshotFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const apiKey = settings.geminiApiKey.trim();
    if (!apiKey) {
      event.target.value = '';
      onOpenSettings('Save a Gemini API key before using Match Gemini.');
      return;
    }

    appendScreenshotFiles('gemini', Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const appendScreenshotFiles = (source: ScreenshotImportSource, files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith('image/') || file.type === '');
    if (imageFiles.length === 0) {
      return;
    }

    setImportError('');
    setImportRows([]);
    setImportContext(null);
    setMatchTime('');
    setScreenshotSession((current) => {
      const currentFiles = current?.source === source ? current.files : [];
      const existingKeys = new Set(currentFiles.map((file) => screenshotFileKey(file.file)));
      const nextFiles = [
        ...currentFiles,
        ...imageFiles
          .filter((file) => !existingKeys.has(screenshotFileKey(file)))
          .map<MatchScreenshotSessionFile>((file) => ({
            id: createId('screenshot'),
            file,
            name: file.name,
            size: file.size,
            status: 'queued',
          })),
      ];
      const merged = mergeSessionFileRows(nextFiles);

      return {
        source,
        files: nextFiles,
        processing: false,
        rows: merged.rows,
        duplicateCount: merged.duplicateCount,
      };
    });
  };

  const removeScreenshotFile = (fileId: string) => {
    setScreenshotSession((current) => {
      if (!current || current.processing) {
        return current;
      }

      const files = current.files.filter((file) => file.id !== fileId);
      if (files.length === 0) {
        return null;
      }

      const merged = mergeSessionFileRows(files);
      return {
        ...current,
        files,
        rows: merged.rows,
        duplicateCount: merged.duplicateCount,
        progress: undefined,
      };
    });
  };

  const clearScreenshotSession = () => {
    setScreenshotSession((current) =>
      current
        ? {
            ...current,
            files: [],
            rows: [],
            duplicateCount: 0,
            progress: undefined,
          }
        : current,
    );
  };

  const processScreenshotSession = async () => {
    const session = screenshotSession;
    if (!session || session.processing || session.files.length === 0) {
      return;
    }

    const apiKey = settings.geminiApiKey.trim();
    if (session.source === 'gemini' && !apiKey) {
      onOpenSettings('Save a Gemini API key before using Match Gemini.');
      return;
    }

    const totalFiles = session.files.length;
    let nextFiles = session.files.map((file) =>
      file.status === 'done' && file.rows
        ? file
        : {
            ...file,
            status: 'queued' as const,
            rowCount: undefined,
            acceptedCount: undefined,
            warningCount: undefined,
            rows: undefined,
            matchTime: undefined,
            timestampOnly: undefined,
            confidenceAvg: undefined,
            error: undefined,
          },
    );

    setImportError('');
    setScreenshotSession((current) =>
      current
        ? {
            ...current,
            processing: true,
            progress: { status: 'Starting screenshot batch', progress: 0 },
            files: nextFiles,
            rows: [],
            duplicateCount: 0,
          }
        : current,
    );

    for (let index = 0; index < nextFiles.length; index += 1) {
      const item = nextFiles[index];
      if (item.status === 'done' && item.rows) {
        continue;
      }

      nextFiles = updateSessionFile(nextFiles, item.id, {
        status: 'processing',
        error: undefined,
      });
      setScreenshotSession((current) =>
        current
          ? {
              ...current,
              files: nextFiles,
              progress: {
                status: `${item.name}: processing`,
                progress: index / totalFiles,
              },
            }
          : current,
      );

      try {
        const importResult =
          session.source === 'gemini'
            ? await recognizeRosterScreenshotWithGeminiMeta(item.file, apiKey, (progress) => {
                setScreenshotSession((current) =>
                  current
                    ? {
                        ...current,
                        progress: {
                          status: `${item.name}: ${progress.status}`,
                          progress: (index + clampProgress(progress.progress)) / totalFiles,
                        },
                      }
                    : current,
                );
              })
            : await recognizeRosterScreenshotWithMeta(item.file, (progress) => {
                setScreenshotSession((current) =>
                  current
                    ? {
                        ...current,
                        progress: {
                          status: `${item.name}: ${progress.status}`,
                          progress: (index + clampProgress(progress.progress)) / totalFiles,
                        },
                      }
                    : current,
                );
              });
        const parsedRows = importResult.rows;
        const sourcedRows = attachImportRowSource(parsedRows, item.id, item.name);
        const rows = validateImportRows(sourcedRows, 'match');
        const detectedMatchTime = importResult.matchTime ?? detectMatchTime(rows)?.display;
        const auditFile = buildImportFileAudit({
          id: item.id,
          source: session.source,
          fileName: item.name,
          rows,
          kind: 'match',
          rowCount: parsedRows.length,
          detectedMatchTime,
        });
        nextFiles = updateSessionFile(nextFiles, item.id, {
          status: 'done',
          rowCount: parsedRows.length,
          acceptedCount: auditFile.acceptedCount,
          warningCount: auditFile.warningCount,
          rows,
          matchTime: auditFile.detectedMatchTime,
          timestampOnly: auditFile.timestampOnly,
          confidenceAvg: auditFile.confidenceAvg,
          error: undefined,
        });
      } catch (error) {
        const auditFile = buildImportFileAudit({
          id: item.id,
          source: session.source,
          fileName: item.name,
          rows: [],
          kind: 'match',
          rowCount: 0,
          error: error instanceof Error ? error.message : 'Screenshot import failed.',
        });
        nextFiles = updateSessionFile(nextFiles, item.id, {
          status: 'error',
          rowCount: auditFile.rowCount,
          acceptedCount: auditFile.acceptedCount,
          warningCount: auditFile.warningCount,
          rows: [],
          matchTime: undefined,
          timestampOnly: auditFile.timestampOnly,
          confidenceAvg: auditFile.confidenceAvg,
          error: auditFile.error,
        });
      }

      const merged = mergeSessionFileRows(nextFiles);
      setScreenshotSession((current) =>
        current
          ? {
              ...current,
              files: nextFiles,
              rows: merged.rows,
              duplicateCount: merged.duplicateCount,
            }
          : current,
      );
    }

    const merged = mergeSessionFileRows(nextFiles);
    if (getValidImportRows(merged.rows, 'match').length === 0) {
      setImportError('No valid screenshot rows found. Add more screenshots or use clearer images before reviewing.');
    }

    setScreenshotSession((current) =>
      current
        ? {
            ...current,
            processing: false,
            progress: undefined,
            files: nextFiles,
            rows: merged.rows,
            duplicateCount: merged.duplicateCount,
          }
        : current,
    );
  };

  const reviewScreenshotSession = () => {
    const session = screenshotSession;
    if (!session) {
      return;
    }

    try {
      const rows = prepareImportRows(session.rows, 'match');
      const detectedMatchTime = detectMatchTimeFromSessionFiles(session.files) ?? detectMatchTime(rows);
      const rowsWithMatchTime = fillRowsMatchTime(rows, detectedMatchTime?.display);
      if (detectedMatchTime) {
        setMatchDate(detectedMatchTime.date);
        setMatchTime(detectedMatchTime.time ?? '');
      }
      setImportError('');
      setImportContext({
        kind: 'match',
        source: session.source,
        fileName: formatScreenshotBatchName(session.files),
        rowCount: session.files.reduce((total, file) => total + (file.rowCount ?? 0), 0),
        model: session.source === 'gemini' ? geminiModel : undefined,
        detectedMatchTime: detectedMatchTime?.display,
        duplicateCount: session.duplicateCount,
        files: buildScreenshotImportFiles(session.files, session.source),
      });
      setImportRows(rowsWithMatchTime);
      setScreenshotSession(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'No valid screenshot rows found.');
    }
  };

  const importBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setImportError('');
      setImportRows([]);
      setImportContext(null);
      setScreenshotSession(null);
      const parsed = JSON.parse(await file.text()) as GuildDatabase | { guild?: GuildDatabase };
      if (isWorkspaceBackup(parsed)) {
        setWorkspaceBackup(parsed);
      } else {
        setGuildDatabase(('guild' in parsed && parsed.guild ? parsed.guild : parsed) as GuildDatabase);
      }
      setBackupReport(createWorkspaceImportReport(parsed));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Backup import failed.');
    } finally {
      event.target.value = '';
    }
  };

  const applyReviewedImport = (mode: 'append' | 'replace') => {
    if (!importContext) {
      return;
    }

    const validatedRows = validateImportRows(importRows, importContext.kind);
    const validRows = getValidImportRows(validatedRows, importContext.kind);
    if (validRows.length === 0) {
      setImportRows(validatedRows);
      setImportError('No valid import rows found. Add at least one IGN and match stat before saving.');
      return;
    }
    const warningCount = countImportWarnings(validatedRows);

    if (importContext.kind === 'member') {
      applyMemberImportRows(validRows, mode, {
        source: importContext.source,
        fileName: importContext.fileName,
        rowCount: importContext.rowCount,
        acceptedCount: validRows.length,
        warningCount,
        model: importContext.model,
        detectedMatchTime: importContext.detectedMatchTime,
        files: importContext.files,
      });
    } else {
      const detectedMatchTime = detectMatchTime(importRows);
      const savedMatchTime = detectedMatchTime?.display || importContext.detectedMatchTime;
      applyMatchImportRows(validRows, {
        date: savedMatchTime || combineMatchDateTime(matchDate, matchTime) || new Date().toISOString().slice(0, 10),
        opponent: matchOpponent.trim() || 'Unknown Opponent',
        source: importContext.source,
        fileName: importContext.fileName,
        rowCount: importContext.rowCount,
        acceptedCount: validRows.length,
        warningCount,
        model: importContext.model,
        detectedMatchTime: savedMatchTime,
        files: importContext.files,
      });
    }

    setImportRows([]);
    setImportContext(null);
  };

  const addMember = () => {
    addGuildMember(newIgn);
    setNewIgn('');
  };

  const openOcrImport = () => {
    if (settings.suppressOcrWarning) {
      imageInputRef.current?.click();
      return;
    }

    setSuppressOcrWarningDraft(false);
    setShowOcrWarning(true);
  };

  const openGeminiImport = () => {
    if (!settings.geminiApiKey.trim()) {
      onOpenSettings('Save a Gemini API key before using Match Gemini.');
      return;
    }

    geminiImageInputRef.current?.click();
  };

  const exportXlsx = async () => {
    setXlsxExporting(true);
    setImportError('');
    try {
      const blob = await createRosterWorkbookBlob(plan, guild);
      downloadBlob(`${safeName(plan.title)}-guild-data.xlsx`, blob);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to export guild data XLSX.');
    } finally {
      setXlsxExporting(false);
    }
  };

  const imageImportProgress = screenshotSession?.progress;
  const reviewMatchTime = importContext?.kind === 'match' ? detectMatchTime(importRows) : undefined;
  const reviewValidatedRows = useMemo(
    () => (importContext ? validateImportRows(importRows, importContext.kind) : []),
    [importContext, importRows],
  );
  const reviewAcceptedCount = importContext ? getValidImportRows(reviewValidatedRows, importContext.kind).length : 0;
  const reviewWarningCount = countImportWarnings(reviewValidatedRows);
  const reviewDetectedMatchTime = reviewMatchTime?.display ?? importContext?.detectedMatchTime;
  const reviewAuditContent =
    importContext && shouldShowReviewAudit(importContext, reviewAcceptedCount, reviewWarningCount) ? (
      <ImportAuditMeta
        source={importContext.source}
        model={importContext.model}
        files={importContext.files}
        rowCount={importContext.rowCount}
        acceptedCount={reviewAcceptedCount}
        warningCount={reviewWarningCount}
        duplicateCount={importContext.duplicateCount}
        detectedMatchTime={reviewDetectedMatchTime}
      />
    ) : undefined;

  return (
    <main className="member-data-page">
      <MemberDataHeader
        onMemberCsv={() => memberCsvInputRef.current?.click()}
        onMatchCsv={() => matchCsvInputRef.current?.click()}
        onOcrImport={openOcrImport}
        onGeminiImport={openGeminiImport}
        onExportCsv={() => downloadTextFile(`${safeName(plan.title)}-members.csv`, Papa.unparse(selectMemberCsvRows(tableRows)), 'text/csv')}
        onExportXlsx={exportXlsx}
        onExportBackup={() => downloadTextFile(`${safeName(plan.title)}-guild-backup.json`, JSON.stringify({ version: 1, guild }, null, 2), 'application/json')}
        onRestoreBackup={() => backupInputRef.current?.click()}
        xlsxExporting={xlsxExporting}
      />

      <MemberDataDashboard guild={guild} stats={stats} activeLatest={activeLatest} />

      <MemberDataToolbar
        filter={filter}
        onFilterChange={setFilter}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        rankFilter={rankFilter}
        onRankFilterChange={setRankFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortKey={sortKey}
        onSortKeyChange={setSortKey}
        newIgn={newIgn}
        onNewIgnChange={setNewIgn}
        onAddMember={addMember}
        matchDate={matchDate}
        matchTime={matchTime}
        onMatchDateChange={setMatchDate}
        onMatchTimeChange={setMatchTime}
        matchOpponent={matchOpponent}
        onMatchOpponentChange={setMatchOpponent}
      />

      {imageImportProgress ? (
        <div className="status-line">
          {imageImportProgress.status} {Math.round(imageImportProgress.progress * 100)}%
        </div>
      ) : null}
      {importError ? <div className="error-line">{importError}</div> : null}

      <MemberDataTable rows={tableRows} updateGuildMember={updateGuildMember} onDeleteRequest={setDeleteTarget} />

      <input
        ref={memberCsvInputRef}
        data-testid="member-csv-input"
        hidden
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => readCsv(event, 'member')}
      />
      <input
        ref={matchCsvInputRef}
        data-testid="match-csv-input"
        hidden
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => readCsv(event, 'match')}
      />
      <input ref={imageInputRef} data-testid="ocr-image-input" hidden multiple type="file" accept="image/*" onChange={readScreenshotFiles} />
      <input
        ref={geminiImageInputRef}
        data-testid="gemini-image-input"
        hidden
        multiple
        type="file"
        accept="image/*"
        onChange={readGeminiScreenshotFiles}
      />
      <input ref={backupInputRef} data-testid="backup-input" hidden type="file" accept=".json,application/json" onChange={importBackup} />

      <MatchScreenshotImportSession
        open={Boolean(screenshotSession)}
        source={screenshotSession?.source ?? 'ocr'}
        files={screenshotSession?.files ?? []}
        processing={Boolean(screenshotSession?.processing)}
        progress={screenshotSession?.progress}
        combinedRows={screenshotSession?.rows ?? []}
        duplicateCount={screenshotSession?.duplicateCount ?? 0}
        onAddFiles={() => (screenshotSession?.source === 'gemini' ? geminiImageInputRef.current?.click() : imageInputRef.current?.click())}
        onRemoveFile={removeScreenshotFile}
        onClear={clearScreenshotSession}
        onProcess={processScreenshotSession}
        onReview={reviewScreenshotSession}
        onCancel={() => setScreenshotSession(null)}
      />

      <ImportReviewTable
        rows={importRows}
        mode={importContext?.kind ?? 'member'}
        onRowsChange={setImportRows}
        onClear={() => {
          setImportRows([]);
          setImportContext(null);
        }}
        onApply={applyReviewedImport}
        description={
          importContext?.kind === 'match'
            ? `Review scoreboard rows before saving match history. Saving as ${formatMatchTarget(reviewMatchTime?.date ?? matchDate, reviewMatchTime?.time ?? matchTime, matchOpponent)}. Unknown IGN will become Pending Review members.`
            : 'Review member rows before updating the guild member database.'
        }
        metaContent={reviewAuditContent}
        primaryLabel={importContext?.kind === 'match' ? 'Save Match' : 'Apply Members'}
        secondaryLabel="Replace Members"
        showSecondary={importContext?.kind !== 'match'}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        eyebrow="Delete Member"
        title={deleteTarget ? `Delete ${deleteTarget.ign}?` : 'Delete member?'}
        message="This removes the member from the guild database and unlinks related plan dots, route assignments, and performance rows."
        confirmLabel="Delete Member"
        cancelLabel="Keep Member"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) {
            removeGuildMember(deleteTarget.id);
          }
          setDeleteTarget(undefined);
        }}
        onCancel={() => setDeleteTarget(undefined)}
      />
      <ConfirmDialog
        open={showOcrWarning}
        eyebrow="OCR Warning"
        title="Review OCR results carefully"
        message="Local OCR can misread IGN names and match numbers. Review every imported row before saving match history."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        variant="info"
        checkboxLabel="Do not warn me again"
        checkboxChecked={suppressOcrWarningDraft}
        onCheckboxChange={setSuppressOcrWarningDraft}
        onConfirm={() => {
          if (suppressOcrWarningDraft) {
            setSuppressOcrWarning(true);
          }
          setShowOcrWarning(false);
          imageInputRef.current?.click();
        }}
        onCancel={() => {
          setShowOcrWarning(false);
          setSuppressOcrWarningDraft(false);
        }}
      />
      <ConfirmDialog
        open={Boolean(backupReport)}
        eyebrow="Backup Compatibility"
        title={backupReport?.title ?? 'Backup restored'}
        message={backupReport?.message ?? ''}
        confirmLabel="OK"
        variant="info"
        showCancel={false}
        onConfirm={() => setBackupReport(undefined)}
      />
    </main>
  );
}

function shouldShowReviewAudit(context: ImportContext, acceptedCount: number, warningCount: number): boolean {
  const files = context.files ?? [];
  const hasFileException = files.some((file) => file.error || file.timestampOnly || file.warningCount > 0);

  return (
    context.source !== 'csv' ||
    Boolean(context.model) ||
    Boolean(context.duplicateCount) ||
    warningCount > 0 ||
    acceptedCount !== context.rowCount ||
    files.length > 1 ||
    hasFileException
  );
}
