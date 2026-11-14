import * as Sentry from '@sentry/react';

// Read Sentry DSN strictly from client environment variables
const SENTRY_DSN = ((import.meta as any).env?.VITE_SENTRY_DSN || '').trim();

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: (import.meta as any).env?.MODE || 'production',
    beforeSend(event) {
      // Strip PII and sensitive headers before sending to Sentry
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['verif-hash'];
      }
      if (event.user) {
        delete event.user.ip_address;
        if (event.user.email) {
          event.user.email = '[SCRUBBED_EMAIL]';
        }
        if (event.user.username) {
          event.user.username = '[SCRUBBED_USER]';
        }
      }

      // Scrub credentials, 11-digit NINs, emails, and API keys
      const sensitivePattern = /(xkeysib-[a-zA-Z0-9_-]+|FLWSECK(?:_TEST)?-[a-zA-Z0-9_-]+|FLWPUBK(?:_TEST)?-[a-zA-Z0-9_-]+|\b\d{11}\b|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
      if (event.message) {
        event.message = event.message.replace(sensitivePattern, '[SCRUBBED]');
      }
      return event;
    },
  });
}

export function captureAppError(error: any, context?: Record<string, any>) {
  if (SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('[Error Caught]', error?.message || error, context);
  }
}
