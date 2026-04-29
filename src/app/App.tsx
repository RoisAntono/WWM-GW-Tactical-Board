import { Eye, EyeOff, ListChecks, PanelLeft, PanelRight, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { usePlanStore } from './store';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { openWorkspaceShortShare, readWorkspaceShortShareId } from './workspaceShortShare';
import { createWorkspaceSharePayload, decryptWorkspaceShareHash, hasWorkspaceShareHash, type WorkspaceSharePayload } from './workspaceShareLink';
import type { BoardCanvasHandle } from '../features/board/BoardCanvas';
import { RosterPanel } from '../features/roster/RosterPanel';
import { InspectorPanel } from '../features/strategy/InspectorPanel';
import { PhaseTabs } from '../features/strategy/PhaseTabs';
import { TopBar } from '../features/strategy/TopBar';
import type { WorkspaceSharePreviewState } from '../features/strategy/WorkspaceSharePreviewDialog';
import type { ObjectiveType } from '../types/domain';

type AppView = 'board' | 'members' | 'settings';

const BoardCanvas = lazy(() => import('../features/board/BoardCanvas').then((module) => ({ default: module.BoardCanvas })));
const MemberDataPage = lazy(() => import('../features/guild/MemberDataPage').then((module) => ({ default: module.MemberDataPage })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const CloudSavesDialog = lazy(() => import('../features/strategy/CloudSavesDialog').then((module) => ({ default: module.CloudSavesDialog })));
const WorkspaceSharePreviewDialog = lazy(() =>
  import('../features/strategy/WorkspaceSharePreviewDialog').then((module) => ({ default: module.WorkspaceSharePreviewDialog })),
);

export function App() {
  const boardRef = useRef<BoardCanvasHandle>(null);
  const [view, setView] = useState<AppView>('board');
  const [settingsNotice, setSettingsNotice] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'roster' | 'inspector' | null>(null);
  const [boardFocus, setBoardFocus] = useState(false);
  const [phasePanelOpen, setPhasePanelOpen] = useState(false);
  const [selectedObjectiveType, setSelectedObjectiveType] = useState<ObjectiveType>('red-tower');
  const [sharePreview, setSharePreview] = useState<WorkspaceSharePreviewState>();
  const [cloudSavesOpen, setCloudSavesOpen] = useState(false);
  const currentPlan = usePlanStore((state) => state.plan);
  const currentGuild = usePlanStore((state) => state.guild);
  const currentActivePhaseId = usePlanStore((state) => state.activePhaseId);
  const sanitizePlan = usePlanStore((state) => state.sanitizePlan);
  const setWorkspaceSnapshot = usePlanStore((state) => state.setWorkspaceSnapshot);
  useKeyboardShortcuts();

  useEffect(() => {
    sanitizePlan();
  }, [sanitizePlan]);

  useEffect(() => {
    let cancelled = false;

    const openSharedWorkspace = async () => {
      const hasLongShare = hasWorkspaceShareHash(window.location.hash);
      const shortShareId = readWorkspaceShortShareId(window.location.pathname);
      if (!hasLongShare && !shortShareId) {
        setSharePreview(undefined);
        return;
      }

      setSharePreview({ status: 'loading' });
      try {
        const payload = shortShareId
          ? await openWorkspaceShortShare(window.location)
          : await decryptWorkspaceShareHash(window.location.hash);
        if (!cancelled) {
          setSharePreview({ status: 'ready', payload });
          changeView('board');
        }
      } catch (error) {
        if (!cancelled) {
          setSharePreview({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to open shared workspace link.',
          });
        }
      }
    };

    void openSharedWorkspace();
    window.addEventListener('hashchange', openSharedWorkspace);

    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', openSharedWorkspace);
    };
  }, []);

  const changeView = (nextView: AppView, notice = '') => {
    setView(nextView);
    setSettingsNotice(nextView === 'settings' ? notice : '');
    setMobilePanel(null);
    setBoardFocus(false);
    setPhasePanelOpen(false);
  };

  const toggleBoardFocus = () => {
    setBoardFocus((focused) => {
      const nextFocused = !focused;
      if (!nextFocused) {
        setMobilePanel(null);
        setPhasePanelOpen(false);
      }
      return nextFocused;
    });
  };

  const closeSharePreview = () => {
    setSharePreview(undefined);
    clearWorkspaceShareHash();
  };

  const saveSharedWorkspace = (payload: WorkspaceSharePayload) => {
    setWorkspaceSnapshot({
      plan: payload.plan,
      guild: payload.guild,
      activePhaseId: payload.activePhaseId,
    });
    changeView('board');
    closeSharePreview();
  };

  return (
    <div className={`app-shell ${view !== 'board' ? 'is-data-view' : ''} ${boardFocus ? 'is-board-focus' : ''}`}>
      {view === 'board' && boardFocus ? null : (
        <TopBar
          boardRef={boardRef}
          view={view}
          onViewChange={changeView}
          onBoardFocusOpen={toggleBoardFocus}
          onCloudSavesOpen={() => setCloudSavesOpen(true)}
        />
      )}
      {view === 'board' ? (
        <>
          {boardFocus ? null : <PhaseTabs />}
          <main
            className={`workspace-grid ${boardFocus && mobilePanel === 'roster' ? 'has-roster-open' : ''} ${
              boardFocus && mobilePanel === 'inspector' ? 'has-inspector-open' : ''
            }`}
          >
            <div className={`workspace-panel-slot roster-slot ${mobilePanel === 'roster' ? 'is-mobile-open' : ''}`}>
              <button
                className="icon-button mobile-panel-close"
                title="Close squad panel"
                aria-label="Close squad panel"
                onClick={() => setMobilePanel(null)}
              >
                <X size={17} />
              </button>
              <RosterPanel onOpenMemberData={() => changeView('members')} />
            </div>
            <Suspense fallback={<BoardCanvasFallback hideToolbar={boardFocus} />}>
              <BoardCanvas
                ref={boardRef}
                selectedObjectiveType={selectedObjectiveType}
                onObjectiveTypeChange={setSelectedObjectiveType}
                hideToolbar={boardFocus}
              />
            </Suspense>
            <div className={`workspace-panel-slot inspector-slot ${mobilePanel === 'inspector' ? 'is-mobile-open' : ''}`}>
              <button
                className="icon-button mobile-panel-close"
                title="Close inspector panel"
                aria-label="Close inspector panel"
                onClick={() => setMobilePanel(null)}
              >
                <X size={17} />
              </button>
              <InspectorPanel />
            </div>
            <div className="mobile-board-controls" aria-label="Board panels">
              <button className="mode-toggle board-focus-toggle" onClick={toggleBoardFocus}>
                {boardFocus ? <Eye size={15} /> : <EyeOff size={15} />}
                {boardFocus ? 'Exit Focus' : 'Focus'}
              </button>
              {boardFocus ? (
                <button
                  className={`mode-toggle ${phasePanelOpen ? 'is-active' : ''}`}
                  onClick={() => {
                    setPhasePanelOpen((open) => !open);
                    setMobilePanel(null);
                  }}
                >
                  <ListChecks size={15} />
                  Phases
                </button>
              ) : null}
              <button
                className={`mode-toggle ${mobilePanel === 'roster' ? 'is-active' : ''}`}
                onClick={() => {
                  setMobilePanel((panel) => (panel === 'roster' ? null : 'roster'));
                  setPhasePanelOpen(false);
                }}
              >
                <PanelLeft size={15} />
                Squad
              </button>
              <button
                className={`mode-toggle ${mobilePanel === 'inspector' ? 'is-active' : ''}`}
                onClick={() => {
                  setMobilePanel((panel) => (panel === 'inspector' ? null : 'inspector'));
                  setPhasePanelOpen(false);
                }}
              >
                <PanelRight size={15} />
                Inspector
              </button>
            </div>
            {boardFocus && phasePanelOpen ? (
              <div className="focus-phase-panel">
                <button
                  className="icon-button mobile-panel-close"
                  title="Close phases panel"
                  aria-label="Close phases panel"
                  onClick={() => setPhasePanelOpen(false)}
                >
                  <X size={17} />
                </button>
                <PhaseTabs />
              </div>
            ) : null}
            {!boardFocus && mobilePanel ? (
              <button
                className="mobile-panel-backdrop"
                aria-label="Close board panel"
                onClick={() => {
                  setMobilePanel(null);
                  setPhasePanelOpen(false);
                }}
              />
            ) : null}
          </main>
        </>
      ) : view === 'members' ? (
        <Suspense fallback={null}>
          <MemberDataPage
            onOpenSettings={(notice) =>
              changeView('settings', notice ?? 'Save a Gemini API key before using Match Gemini.')
            }
          />
        </Suspense>
      ) : (
        <Suspense fallback={null}>
          <SettingsPage notice={settingsNotice} onOpenMemberData={() => changeView('members')} />
        </Suspense>
      )}
      {sharePreview ? (
        <Suspense fallback={null}>
          <WorkspaceSharePreviewDialog state={sharePreview} onSave={saveSharedWorkspace} onClose={closeSharePreview} />
        </Suspense>
      ) : null}
      {cloudSavesOpen ? (
        <Suspense fallback={null}>
          <CloudSavesDialog
            open
            payload={createWorkspaceSharePayload(currentPlan, currentGuild, currentActivePhaseId)}
            onLoad={saveSharedWorkspace}
            onClose={() => setCloudSavesOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function BoardCanvasFallback({ hideToolbar = false }: { hideToolbar?: boolean }) {
  return (
    <section className="board-shell" aria-busy="true">
      {hideToolbar ? null : <div className="board-toolbar board-toolbar-placeholder" />}
      <div className="board-stage-wrap board-stage-placeholder" data-testid="board-stage" />
    </section>
  );
}

function clearWorkspaceShareHash(): void {
  if (hasWorkspaceShareHash(window.location.hash) || readWorkspaceShortShareId(window.location.pathname)) {
    const pathname = readWorkspaceShortShareId(window.location.pathname) ? '/' : window.location.pathname;
    window.history.replaceState(null, '', `${pathname}${window.location.search}`);
  }
}
