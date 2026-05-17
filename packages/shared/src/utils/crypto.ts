import { randomBytes, createHash } from 'node:crypto';

export function generateId(length = 24): string {
  return randomBytes(length).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateApiKey(): string {
  const prefix = 'nv_';
  const key = randomBytes(32).toString('base64url');
  return `${prefix}${key}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local[0]}${'*'.repeat(Math.max(local.length - 2, 0))}${local[local.length - 1]}@${domain}`;
}

export function maskString(str: string, visibleChars = 4): string {
  if (str.length <= visibleChars * 2) return str;
  return `${str.slice(0, visibleChars)}${'*'.repeat(str.length - visibleChars * 2)}${str.slice(-visibleChars)}`;
}
