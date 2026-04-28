/**
 * Sentry Configuration for LinkUp
 * Error tracking and crash reporting
 * 
 * Setup: https://sentry.io
 * 1. Create account at https://sentry.io/signup/
 * 2. Create project for React
 * 3. Get DSN from project settings
 * 4. Add DSN to environment variables
 */

module.exports = {
  // Frontend (React) configuration
  frontend: {
    // Get this from Sentry project settings
    dsn: process.env.REACT_APP_SENTRY_DSN || '',
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Release tracking
    release: process.env.REACT_APP_VERSION || '1.0.0',
    
    // Sentry options
    options: {
      // Only report errors in production
      enabled: process.env.NODE_ENV === 'production',
      
      // Capture 10% of transactions for performance monitoring
      tracesSampleRate: 0.1,
      
      // Filter out certain errors
      beforeSend(event, hint) {
        // Ignore network errors (user's connection issue, not our fault)
        if (event.exception) {
          const error = hint.originalException;
          if (error?.message?.includes('Network') || 
              error?.message?.includes('Failed to fetch')) {
            return null;
          }
        }
        return event;
      },
      
      // Session replay for debugging
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Capture console messages
      integrations: [
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
    }
  },

  // Backend (Node.js) configuration
  backend: {
    // Get this from Sentry project settings
    dsn: process.env.SENTRY_DSN || '',
    
    // Environment
    environment: process.env.NODE_ENV || 'development',
    
    // Release tracking
    release: process.env.APP_VERSION || '1.0.0',
    
    // Sentry options
    options: {
      // Capture 10% of transactions for performance monitoring
      tracesSampleRate: 0.1,
      
      // Filter out certain errors
      beforeSend(event, hint) {
        // Ignore 404 errors (not critical)
        if (event.contexts?.http?.status_code === 404) {
          return null;
        }
        
        // Ignore certain error types
        if (event.exception) {
          const error = hint.originalException;
          if (error?.name === 'ValidationError') {
            // These are expected, don't need to be reported
            return null;
          }
        }
        
        return event;
      },
      
      // Request body size limit
      maxBodyLength: 50000,
      
      // Attach stack traces
      attachStacktrace: true,
      
      // Include local variables in stack traces
      includeLocalVariables: true,
    }
  }
};
