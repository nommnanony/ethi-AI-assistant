import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useAuthStore = create()(persist((set) => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    setUser: (user) => set({ user, isAuthenticated: !!user }),
    setAccessToken: (token) => set({ accessToken: token }),
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
    login: (user, token) => set({
        user,
        accessToken: token,
        isAuthenticated: true,
        error: null,
    }),
    logout: () => set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        error: null,
    }),
    clearError: () => set({ error: null }),
}), {
    name: 'auth-storage',
    partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
    }),
}));
