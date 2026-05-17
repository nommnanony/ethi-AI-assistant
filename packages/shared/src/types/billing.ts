export type SubscriptionTier = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'TRIALING' | 'UNPAID' | 'EXPIRED';

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  aiCredits: number;
  aiCreditsUsed: number;
  aiCreditsResetAt: string | null;
  features: Record<string, unknown> | null;
}

export interface InvoiceInfo {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export interface BillingPortalSession {
  url: string;
}

export interface SubscriptionTierInfo {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  highlighted: boolean;
}
