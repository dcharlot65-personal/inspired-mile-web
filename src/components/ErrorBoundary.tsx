/**
 * ErrorBoundary — Catches React rendering errors with themed fallback UI.
 */

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            backgroundColor: 'rgba(13, 11, 9, 0.8)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              color: 'rgba(212, 175, 55, 0.7)',
              fontSize: '0.75rem',
              marginBottom: '0.5rem',
            }}
          >
            {this.props.fallbackMessage || 'Something went wrong loading this component.'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '0.5rem',
              color: 'rgba(212, 175, 55, 0.9)',
              fontSize: '0.75rem',
              padding: '0.25rem 0.75rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
