/**
 * Sentry Integration for Frontend (React)
 * Error tracking and crash reporting
 * 
 * Usage: Import in src/index.js before ReactDOM.render()
 * import { SentryReact } from './config/sentryReact';
 * SentryReact.init();
 */

import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

class SentryReactIntegration {
  /**
   * Initialize Sentry for React
   */
  static init() {
    if (!process.env.REACT_APP_SENTRY_DSN) {
      console.warn('⚠️ REACT_APP_SENTRY_DSN not configured. Error tracking disabled.');
      return;
    }

    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.REACT_APP_VERSION || '1.0.0',
      
      // Performance monitoring
      integrations: [
        new BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Sample rates
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Filter errors
      beforeSend(event, hint) {
        // Ignore network errors
        const error = hint.originalException;
        if (error?.message?.includes('Network') || 
            error?.message?.includes('Failed to fetch')) {
          return null;
        }
        
        // Ignore timeout errors
        if (error?.name === 'TimeoutError') {
          return null;
        }
        
        return event;
      }
    });

    console.log('✅ Sentry error tracking initialized (React)');
  }

  /**
   * Error Boundary component for React
   * Wrap your app with this:
   * <ErrorBoundary>
   *   <App />
   * </ErrorBoundary>
   */
  static ErrorBoundary = Sentry.ErrorBoundary;

  /**
   * Capture custom error
   */
  static captureError(error, context = {}) {
    Sentry.captureException(error, { tags: context });
  }

  /**
   * Capture message
   */
  static captureMessage(message, level = 'info') {
    Sentry.captureMessage(message, level);
  }

  /**
   * Set user context
   */
  static setUserContext(userId, userEmail = '', userName = '') {
    Sentry.setUser({
      id: userId,
      email: userEmail,
      username: userName
    });
  }

  /**
   * Clear user context (on logout)
   */
  static clearUserContext() {
    Sentry.setUser(null);
  }

  /**
   * Add breadcrumb for debugging
   */
  static addBreadcrumb(message, category = 'debug', level = 'info') {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      timestamp: Date.now() / 1000
    });
  }

  /**
   * Add custom tag
   */
  static addTag(key, value) {
    Sentry.setTag(key, value);
  }

  /**
   * Higher-order component to wrap React components
   */
  static withProfiler(component) {
    return Sentry.withProfiler(component);
  }
}

export default SentryReactIntegration;
