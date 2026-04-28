# Sentry Crash Reporting Setup Guide

## Overview

Sentry provides real-time error tracking and crash reporting for both frontend (React) and backend (Node.js). This guide covers setup, integration, and best practices.

---

## Quick Start

### 1. Create Sentry Account

1. Go to https://sentry.io/signup/
2. Sign up with your email or GitHub account
3. Create a new organization
4. Create two projects:
   - **Project 1**: React (Frontend)
   - **Project 2**: Node.js (Backend)

### 2. Get Your DSN Keys

**Frontend (React)**:
1. Go to Project Settings → Client Keys (DSN)
2. Copy the DSN starting with `https://`
3. Add to `.env.local`:
   ```
   REACT_APP_SENTRY_DSN=https://xxxxxxxxx@o1234567.ingest.sentry.io/1234567
   REACT_APP_VERSION=1.0.0
   ```

**Backend (Node.js)**:
1. Go to Project Settings → Client Keys (DSN)
2. Copy the DSN starting with `https://`
3. Add to `.env`:
   ```
   SENTRY_DSN=https://xxxxxxxxx@o1234567.ingest.sentry.io/2345678
   APP_VERSION=1.0.0
   ```

---

## Installation

### Frontend (React)

```bash
npm install @sentry/react @sentry/tracing
```

### Backend (Node.js)

```bash
npm install @sentry/node @sentry/integrations
```

---

## Integration

### Frontend Integration

**Step 1**: Update `src/index.js`

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import SentryReact from './config/sentryReact';

// Initialize Sentry BEFORE rendering app
SentryReact.init();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Wrap app with Error Boundary */}
    <SentryReact.ErrorBoundary fallback={<div>Something went wrong</div>}>
      <App />
    </SentryReact.ErrorBoundary>
  </React.StrictMode>
);
```

**Step 2**: Update `src/App.js` to track user

```javascript
import { useEffect } from 'react';
import SentryReact from './config/sentryReact';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Set user context when logged in
      SentryReact.setUserContext(user.id, user.email, user.username);
    } else {
      // Clear user context when logged out
      SentryReact.clearUserContext();
    }
  }, [user]);

  return (
    // Your app components
  );
}

export default App;
```

**Step 3**: Add Error Boundary to critical pages

```javascript
import SentryReact from '../config/sentryReact';

const PaymentPage = () => {
  return (
    <SentryReact.ErrorBoundary
      fallback={<div>Payment page error. Please try again.</div>}
      showDialog
    >
      {/* Your payment components */}
    </SentryReact.ErrorBoundary>
  );
};
```

### Backend Integration

**Step 1**: Update `backend/server.js`

```javascript
const express = require('express');
const SentryBackend = require('./config/sentryBackend');

const app = express();

// Initialize Sentry BEFORE defining routes
SentryBackend.init(app);

// ... rest of your middleware and routes

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Step 2**: Track errors in routes

```javascript
const SentryBackend = require('../config/sentryBackend');

router.post('/payments/verify', async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    // Add breadcrumb for debugging
    SentryBackend.addBreadcrumb(
      `Verifying payment: ${orderId}`,
      'payment',
      'info'
    );

    // Your verification logic...
    const result = await verifySignature(orderId, paymentId, signature);

    res.json(result);
  } catch (error) {
    // Capture error with context
    SentryBackend.captureError(error, {
      endpoint: '/payments/verify',
      userId: req.user?.id
    });

    res.status(500).json({ error: 'Payment verification failed' });
  }
});
```

**Step 3**: Set user context on login

```javascript
const SentryBackend = require('../config/sentryBackend');

router.post('/auth/login', async (req, res) => {
  // ... authentication logic

  const user = { id: userId, email: userEmail, username: userName };

  // Set user context in Sentry
  SentryBackend.setUserContext(userId, userEmail, userName);

  // ... return token
});
```

---

## Usage Examples

### Capturing Errors

```javascript
// React
import SentryReact from './config/sentryReact';

try {
  // Your code
} catch (error) {
  SentryReact.captureError(error, {
    feature: 'messaging',
    severity: 'high'
  });
}

// Node.js
const SentryBackend = require('./config/sentryBackend');

try {
  // Your code
} catch (error) {
  SentryBackend.captureError(error, {
    endpoint: '/api/messages',
    userId: req.user.id
  });
}
```

### Adding Breadcrumbs (for debugging)

```javascript
// Frontend
SentryReact.addBreadcrumb('User clicked subscribe button', 'user-interaction');

// Backend
SentryBackend.addBreadcrumb('Payment verified successfully', 'payment', 'info');
```

### Adding Tags

```javascript
// Frontend
SentryReact.addTag('user_plan', 'premium');
SentryReact.addTag('app_version', '1.0.0');

// Backend
SentryBackend.addTag('database', 'postgres');
SentryBackend.addTag('api_version', 'v1');
```

### Capturing Messages

```javascript
// Frontend - Low level message (debug)
SentryReact.captureMessage('Payment flow started', 'debug');

// Frontend - Warning level
SentryReact.captureMessage('Profile image upload slow', 'warning');

// Backend
SentryBackend.captureMessage('Database connection pool exhausted', 'warning');
```

