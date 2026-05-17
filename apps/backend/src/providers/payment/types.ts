export interface PaymentProvider {
  createCustomer(email: string, name?: string, metadata?: Record<string, string>): Promise<unknown>;
  getCustomer(customerId: string): Promise<unknown>;
  createCheckoutSession(options: CreateCheckoutSessionOptions): Promise<CheckoutSessionResult>;
  createPortalSession(customerId: string, options?: CreatePortalSessionOptions): Promise<PortalSessionResult>;
  handleWebhook(payload: Buffer, signature: string): Promise<WebhookResult>;
  cancelSubscription(subscriptionId: string, immediate?: boolean): Promise<void>;
  resumeSubscription(subscriptionId: string): Promise<void>;
  updateSubscriptionItem(subscriptionId: string, itemId: string, priceId: string, quantity?: number): Promise<void>;
  listInvoices(customerId: string, limit?: number): Promise<InvoiceResult[]>;
  createCoupon(options: CreateCouponOptions): Promise<unknown>;
  getSubscription(subscriptionId: string): Promise<unknown>;
  listSubscriptions(customerId: string): Promise<unknown[]>;
  getUsageRecordSummaries(subscriptionItemId: string): Promise<unknown[]>;
  createUsageRecord(subscriptionItemId: string, quantity: number, timestamp?: number): Promise<unknown>;
  getTaxRates(): Promise<TaxRateResult[]>;
}

export interface CreateCheckoutSessionOptions {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customer?: string;
  trialDays?: number;
  quantity?: number;
  metadata?: Record<string, string>;
}

export interface CreatePortalSessionOptions {
  returnUrl?: string;
  flowData?: {
    type: string;
    after_completion?: { type: string; hosted_confirmation_url?: string };
  };
}

export interface CreateCouponOptions {
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration?: 'forever' | 'once' | 'repeating';
  durationInMonths?: number;
  maxRedemptions?: number;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  url: string | null;
  sessionId: string;
}

export interface PortalSessionResult {
  url: string;
}

export interface WebhookResult {
  type: string;
  data: Record<string, unknown>;
}

export interface InvoiceResult {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  pdfUrl: string | null;
  number: string | null;
  lines: Array<{ description: string | null; amount: number | null; priceId: string | undefined }>;
}

export interface PaymentMethodResult {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export interface TaxRateResult {
  id: string;
  percentage: number;
  description: string;
  jurisdiction: string;
  inclusive: boolean;
}
