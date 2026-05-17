import Redis from 'ioredis';
import { config } from '../config/env';

export class CacheService {
  private redis: Redis;
  private prefix: string;

  constructor(redisUrl?: string, prefix?: string) {
    this.redis = new Redis(redisUrl || config.REDIS_URL, {
      lazyConnect: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    this.prefix = prefix || config.REDIS_PREFIX;
  }

  async connect(): Promise<void> {
    await this.redis.connect();
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redis.get(`${this.prefix}${key}`);
    if (data === null) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return data as unknown as T;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const fullKey = `${this.prefix}${key}`;
    if (ttl !== undefined && ttl > 0) {
      await this.redis.setex(fullKey, ttl, serialized);
    } else {
      await this.redis.set(fullKey, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(`${this.prefix}${key}`);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(`${this.prefix}${key}`);
    return result === 1;
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  getClient(): Redis {
    return this.redis;
  }
}

export const cacheService = new CacheService();
