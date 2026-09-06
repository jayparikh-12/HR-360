import { Component, type ErrorInfo, type ReactNode } from 'react';
import { sanitizeErrorMessage } from '../../api/client';
import { ServerErrorPage } from '../../pages/errors/ServerErrorPage';

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

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ServerErrorPage
          onRetry={this.handleReset}
          messageOverride={this.state.errorMessage}
        />
      );
    }

    return this.props.children;
  }
}
