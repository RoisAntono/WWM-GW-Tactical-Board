import { useEffect } from 'react';
import { usePlanStore } from './store';

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const store = usePlanStore.getState();
      const isModified = event.ctrlKey || event.metaKey;

      if (isModified && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          store.redo();
          return;
        }

        store.undo();
        return;
      }

      if (isModified && key === 'y') {
        event.preventDefault();
        store.redo();
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (store.tool === 'draw-route') {
          store.completeRoute();
          return;
        }

        store.clearSelection();
        store.setTool('select');
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const hasSelection = Boolean(
          store.selectedPlayerId || store.selectedRouteId || store.selectedObjectiveId || store.selectedNoteId,
        );

        if (hasSelection) {
          event.preventDefault();
          store.removeSelected();
        }
        return;
      }

      if (store.briefingMode) {
        return;
      }

      if (key === 'v') {
        event.preventDefault();
        store.setTool('select');
        return;
      }

      if (key === 'p') {
        event.preventDefault();
        store.setTool('place-player');
        return;
      }

      if (key === 'r') {
        event.preventDefault();
        store.setTool('draw-route');
        return;
      }

      if (key === 'o') {
        event.preventDefault();
        store.setTool('place-objective');
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        store.setTool('note');
        return;
      }

      if (key === 'e') {
        event.preventDefault();
        store.setTool('remove');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}
