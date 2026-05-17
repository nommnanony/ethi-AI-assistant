export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string;
  subscription?: Subscription;
}

export type UserRole = 'ADMIN' | 'USER' | 'GUEST';

export interface Subscription {
  tier: SubscriptionTier;
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED';
  aiCredits: number;
  aiCreditsUsed: number;
}

export type SubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}
