export enum EmailTemplate {
  Welcome = 'welcome',
  MagicLink = 'magic-link',
  PasswordReset = 'password-reset',
  Invoice = 'invoice',
  SubscriptionCanceled = 'subscription-canceled',
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailProvider {
  sendEmail(options: SendEmailOptions): Promise<void>;
  sendTemplate(template: EmailTemplate, data: Record<string, unknown>): Promise<void>;
}