---

## Sentry Dashboard

### 1. Issue Tracking

Visit: https://sentry.io/organizations/your-org/issues/

**View Issues**:
- See all reported errors
- Stack traces with source maps
- Affected users count
- Error frequency

### 2. Alerts

**Create Alert**: https://sentry.io/settings/your-org/alerts/

Example: "Alert when error rate > 1% in production"

```
When: An issue is first seen
AND: The error occurs in production
THEN: Send Slack notification
```

### 3. Performance Monitoring

Visit: https://sentry.io/organizations/your-org/performance/

**Track**:
- Slow API endpoints (>1s)
- Database queries (>100ms)
- Frontend render performance
- React component performance

### 4. Releases

Visit: https://sentry.io/settings/your-org/projects/your-project/releases/

**Deploy with Sentry**:
```bash
# Tag your release
npm run build
sentry-cli releases -o your-org -p your-project create $(git rev-parse HEAD)
sentry-cli releases -o your-org -p your-project set-commits $(git rev-parse HEAD) --auto
sentry-cli releases -o your-org -p your-project deploys $(git rev-parse HEAD) new -e production
```

---

## Best Practices

### 1. Filter Noise

Ignore known non-critical errors in `beforeSend`:

```javascript
// Don't report 404 errors
if (event.contexts?.http?.status_code === 404) return null;

// Don't report validation errors
if (error?.name === 'ValidationError') return null;

// Don't report network errors (user's connection)
if (error?.message?.includes('Network')) return null;
```

### 2. Sample Rates

**Production**:
- Error capture: 100% (all errors)
- Transaction tracking: 10% (performance impact)
- Session replay: 1% (storage cost)

**Staging**:
- Error capture: 100%
- Transaction tracking: 50%
- Session replay: 10%

### 3. Set User Context

Always set user context when user logs in:

```javascript
SentryReact.setUserContext(userId, email, username);
```

This helps you:
- Find which users are affected
- Segment errors by user type
- Replay user sessions (with replay feature)

### 4. Add Breadcrumbs Before Errors

```javascript
// Add breadcrumb before error happens
SentryBackend.addBreadcrumb('Starting payment verification', 'payment');
SentryBackend.addBreadcrumb('User: ' + userId, 'context');

try {
  await verifyPayment();
} catch (error) {
  // Error will be reported with breadcrumbs
  SentryBackend.captureError(error);
}
```

### 5. Environment-Specific Configuration

```javascript
// Only capture errors in production
const shouldReport = process.env.NODE_ENV === 'production';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: shouldReport,
  // ...
});
```

---

## Pricing

### Free Tier
- **Errors**: 5,000 events/month
- **Replays**: 0 sessions/month
- **Perfect for**: Development & small production apps

### Team Tier
- **Errors**: 500,000 events/month
- **Replays**: 5,000 sessions/month
- **Cost**: $26/month
- **Perfect for**: Growing apps (1,000+ users)

### Business Tier
- **Errors**: Unlimited
- **Replays**: Unlimited
- **Cost**: Starts at $100/month
- **Perfect for**: Enterprise apps

---

## Integration with Slack

### Setup Slack Integration

1. Go to Sentry Settings → Integrations
2. Install Slack integration
3. Select workspace
4. Choose channels for alerts

### Example Alerts

**Critical Errors**:
```
Channel: #alerts
When: Error occurs in production
Notify: @devteam
```

**Performance Warnings**:
```
Channel: #performance
When: Endpoint response > 1000ms (5 times in 10 minutes)
Notify: @backend-team
```

---

## Monitoring

### Key Metrics to Watch

1. **Error Rate**: % of failed requests
2. **Affected Users**: How many unique users hit the error
3. **Error Frequency**: How often error repeats
4. **Response Time**: Frontend API latency
5. **Memory Usage**: Backend memory consumption

### Weekly Review

1. Check Sentry dashboard for new errors
2. Review error trends
3. Fix critical errors
4. Update sampling rates if needed

---

## Troubleshooting

### DSN Not Set

```
⚠️ SENTRY_DSN not configured. Error tracking disabled.
```

**Fix**: Add DSN to `.env` and restart server

### Errors Not Appearing

1. Check DSN is correct
2. Verify `enabled: true` in configuration
3. Check browser console for Sentry errors
4. Ensure `tracesSampleRate > 0`

### Too Many Errors Reported

1. Increase `beforeSend` filters
2. Reduce `tracesSampleRate` (0.1 = 10%)
3. Ignore non-critical error types
4. Check for error loops (same error repeatedly)

---

## Next Steps

1. ✅ Configure DSNs for both frontend and backend
2. ✅ Deploy Sentry SDKs
3. ✅ Test with sample error
4. ✅ Set up Slack integration
5. ✅ Create alert rules
6. ✅ Train team on dashboard usage

---

## Support

- **Documentation**: https://docs.sentry.io/
- **Status Page**: https://status.sentry.io/
- **Community**: https://forum.sentry.io/

