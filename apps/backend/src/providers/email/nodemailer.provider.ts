import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../../config/env';
import { logger } from '../../common/logger';
import type { EmailProvider, SendEmailOptions } from './types';
import { EmailTemplate } from './types';
import { renderTemplate } from './templates';

export class NodemailerEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, text, html } = options;

    try {
      await this.transporter.sendMail({
        from: config.SMTP_FROM,
        to,
        subject,
        text,
        html,
      });

      logger.info({ to, subject }, 'Email sent successfully');
    } catch (error) {
      logger.error({ error, to, subject }, 'Failed to send email');
      throw error;
    }
  }

  async sendTemplate(template: EmailTemplate, data: Record<string, unknown>): Promise<void> {
    const payload = this.buildPayload(template, data);

    await this.sendEmail(payload);
  }

  private buildPayload(template: EmailTemplate, data: Record<string, unknown>): SendEmailOptions {
    const defaults = {
      appName: 'Ethi AI',
      year: new Date().getFullYear().toString(),
       dashboardUrl: 'https://ethi-ai.ai/dashboard',
      name: 'there',
      email: '',
    };

    const merged = { ...defaults, ...data };
    const html = renderTemplate(template, merged);

     const subjectMap: Record<EmailTemplate, string> = {
       [EmailTemplate.Welcome]: 'Welcome to Ethi AI!',
       [EmailTemplate.MagicLink]: 'Your sign-in link',
       [EmailTemplate.PasswordReset]: 'Reset your password',
       [EmailTemplate.Invoice]: 'Your invoice',
       [EmailTemplate.SubscriptionCanceled]: 'Subscription canceled',
     };

    const m = merged as any;
    const plainTextMap: Record<EmailTemplate, string> = {
      [EmailTemplate.Welcome]: `Welcome, ${m.name ?? 'there'}! Thank you for joining ${m.appName}.`,
      [EmailTemplate.MagicLink]: `Sign in here: ${m.magicLink as string}`,
      [EmailTemplate.PasswordReset]: `Reset your password here: ${m.resetUrl as string}`,
      [EmailTemplate.Invoice]: `Invoice #${m.invoiceNumber as string} for ${m.amount as string}. View: ${m.invoiceUrl as string}`,
      [EmailTemplate.SubscriptionCanceled]: `Your ${m.planName as string} subscription has been canceled.`,
    };

    return {
      to: merged.email as string,
      subject: subjectMap[template],
      text: plainTextMap[template],
      html,
    };
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      logger.error({ error }, 'SMTP connection verification failed');
      return false;
    }
  }
}
