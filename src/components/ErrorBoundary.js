import React from "react";

/**
 * Error Boundary component - catches errors in child components
 * and displays a fallback UI instead of crashing the entire app
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error("Error caught by boundary:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Optionally send error to logging service
    if (process.env.NODE_ENV === 'production') {
      // Send to error logging service (e.g., Sentry)
      // logErrorToService(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "20px",
            margin: "20px",
            backgroundColor: "#f8d7da",
            border: "1px solid #f5c6cb",
            borderRadius: "4px",
            color: "#721c24",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <h2 style={{ marginTop: 0 }}>⚠️ Something went wrong</h2>
          <p>We encountered an error while rendering this component. Please try refreshing the page.</p>

          {process.env.NODE_ENV === "development" && this.state.error && (
            <details style={{ marginTop: "15px", cursor: "pointer" }}>
              <summary style={{ fontWeight: "bold", marginBottom: "10px" }}>
                Error details (development only)
              </summary>
              <pre
                style={{
                  backgroundColor: "#fff",
                  padding: "10px",
                  borderRadius: "3px",
                  overflow: "auto",
                  fontSize: "12px",
                  lineHeight: "1.4",
                }}
              >
                {this.state.error.toString()}
                {"\n\n"}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <button
            onClick={this.handleReset}
            style={{
              marginTop: "15px",
              padding: "8px 16px",
              backgroundColor: "#721c24",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
