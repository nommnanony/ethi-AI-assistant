import { useCallback } from 'react';
import { useAuthStore } from '../store';
import { authService } from '../services/api';
import type { LoginCredentials, RegisterInput } from '../types';
import type { AuthResponse } from '../services/api/auth.service';

export function useAuth() {
  const { user, isAuthenticated, isLoading, error, login, logout, setLoading, setError, clearError } =
    useAuthStore();

  const handleLogin = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      setLoading(true);
      clearError();
      const response = await authService.login(credentials);
      login(response.user, response.accessToken);
      return response;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [login, setLoading, setError, clearError]);

  const handleRegister = useCallback(async (input: RegisterInput): Promise<AuthResponse> => {
    try {
      setLoading(true);
      clearError();
      const response = await authService.register(input);
      login(response.user, response.accessToken);
      return response;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [login, setLoading, setError, clearError]);

  const handleLogout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      logout();
    }
  }, [logout]);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const user = await authService.getMe();
      useAuthStore.getState().setUser(user);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout, setLoading]);

  const getSessions = useCallback(async () => {
    return authService.getSessions();
  }, []);

  const revokeSession = useCallback(async (sessionId: string) => {
    return authService.revokeSession(sessionId);
  }, []);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    checkAuth,
    getSessions,
    revokeSession,
    clearError,
  };
}
