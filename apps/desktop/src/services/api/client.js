const DEFAULT_TIMEOUT = 30000;
class ApiClient {
    baseUrl;
    accessToken = null;
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }
    setBaseUrl(url) {
        this.baseUrl = url;
    }
    setAccessToken(token) {
        this.accessToken = token;
    }
    async request(config) {
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
        const requestHeaders = {
            'Content-Type': 'application/json',
            ...headers,
        };
        if (this.accessToken) {
            requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
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
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }
    async get(url, config) {
        return this.request({ ...config, url, method: 'GET' });
    }
    async post(url, data, config) {
        return this.request({ ...config, url, method: 'POST', data });
    }
    async put(url, data, config) {
        return this.request({ ...config, url, method: 'PUT', data });
    }
    async patch(url, data, config) {
        return this.request({ ...config, url, method: 'PATCH', data });
    }
    async delete(url, config) {
        return this.request({ ...config, url, method: 'DELETE' });
    }
}
export const apiClient = new ApiClient();
