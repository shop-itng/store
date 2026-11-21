/**
 * Browser wrapper for Shop It Transactional Emails.
 * Re-exports pure template helpers from shared/transactionalEmails.ts.
 */
import { safeStorageGet } from './safeStorage';
import {
  renderTransactionalEmail,
  EMAIL_SIGNATURE_TEXT,
  EMAIL_SIGNATURE_HTML,
  type EmailTemplateKey,
  type EmailRenderResult,
} from '../../shared/transactionalEmails';

export {
  renderTransactionalEmail,
  EMAIL_SIGNATURE_TEXT,
  EMAIL_SIGNATURE_HTML,
  type EmailTemplateKey,
  type EmailRenderResult,
};

/**
 * Dispatches a transactional email from the browser to the backend endpoint.
 */
export async function sendTransactionalEmail(
  toEmail: string,
  template: EmailTemplateKey,
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = (toEmail || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Invalid recipient email address' };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const rendered = renderTransactionalEmail(template, {
    ...data,
    appUrl: data.appUrl || origin || 'https://shopitng.vercel.app',
  });
  const token = safeStorageGet('shopit_session_token');

  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}`, 'x-session-token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          to: cleanEmail,
          template,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          data,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok || resData.status === false) {
        const errorMsg = resData.message || `Email delivery failed with status ${res.status}`;
        console.error(`[Brevo Email Error] Failed to send ${template}:`, errorMsg);
        return { success: false, error: errorMsg };
      }
      return { success: true };
    }
  } catch (err: any) {
    console.error(`[Transactional Email Error] Network failure for ${template}:`, err.message);
    return { success: false, error: err.message || 'Network error dispatching email' };
  }

  return { success: false, error: 'Environment fetch not available' };
}
