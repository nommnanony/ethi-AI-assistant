import type { ApiRequestConfig } from '../../types';

const DEFAULT_TIMEOUT = 30000;

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(config: ApiRequestConfig & { url?: string }): Promise<T> {
    const { method = 'GET', headers = {}, params, data, timeout = DEFAULT_TIMEOUT, url } = config;

    const requestUrl = new URL(url || '', this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          requestUrl.searchParams.append(key, String(value));
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

      const requestHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        ...headers,
      };

      if (this.accessToken) {
        (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
      }

      try {
        const response = await fetch(requestUrl.toString(), {
        method,
        headers: requestHeaders,
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async get<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, method: 'GET' });
  }

  async post<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, method: 'POST', data });
  }

  async put<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, method: 'PUT', data });
  }

  async patch<T>(url: string, data?: any, config?: ApiRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, method: 'PATCH', data });
  }

  async delete<T>(url: string, config?: ApiRequestConfig): Promise<T> {
    return this.request<T>({ ...config, url, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
