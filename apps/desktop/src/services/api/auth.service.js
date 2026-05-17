class AuthService {
    baseUrl = 'http://localhost:4000';
    async login(credentials) {
        const response = await fetch(`${this.baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(credentials),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Login failed');
        }
        return response.json();
    }
    async register(input) {
        const response = await fetch(`${this.baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(input),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Registration failed');
        }
        return response.json();
    }
    async logout() {
        await fetch(`${this.baseUrl}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
    }
    async refreshToken() {
        const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Token refresh failed');
        }
        return response.json();
    }
    async getMe() {
        const response = await fetch(`${this.baseUrl}/api/auth/me`, {
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Failed to get user');
        }
        return response.json();
    }
    async getSessions() {
        const response = await fetch(`${this.baseUrl}/api/auth/sessions`, {
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Failed to get sessions');
        }
        return response.json();
    }
    async revokeSession(sessionId) {
        const response = await fetch(`${this.baseUrl}/api/auth/sessions/${sessionId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!response.ok) {
            throw new Error('Failed to revoke session');
        }
    }
}
export const authService = new AuthService();
