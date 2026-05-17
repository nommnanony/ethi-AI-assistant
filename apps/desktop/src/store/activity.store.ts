import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ActivityLog {
  id: string;
  type: 'chat' | 'action' | 'system' | 'error';
  action: string;
  details?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface ActivityState {
  activities: ActivityLog[];
  maxActivities: number;
  
  addActivity: (activity: Omit<ActivityLog, 'id' | 'timestamp'>) => void;
  clearActivities: () => void;
  getActivitiesByType: (type: ActivityLog['type']) => ActivityLog[];
  getRecentActivities: (count?: number) => ActivityLog[];
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      activities: [],
      maxActivities: 100,

      addActivity: (activity) =>
        set((state) => {
          const newActivity: ActivityLog = {
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
    }),
    {
      name: 'activity-storage',
      partialize: (state) => ({
        activities: state.activities.slice(0, 50),
      }),
    }
  )
);

export function useActivityTracker() {
  const addActivity = useActivityStore((state) => state.addActivity);

  const trackChat = (action: string, details?: string, metadata?: Record<string, any>) => {
    addActivity({ type: 'chat', action, details, metadata });
  };

  const trackAction = (action: string, details?: string, metadata?: Record<string, any>) => {
    addActivity({ type: 'action', action, details, metadata });
  };

  const trackSystem = (action: string, details?: string, metadata?: Record<string, any>) => {
    addActivity({ type: 'system', action, details, metadata });
  };

  const trackError = (action: string, details?: string, metadata?: Record<string, any>) => {
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
