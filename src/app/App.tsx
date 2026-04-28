import { Eye, EyeOff, PanelLeft, PanelRight, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlanStore } from './store';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { openWorkspaceShortShare, readWorkspaceShortShareId } from './workspaceShortShare';
import { decryptWorkspaceShareHash, hasWorkspaceShareHash, type WorkspaceSharePayload } from './workspaceShareLink';
import { BoardCanvas, type BoardCanvasHandle } from '../features/board/BoardCanvas';
import { MemberDataPage } from '../features/guild/MemberDataPage';
import { RosterPanel } from '../features/roster/RosterPanel';
import { SettingsPage } from '../features/settings/SettingsPage';
import { InspectorPanel } from '../features/strategy/InspectorPanel';
import { PhaseTabs } from '../features/strategy/PhaseTabs';
import { TopBar } from '../features/strategy/TopBar';
import { WorkspaceSharePreviewDialog, type WorkspaceSharePreviewState } from '../features/strategy/WorkspaceSharePreviewDialog';
import type { ObjectiveType } from '../types/domain';

type AppView = 'board' | 'members' | 'settings';

export function App() {
  const boardRef = useRef<BoardCanvasHandle>(null);
  const [view, setView] = useState<AppView>('board');
  const [settingsNotice, setSettingsNotice] = useState('');
  const [fullBoard, setFullBoard] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'roster' | 'inspector' | null>(null);
  const [boardFocus, setBoardFocus] = useState(false);
  const [selectedObjectiveType, setSelectedObjectiveType] = useState<ObjectiveType>('red-tower');
  const [sharePreview, setSharePreview] = useState<WorkspaceSharePreviewState>();
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

  const exitFullBoard = useCallback(() => {
    setFullBoard(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const enterFullBoard = useCallback(() => {
    setFullBoard(true);
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement.requestFullscreen().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setFullBoard(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key.toLowerCase() === 'f' && view === 'board') {
        event.preventDefault();
        if (fullBoard) {
          exitFullBoard();
          return;
        }

        enterFullBoard();
        return;
      }

      if (event.key === 'Escape') {
        exitFullBoard();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enterFullBoard, exitFullBoard, fullBoard, view]);

  const changeView = (nextView: AppView, notice = '') => {
    setView(nextView);
    setSettingsNotice(nextView === 'settings' ? notice : '');
    setMobilePanel(null);
    setBoardFocus(false);
    if (nextView !== 'board') {
      exitFullBoard();
    }
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
          fullBoard={fullBoard}
          onFullBoardToggle={fullBoard ? exitFullBoard : enterFullBoard}
        />
      )}
      {view === 'board' ? (
        <>
          {boardFocus ? null : <PhaseTabs />}
          <main className="workspace-grid">
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
            <BoardCanvas
              ref={boardRef}
              selectedObjectiveType={selectedObjectiveType}
              onObjectiveTypeChange={setSelectedObjectiveType}
              hideToolbar={boardFocus}
            />
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
              <button className="mode-toggle board-focus-toggle" onClick={() => setBoardFocus((focused) => !focused)}>
                {boardFocus ? <Eye size={15} /> : <EyeOff size={15} />}
                {boardFocus ? 'Tools' : 'Focus'}
              </button>
              <button className="mode-toggle" onClick={() => setMobilePanel('roster')}>
                <PanelLeft size={15} />
                Squad
              </button>
              <button className="mode-toggle" onClick={() => setMobilePanel('inspector')}>
                <PanelRight size={15} />
                Inspector
              </button>
            </div>
            {mobilePanel ? <button className="mobile-panel-backdrop" aria-label="Close board panel" onClick={() => setMobilePanel(null)} /> : null}
          </main>
        </>
      ) : view === 'members' ? (
        <MemberDataPage
          onOpenSettings={(notice) =>
            changeView('settings', notice ?? 'Save a Gemini API key before using Match Gemini.')
          }
        />
      ) : (
        <SettingsPage notice={settingsNotice} onOpenMemberData={() => changeView('members')} />
      )}
      {view === 'board' && fullBoard ? (
        <div className="full-board-overlay" role="dialog" aria-label="Fullscreen tactical board">
          <button className="icon-button full-board-exit" title="Exit full board (Esc)" aria-label="Exit full board" onClick={exitFullBoard}>
            <X size={18} />
          </button>
          <BoardCanvas
            presentationMode
            selectedObjectiveType={selectedObjectiveType}
            onObjectiveTypeChange={setSelectedObjectiveType}
          />
        </div>
      ) : null}
      {sharePreview ? (
        <WorkspaceSharePreviewDialog state={sharePreview} onSave={saveSharedWorkspace} onClose={closeSharePreview} />
      ) : null}
    </div>
  );
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

function clearWorkspaceShareHash(): void {
  if (hasWorkspaceShareHash(window.location.hash) || readWorkspaceShortShareId(window.location.pathname)) {
    const pathname = readWorkspaceShortShareId(window.location.pathname) ? '/' : window.location.pathname;
    window.history.replaceState(null, '', `${pathname}${window.location.search}`);
  }
}
