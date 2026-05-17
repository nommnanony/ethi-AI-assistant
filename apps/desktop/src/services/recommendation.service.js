import { create } from 'zustand';
export const useRecommendationStore = create((set) => ({
    recommendations: [],
    isLoading: false,
    error: null,
    addRecommendation: (recommendation) => set((state) => ({
        recommendations: [...state.recommendations, recommendation],
    })),
    removeRecommendation: (id) => set((state) => ({
        recommendations: state.recommendations.filter((r) => r.id !== id),
    })),
    clearRecommendations: () => set({ recommendations: [] }),
    setRecommendations: (recommendations) => set({ recommendations }),
}));
class RecommendationEngine {
    context = [];
    updateContext(messages) {
        this.context = messages;
        this.analyzeContext();
    }
    analyzeContext() {
        const store = useRecommendationStore.getState();
        const newRecommendations = [];
        const lastMessages = this.context.slice(-5);
        const hasCodeMessages = lastMessages.some((m) => m.code);
        const hasErrorMessages = lastMessages.some((m) => m.metadata?.error);
        const isCoding = this.context.some((m) => m.content.toLowerCase().includes('code') ||
            m.content.toLowerCase().includes('function') ||
            m.content.toLowerCase().includes('implement'));
        if (hasCodeMessages) {
            newRecommendations.push({
                id: crypto.randomUUID(),
                type: 'tip',
                title: 'Code Optimization',
                description: 'Consider extracting reusable functions from the code',
                confidence: 0.85,
            });
        }
        if (hasErrorMessages) {
            newRecommendations.push({
                id: crypto.randomUUID(),
                type: 'explanation',
                title: 'Error Analysis',
                description: 'Would you like me to help debug this error?',
                confidence: 0.95,
                action: 'debug',
            });
        }
        if (isCoding && lastMessages.length > 2) {
            newRecommendations.push({
                id: crypto.randomUUID(),
                type: 'snippet',
                title: 'Common Pattern',
                description: 'This pattern is commonly used for this use case',
                confidence: 0.75,
                code: '// Suggested improvement',
            });
        }
        store.setRecommendations(newRecommendations);
    }
    async generateSmartRecommendations(context) {
        const recommendations = [];
        const response = await fetch('/api/ai/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userMessage: context.userMessage,
                aiResponse: context.aiResponse,
                history: context.history.slice(-10),
            }),
        });
        if (response.ok) {
            const data = await response.json();
            return data.recommendations || [];
        }
        return recommendations;
    }
}
export const recommendationEngine = new RecommendationEngine();
