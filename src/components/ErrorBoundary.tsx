/**
 * ErrorBoundary — Catches React rendering errors with themed fallback UI.
 *
 * Its two sentences are in the interface language (keys boundary.message and
 * boundary.retry, page area "shared"). The area is fetched when the boundary
 * mounts; until it has arrived the English below stands in, so a failure in the
 * very first render still says something.
 */

import { Component, type ReactNode } from 'react';
import { has, loadArea, onLocaleChange, t } from '../i18n';

interface Props {
  children: ReactNode;
  /** Already in the interface language: pass t('…'), not an English sentence. */
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** The boundary's own words: the interface language when it is loaded, English until then. */
export function boundaryText(key: 'boundary.message' | 'boundary.retry'): string {
  if (has(key)) return t(key);
  return key === 'boundary.message' ? 'This part of the page could not be shown.' : 'Try again';
}

export default class ErrorBoundary extends Component<Props, State> {
  private stopListening: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidMount() {
    // Draw again when the words arrive and whenever the language changes.
    this.stopListening = onLocaleChange(() => this.forceUpdate());
    loadArea('shared').then(
      () => this.forceUpdate(),
      (err) => console.error('[ErrorBoundary] could not load its messages', err),
    );
  }

  componentWillUnmount() {
    this.stopListening?.();
    this.stopListening = null;
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
          role="alert"
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
            {this.props.fallbackMessage || boundaryText('boundary.message')}
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
            {boundaryText('boundary.retry')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
