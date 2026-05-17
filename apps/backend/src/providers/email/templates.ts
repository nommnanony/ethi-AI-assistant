import Handlebars from 'handlebars';
import { EmailTemplate } from './types';

const templates: Record<EmailTemplate, HandlebarsTemplate> = {
  [EmailTemplate.Welcome]: Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h1>Welcome, {{name}}!</h1>
  <p>Thank you for joining {{appName}}. We're excited to have you on board.</p>
  <p>Get started by exploring your dashboard and setting up your first workspace.</p>
  <a href="{{dashboardUrl}}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Go to Dashboard</a>
  <hr style="margin-top:24px;">
  <p style="color:#6b7280;font-size:12px;">© {{year}} {{appName}}. All rights reserved.</p>
</body>
</html>`),

  [EmailTemplate.MagicLink]: Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h1>Sign in to {{appName}}</h1>
  <p>Click the button below to sign in. This link expires in {{expiresIn}}.</p>
  <a href="{{magicLink}}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Sign In</a>
  <p style="margin-top:16px;color:#6b7280;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>
  <hr style="margin-top:24px;">
  <p style="color:#6b7280;font-size:12px;">© {{year}} {{appName}}. All rights reserved.</p>
</body>
</html>`),

  [EmailTemplate.PasswordReset]: Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h1>Reset your password</h1>
  <p>We received a request to reset the password for your {{appName}} account.</p>
  <a href="{{resetUrl}}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
  <p style="margin-top:16px;color:#6b7280;font-size:14px;">This link expires in {{expiresIn}}. If you didn't request this, please ignore this email.</p>
  <hr style="margin-top:24px;">
  <p style="color:#6b7280;font-size:12px;">© {{year}} {{appName}}. All rights reserved.</p>
</body>
</html>`),

  [EmailTemplate.Invoice]: Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h1>Invoice #{{invoiceNumber}}</h1>
  <p>Thank you for your payment. Here's a summary of your invoice.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">Plan</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">{{planName}}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">Amount</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">{{amount}}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">Date</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">{{date}}</td></tr>
  </table>
  <a href="{{invoiceUrl}}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">View Invoice</a>
  <hr style="margin-top:24px;">
  <p style="color:#6b7280;font-size:12px;">© {{year}} {{appName}}. All rights reserved.</p>
</body>
</html>`),

  [EmailTemplate.SubscriptionCanceled]: Handlebars.compile(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <h1>Subscription Canceled</h1>
  <p>Hi {{name}}, your {{planName}} subscription has been canceled.</p>
  {{#if effectiveDate}}
  <p>Your access will continue until {{effectiveDate}}.</p>
  {{/if}}
  <p>We're sorry to see you go. If you change your mind, you can resubscribe at any time.</p>
  <a href="{{dashboardUrl}}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;">Return to Dashboard</a>
  <hr style="margin-top:24px;">
  <p style="color:#6b7280;font-size:12px;">© {{year}} {{appName}}. All rights reserved.</p>
</body>
</html>`),
};

type HandlebarsTemplate = HandlebarsTemplateDelegate<Record<string, unknown>>;

export function renderTemplate(template: EmailTemplate, data: Record<string, unknown>): string {
  return templates[template](data);
}

export { templates };
