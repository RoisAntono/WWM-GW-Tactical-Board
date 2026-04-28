import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error?: Error;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('WWM tactical board render failed', error, info);
  }

  render() {
    if (this.state.error) {
      return <FatalErrorPanel message={this.state.error.message} />;
    }

    return this.props.children;
  }
}

export function renderFatalError(error: unknown): void {
  const root = document.getElementById('root');
  if (!root) {
    return;
  }

  const message = error instanceof Error ? error.message : 'Application failed to start.';
  root.innerHTML = `
    <div class="app-fatal">
      <div class="app-fatal-card">
        <p class="eyebrow">Startup Error</p>
        <h1>Unable to load tactical board</h1>
        <p>${escapeHtml(message)}</p>
        <div class="app-fatal-actions">
          <button type="button" data-action="retry">Retry</button>
          <button type="button" data-action="reset">Reset Local Data</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('[data-action="retry"]')?.addEventListener('click', () => window.location.reload());
  root.querySelector('[data-action="reset"]')?.addEventListener('click', resetLocalData);
}

function FatalErrorPanel({ message }: { message: string }) {
  return (
    <main className="app-fatal">
      <section className="app-fatal-card">
        <p className="eyebrow">Render Error</p>
        <h1>Unable to load tactical board</h1>
        <p>{message}</p>
        <div className="app-fatal-actions">
          <button type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
          <button type="button" onClick={resetLocalData}>
            Reset Local Data
          </button>
        </div>
      </section>
    </main>
  );
}

function resetLocalData(): void {
  window.localStorage.removeItem('wwm-tactical-board');
  window.location.reload();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] ?? char;
  });
}
