import { Activity, Database, ExternalLink, HardDrive, KeyRound, MapPinned, Save, ScanText, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getBoardDiagnostics } from '../../app/boardDiagnostics';
import { getAppDiagnostics } from '../../app/diagnostics';
import { usePlanStore } from '../../app/store';

type SettingsPageProps = {
  notice?: string;
  onOpenMemberData: () => void;
};

export function SettingsPage({ notice, onOpenMemberData }: SettingsPageProps) {
  const { settings, guild, plan, activePhaseId, setGeminiApiKey, clearGeminiApiKey, setSuppressOcrWarning } = usePlanStore();
  const [apiKey, setApiKey] = useState(settings.geminiApiKey);
  const [saved, setSaved] = useState(false);
  const [frameCheck, setFrameCheck] = useState('');
  const diagnostics = getAppDiagnostics(guild);
  const boardDiagnostics = getBoardDiagnostics(plan, activePhaseId);

  useEffect(() => {
    setApiKey(settings.geminiApiKey);
  }, [settings.geminiApiKey]);

  const saveApiKey = () => {
    setGeminiApiKey(apiKey);
    setSaved(true);
  };

  const clearApiKey = () => {
    clearGeminiApiKey();
    setApiKey('');
    setSaved(true);
  };

  return (
    <main className="settings-page">
      <section className="settings-header">
        <div>
          <p className="eyebrow">Local Settings</p>
          <h2>Settings</h2>
        </div>
        <button className="secondary-button" onClick={onOpenMemberData}>
          <UsersRound size={15} />
          Member Data
        </button>
      </section>

      {notice ? <div className="settings-notice">{notice}</div> : null}

      <div className="settings-layout">
        <div className="settings-control-stack">
          <section className="settings-panel">
            <div className="settings-panel-heading">
              <KeyRound size={18} />
              <div>
                <h3>Gemini API Key</h3>
                <p>Used by Match Gemini to read match screenshots with Gemini Vision.</p>
              </div>
            </div>
            <label className="settings-field">
              API Key
              <input
                type="password"
                value={apiKey}
                autoComplete="off"
                placeholder="AIza..."
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <a className="settings-link" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              Get API key from Google AI Studio
            </a>
            <div className="settings-actions">
              <button className="primary-button" onClick={saveApiKey}>
                <Save size={15} />
                Save
              </button>
              <button className="secondary-button" onClick={clearApiKey} disabled={!settings.geminiApiKey && !apiKey}>
                <Trash2 size={15} />
                Clear
              </button>
              <span className={`settings-status ${settings.geminiApiKey ? 'is-saved' : ''}`}>
                {saved ? 'Saved' : settings.geminiApiKey ? 'Key stored' : 'No key saved'}
              </span>
            </div>
            <p className="settings-note">
              The API key is stored only in this browser localStorage. This local app calls Gemini directly, so the key is visible to the browser user.
            </p>
          </section>

          <section className="settings-panel">
            <div className="settings-panel-heading">
              <ScanText size={18} />
              <div>
                <h3>OCR Warning</h3>
                <p>Controls the local OCR accuracy warning before importing match screenshots.</p>
              </div>
            </div>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={settings.suppressOcrWarning}
                onChange={(event) => setSuppressOcrWarning(event.target.checked)}
              />
              Do not show OCR warning before Match OCR
            </label>
          </section>
        </div>

        <section className="settings-panel settings-diagnostics-panel">
          <div className="settings-panel-heading">
            <HardDrive size={18} />
            <div>
              <h3>Workspace Diagnostics</h3>
              <p>Local storage, data counts, and active map asset.</p>
            </div>
          </div>

          <div className="settings-diagnostics-grid" aria-label="Workspace diagnostics">
            <DiagnosticItem label="Persist Version" value={`v${diagnostics.persistVersion}`} detail={diagnostics.storageStatus} />
            <DiagnosticItem label="Local Storage" value={diagnostics.storageSizeLabel} detail={diagnostics.storageKey} />
            <DiagnosticItem
              label="Guild Data"
              value={`${diagnostics.memberCount} members`}
              detail={`${diagnostics.matchCount} matches, ${diagnostics.performanceCount} performances`}
            />
            <DiagnosticItem label="Imports" value={`${diagnostics.importBatchCount} batches`} detail="Batch audit history" />
            <DiagnosticItem label="Map Format" value={diagnostics.mapFormat.toUpperCase()} detail={diagnostics.mapAssetLabel} />
            <DiagnosticItem
              label="Board Objects"
              value={`${boardDiagnostics.estimatedDrawableCount} drawables`}
              detail={`${boardDiagnostics.markerCount} markers, ${boardDiagnostics.routePointCount} route points`}
            />
            <DiagnosticItem
              label="Export Canvas"
              value={formatPixelCount(boardDiagnostics.exportPixelCount)}
              detail="PNG export pixel budget"
            />
          </div>

          <div className="settings-map-asset">
            <MapPinned size={16} />
            <span>Map Asset</span>
            <code title={diagnostics.mapUrl}>{diagnostics.mapUrl}</code>
          </div>

          <p className="settings-note settings-backup-reminder">
            <Database size={14} />
            <span>{diagnostics.backupReminder}</span>
          </p>

          <div className="settings-runtime-check">
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                setFrameCheck('Measuring...');
                const result = await measureFrameLatency();
                setFrameCheck(`Avg ${result.averageMs.toFixed(1)} ms, p95 ${result.p95Ms.toFixed(1)} ms`);
              }}
            >
              <Activity size={15} />
              Run Frame Check
            </button>
            <span>{frameCheck || 'Measures browser frame latency for current workspace.'}</span>
          </div>
        </section>
      </div>
    </main>
  );
}

function DiagnosticItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="settings-diagnostic-item">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function formatPixelCount(value: number): string {
  return `${(value / 1_000_000).toFixed(1)} MP`;
}

async function measureFrameLatency(frameCount = 20): Promise<{ averageMs: number; p95Ms: number }> {
  const samples: number[] = [];
  let lastTime = performance.now();

  for (let index = 0; index < frameCount; index += 1) {
    const nextTime = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
    samples.push(nextTime - lastTime);
    lastTime = nextTime;
  }

  const sorted = [...samples].sort((first, second) => first - second);
  const averageMs = samples.reduce((total, value) => total + value, 0) / Math.max(1, samples.length);
  const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
  return { averageMs, p95Ms };
}
