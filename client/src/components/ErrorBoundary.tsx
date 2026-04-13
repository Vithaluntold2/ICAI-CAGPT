import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Finance Chat Error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Log to console for debugging in production
    if (typeof window !== 'undefined') {
      (window as any).__LAST_REACT_ERROR__ = { error, errorInfo };
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Get a simplified error message for display
      const errorMessage = this.state.error?.message || 'Unknown error';
      const errorName = this.state.error?.name || 'Error';

      return (
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Something went wrong</h2>
            <p className="text-red-600 mb-4">
              We're having trouble with the chat interface. Please refresh the page to continue.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Refresh Page
            </button>
            {/* Always show error summary */}
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-red-700 font-medium">Error Details</summary>
              <p className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded">
                {errorName}: {errorMessage}
              </p>
              {this.state.error?.stack && (
                <pre className="mt-2 text-xs text-red-600 overflow-auto bg-red-100 p-2 rounded max-h-48">
                  {this.state.error.stack}
                </pre>
              )}
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}