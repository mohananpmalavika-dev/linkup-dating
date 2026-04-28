/**
 * Sentry Integration for Backend (Express)
 * Error tracking and crash reporting
 * 
 * Usage: Import this in server.js before defining routes
 * const sentryIntegration = require('./config/sentryBackend');
 * sentryIntegration.init(app);
 */

const Sentry = require('@sentry/node');
const { CaptureConsole } = require('@sentry/integrations');

class SentryBackendIntegration {
  /**
   * Initialize Sentry for Express server
   */
  static init(app) {
    if (!process.env.SENTRY_DSN) {
      console.warn('⚠️ SENTRY_DSN not configured. Error tracking disabled.');
      return;
    }

    // Initialize Sentry
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',
      tracesSampleRate: 0.1,
      integrations: [
        new CaptureConsole({
          levels: ['warn', 'error']
        })
      ],
      beforeSend(event, hint) {
        // Ignore 404 errors
        if (event.contexts?.http?.status_code === 404) {
          return null;
        }
        
        // Ignore validation errors
        if (hint.originalException?.name === 'ValidationError') {
          return null;
        }
        
        return event;
      }
    });

    // Attach Sentry middleware (request handler)
    app.use(Sentry.Handlers.requestHandler());

    // Attach Sentry middleware (error handler)
    app.use(Sentry.Handlers.errorHandler());

    console.log('✅ Sentry error tracking initialized');
  }

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
   * Clear user context
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
}

module.exports = SentryBackendIntegration;
