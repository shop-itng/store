/**
 * Shop It Transactional Email Templates
 *
 * Implements the 15 standard platform transactional emails with exact wording,
 * dynamic placeholder interpolation, and the platform signature.
 */

export type EmailTemplateKey =
  | 'signup_code'
  | 'new_device_login'
  | 'password_reset'
  | 'withdrawal_code'
  | 'new_payout_account_code'
  | 'order_placed_buyer'
  | 'new_order_seller'
  | 'order_shipped_buyer'
  | 'item_received_seller'
  | 'auto_release_reminder'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'seller_verified'
  | 'verification_not_approved'
  | 'welcome';

export interface EmailRenderResult {
  subject: string;
  text: string;
  html: string;
}

export const EMAIL_SIGNATURE_TEXT = `The Shop It Team · Operated by TEEDS.
Support: shopitverified@gmail.com (we reply within 3 working days).
Never share your codes. Shop It will never ask for your password or code.`;

export const EMAIL_SIGNATURE_HTML = `
  <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px; line-height: 1.6;">
    <p style="margin: 0; font-weight: 800; color: #1e293b;">The Shop It Team</p>
    <p style="margin: 3px 0 0; color: #64748b; font-size: 12px;">Operated by TEEDS · Nigerian Youth & Student Artisanal Marketplace</p>
    <p style="margin: 4px 0 0; color: #475569; font-size: 12px;">Need help? Email <a href="mailto:shopitverified@gmail.com" style="color: #FF6B00; text-decoration: underline;">shopitverified@gmail.com</a> (we reply within 3 working days).</p>
    <p style="margin: 6px 0 0; color: #dc2626; font-size: 11px; font-weight: 700;">Never share your codes. Shop It will never ask for your password or code.</p>
  </div>
`;

/**
 * Resolves the subject and body for each of the 15 emails with dynamic variables.
 */
