import React from 'react';
import { storageService } from '../services/storage/localStorageService';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  private handleDismiss = () => {
    this.setState({ error: null });
  };

  private handleResetAndReload = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm('This will clear all local data (projects, API key, interviews) and reload. Continue?')
    ) {
      return;
    }
    storageService.clearAll();
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-white">
        <div className="max-w-xl w-full bg-slate-800/60 border border-red-700/50 rounded-lg p-6">
          <h1 className="text-xl font-semibold text-red-300 mb-2">Something went wrong.</h1>
          <p className="text-slate-300 mb-4">
            The app hit an unexpected error. You can dismiss this and try again, or reset
            everything if things stay broken.
          </p>
          <details className="mb-4 text-sm text-slate-400">
            <summary className="cursor-pointer select-none">Technical details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words bg-slate-900/60 p-3 rounded border border-white/10 text-xs">
              {this.state.error.name}: {this.state.error.message}
              {this.state.error.stack ? '\n\n' + this.state.error.stack : ''}
            </pre>
          </details>
          <div className="flex gap-3">
            <button
              onClick={this.handleDismiss}
              className="px-4 py-2 rounded bg-cosmic-600 hover:bg-cosmic-500 transition-colors"
            >
              Dismiss & retry
            </button>
            <button
              onClick={this.handleResetAndReload}
              className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 transition-colors"
            >
              Reset & reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
