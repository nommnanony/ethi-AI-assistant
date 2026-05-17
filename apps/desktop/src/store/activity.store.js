import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const useActivityStore = create()(persist((set, get) => ({
    activities: [],
    maxActivities: 100,
    addActivity: (activity) => set((state) => {
        const newActivity = {
            ...activity,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };
        const activities = [newActivity, ...state.activities];
        if (activities.length > state.maxActivities) {
            activities.pop();
        }
        return { activities };
    }),
    clearActivities: () => set({ activities: [] }),
    getActivitiesByType: (type) => {
        return get().activities.filter((a) => a.type === type);
    },
    getRecentActivities: (count = 10) => {
        return get().activities.slice(0, count);
    },
}), {
    name: 'activity-storage',
    partialize: (state) => ({
        activities: state.activities.slice(0, 50),
    }),
}));
export function useActivityTracker() {
    const addActivity = useActivityStore((state) => state.addActivity);
    const trackChat = (action, details, metadata) => {
        addActivity({ type: 'chat', action, details, metadata });
    };
    const trackAction = (action, details, metadata) => {
        addActivity({ type: 'action', action, details, metadata });
    };
    const trackSystem = (action, details, metadata) => {
        addActivity({ type: 'system', action, details, metadata });
    };
    const trackError = (action, details, metadata) => {
        addActivity({ type: 'error', action, details, metadata });
    };
    return {
        trackChat,
        trackAction,
        trackSystem,
        trackError,
        activities: useActivityStore((state) => state.activities),
        clearActivities: useActivityStore((state) => state.clearActivities),
    };
}