export function renderTransactionalEmail(
  template: EmailTemplateKey,
  data: Record<string, any>
): EmailRenderResult {
  const code = (data.code || '').trim();
  const orderId = (data.order_id || data.orderId || '').trim();
  const total = (data.total !== undefined ? Number(data.total).toLocaleString() : '0');
  const amount = (data.amount !== undefined ? Number(data.amount).toLocaleString() : '0');
  const bankName = (data.bank_name || data.bankName || 'OPay / Bank').trim();
  const last4 = (data.last4 || '••••').trim();
  const item = (data.item || 'your item').trim();
  const appUrl = (data.appUrl || (typeof window !== 'undefined' ? window.location.origin : '') || 'https://shop-itng-pied.vercel.app').replace(/\/$/, '');
  const resetLink = (data.reset_link || data.resetLink || `${appUrl}/reset-password?code=${code}&email=${encodeURIComponent(data.email || '')}`).trim();
  const decision = (data.decision || 'Refund processed').trim();
  const reason = (data.reason || 'Document was unreadable or selfie could not be verified').trim();

  let subject = '';
  let bodyText = '';
  let bodyHtmlContent = '';

  switch (template) {
    case 'signup_code':
      subject = 'Your Shop It verification code';
      bodyText = `Your code is ${code}. It expires in 10 minutes. Never share it.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Your code is <strong style="font-size: 22px; color: #0f172a; letter-spacing: 4px; font-family: monospace; display: inline-block; padding: 4px 12px; background: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1;">${code}</strong>. It expires in 10 minutes. Never share it.
        </p>
      `;
      break;

    case 'new_device_login':
      subject = 'Confirm your login on Shop It';
      bodyText = `Someone is logging in on a new device. Code: ${code}. If this wasn't you, change your password now.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Someone is logging in on a new device. Code: <strong style="font-size: 22px; color: #0f172a; letter-spacing: 4px; font-family: monospace; display: inline-block; padding: 4px 12px; background: #f1f5f9; border-radius: 8px; border: 1px solid #cbd5e1;">${code}</strong>.
        </p>
        <p style="margin: 0; font-size: 14px; color: #dc2626;">If this wasn't you, change your password now.</p>
      `;
      break;

    case 'password_reset':
      subject = 'Reset your Shop It password';
      bodyText = `We received a request to reset the password for your Shop It account.

Your 6-digit reset code is: ${code}
(Expires in 10 minutes · 3 attempts max)

You can also reset your password directly using this link:
${resetLink}

If you didn't ask to reset your password, you can safely ignore this message. Your password will remain unchanged.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          We received a request to reset the password for your Shop It account. Use the 6-digit code below to set a new password:
        </p>

        <div style="text-align: center; margin: 24px 0; background-color: #fff7ed; border: 2px dashed #FF6B00; border-radius: 14px; padding: 20px 16px;">
          <span style="display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #c2410c; margin-bottom: 8px;">
            Your 6-Digit Reset Code
          </span>
          <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace; color: #111111; display: inline-block;">
            ${code}
          </div>
          <span style="display: block; font-size: 12px; color: #78350f; font-weight: 600; margin-top: 8px;">
            ⏱ Valid for 10 minutes · 3 wrong attempts max
          </span>
        </div>

        <div style="text-align: center; margin: 24px 0 20px;">
          <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">Or tap the button below to reset your password directly on the website:</p>
          <a href="${resetLink}" style="display: inline-block; background-color: #FF6B00; color: #111111; font-weight: 900; font-size: 14px; text-decoration: none; padding: 13px 28px; border-radius: 12px; border: 2px solid #111111; box-shadow: 0 3px 0 #111111;">
            Reset Password on Shop It &rarr;
          </a>
        </div>

        <p style="margin: 20px 0 0; font-size: 13px; color: #64748b; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          If you didn't ask to reset your password, you can safely ignore this email. Your account is still secure.
        </p>
      `;
      break;

    case 'withdrawal_code':
      subject = 'Confirm your withdrawal';
      bodyText = `Withdraw ₦${amount} to ${bankName} ending ${last4}. Code: ${code}.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Withdraw <strong>₦${amount}</strong> to <strong>${bankName}</strong> ending <strong>${last4}</strong>. Code: <strong style="font-size: 20px; color: #0f172a; letter-spacing: 3px; font-family: monospace; padding: 3px 8px; background: #f1f5f9; border-radius: 6px;">${code}</strong>.
        </p>
      `;
      break;

    case 'new_payout_account_code':
      subject = 'Confirm your new payout account';
      bodyText = `Adding ${bankName} ending ${last4}. Code: ${code}. You can withdraw to it after 24 hours.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Adding <strong>${bankName}</strong> ending <strong>${last4}</strong>. Code: <strong style="font-size: 20px; color: #0f172a; letter-spacing: 3px; font-family: monospace; padding: 3px 8px; background: #f1f5f9; border-radius: 6px;">${code}</strong>. You can withdraw to it after 24 hours.
        </p>
      `;
      break;

    case 'order_placed_buyer':
      subject = `We got your order #${orderId}`;
      bodyText = `Payment of ₦${total} received. Your money is held safely until you confirm the item arrived. Track your order: ${appUrl}/orders?track=${orderId}`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Payment of <strong>₦${total}</strong> received. Your money is held safely until you confirm the item arrived.
        </p>
        <p style="margin: 16px 0;">
          <a href="${appUrl}/orders?track=${orderId}" style="display: inline-block; background: #111111; color: #9FE870; font-weight: 700; font-size: 13px; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #FF6B00;">
            Track Order Live &rarr;
          </a>
        </p>
      `;
      break;

    case 'new_order_seller':
      subject = `New order #${orderId}`;
      bodyText = `You have a new order for ${item}. Pack it, upload a photo, and mark it shipped.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          You have a new order for <strong>${item}</strong>. Pack it, upload a photo, and mark it shipped.
        </p>
      `;
      break;

    case 'order_shipped_buyer':
      subject = `Your order #${orderId} is on the way`;
      bodyText = `When it arrives, tap "Item received" so the seller gets paid. Track your shipment: ${appUrl}/orders?track=${orderId}`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          When it arrives, tap "Item received" so the seller gets paid.
        </p>
        <p style="margin: 16px 0;">
          <a href="${appUrl}/orders?track=${orderId}" style="display: inline-block; background: #111111; color: #9FE870; font-weight: 700; font-size: 13px; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #FF6B00;">
            View Tracking Timeline &rarr;
          </a>
        </p>
      `;
      break;

    case 'item_received_seller':
      subject = `Payment released for order #${orderId}`;
      bodyText = `₦${amount} is now in your available balance.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          <strong>₦${amount}</strong> is now in your available balance.
        </p>
      `;
      break;

    case 'auto_release_reminder':
      subject = `Did your order #${orderId} arrive?`;
      bodyText = `Confirm it, or the money is released to the seller in 2 days. Not happy? Report a problem.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Confirm it, or the money is released to the seller in 2 days. Not happy? Report a problem.
        </p>
      `;
      break;

    case 'dispute_opened':
      subject = `Problem reported on order #${orderId}`;
      bodyText = `The money is on hold. Please upload photos or details.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          The money is on hold. Please upload photos or details.
        </p>
      `;
      break;

    case 'dispute_resolved':
      subject = `Update on order #${orderId}`;
      bodyText = `Decision: ${decision}.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Decision: <strong>${decision}</strong>.
        </p>
      `;
      break;

    case 'seller_verified':
      subject = `You're verified on Shop It`;
      bodyText = `You can now list products and withdraw earnings.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          You can now list products and withdraw earnings.
        </p>
      `;
      break;

    case 'verification_not_approved':
      subject = `We couldn't verify your ID`;
      bodyText = `Reason: ${reason}. Please upload a clearer ID and selfie.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Reason: <strong>${reason}</strong>. Please upload a clearer ID and selfie.
        </p>
      `;
      break;

    case 'welcome':
    default:
      subject = 'Welcome to Shop It';
      bodyText = `Your account is ready. Buy safe, sell easy.`;
      bodyHtmlContent = `
        <p style="margin: 0 0 16px; font-size: 15px; color: #0f172a; line-height: 1.6;">
          Your account is ready. Buy safe, sell easy.
        </p>
      `;
      break;
  }

  const fullText = `${bodyText}\n\n${EMAIL_SIGNATURE_TEXT}`;

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 32px 16px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; padding: 4px 10px; border-radius: 6px; background-color: #FF6B00; color: #ffffff; font-weight: 800; font-size: 12px; letter-spacing: 0.5px;">Shop It</span>
      <h2 style="color: #0f172a; font-size: 19px; font-weight: 800; margin: 12px 0 0;">${subject}</h2>
    </div>

    ${bodyHtmlContent}

    ${EMAIL_SIGNATURE_HTML}
  </div>
</body>
</html>`;

  return {
    subject,
    text: fullText,
    html: fullHtml,
  };
}

/**
 * Dispatches a transactional email to the serverless backend endpoint.
 * Never pretends the email succeeded if the server returns an error.
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

  const rendered = renderTransactionalEmail(template, data);

  try {
    if (typeof fetch !== 'undefined') {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
