
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router } from 'react-router-dom';
import App from './App';

type ErrorBoundaryProps = { children: React.ReactNode };
type ErrorBoundaryState = { hasError: boolean; error?: unknown };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Keep this for browser console debugging
    console.error('React render error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const message =
      this.state.error instanceof Error
        ? `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack ?? ''}`
        : `Unexpected error: ${String(this.state.error)}`;

    // Also surface it in the non-React overlay (useful on HF mobile)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const show = (window as any).__showFatalError as undefined | ((m: string) => void);
    show?.(message);

    return (
      <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ marginBottom: 12 }}>
          The app crashed during startup. The details below help identify the cause.
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message}</pre>
      </div>
    );
  }
}

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Could not find root element to mount to');
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <Router>
          <App />
        </Router>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (err) {
  const message = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const show = (window as any).__showFatalError as undefined | ((m: string) => void);
  show?.(message);
  throw err;
}
