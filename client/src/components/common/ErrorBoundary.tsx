import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { sanitizeErrorMessage } from '../../api/client';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const safeMsg = sanitizeErrorMessage(error?.message, 500);
    return {
      hasError: true,
      errorMessage: safeMsg || 'An unexpected application error occurred.',
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log safely without dumping raw system state to user-visible logs
    const summary = error instanceof Error ? error.message : 'Unknown component error';
    console.error('[ErrorBoundary caught error]', summary, errorInfo.componentStack?.slice(0, 300));
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '400px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
          }}
          role="alert"
        >
          <div
            className="card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '32px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--danger-border)',
              background: '#fff',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <AlertTriangle size={24} />
            </div>

            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--slate-900)',
                marginBottom: '8px',
              }}
            >
              Something went wrong
            </h2>

            <p
              style={{
                fontSize: '13.5px',
                color: 'var(--slate-600)',
                marginBottom: '24px',
                lineHeight: 1.5,
              }}
            >
              {this.state.errorMessage}
            </p>

            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={this.handleReset}
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                Try Again
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleReload}
                style={{ padding: '8px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={13} />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
