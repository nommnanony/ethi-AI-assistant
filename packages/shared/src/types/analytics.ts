export interface UsageStats {
  totalTokens: number;
  totalCost: number;
  totalSessions: number;
  totalTranscripts: number;
  averageLatency: number;
  tokensByDay: { date: string; tokens: number }[];
  costByDay: { date: string; cost: number }[];
  costByModel: { model: string; cost: number }[];
  tokensByProvider: { provider: string; tokens: number }[];
}

export interface AnalyticsQuery {
  startDate: string;
  endDate: string;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}
