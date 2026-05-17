import { AI_CREDIT_COSTS } from '../constants/subscription.js';
import type { AIModelType } from '../types/ai.js';

export function calculateCreditCost(model: AIModelType, inputTokens: number, outputTokens: number): number {
  const cost = AI_CREDIT_COSTS[model];
  if (!cost) return 0;
  return (inputTokens * cost.input + outputTokens * cost.output) / 1000;
}

export function calculateSubscriptionPrice(tier: string, interval: 'month' | 'year'): number {
  const prices: Record<string, number> = {
    FREE: 0,
    PRO_MONTHLY: 20,
    PRO_YEARLY: 200,
    TEAM_MONTHLY: 50,
    TEAM_YEARLY: 500,
  };
  return prices[`${tier}_${interval.toUpperCase()}`] ?? 0;
}

export function getTrialDays(tier: string): number {
  return tier === 'PRO' || tier === 'TEAM' ? 14 : 0;
}
