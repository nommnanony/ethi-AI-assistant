import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui';
import { Activity, MessageSquare, Clock, Zap, TrendingUp, Users, RefreshCw, Bot } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSettingsStore } from '../store';
export function DashboardPage() {
    const { user } = useAuth();
    const { aiModel, aiProvider, ragStatus } = useSettingsStore();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000);
        return () => clearInterval(interval);
    }, []);
    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem('auth-storage');
            let accessToken = '';
            if (token) {
                const parsed = JSON.parse(token);
                accessToken = parsed.state?.accessToken;
            }
            const response = await fetch('http://localhost:4000/api/stats/dashboard', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
            else {
                setStats(getDefaultStats());
            }
        }
        catch {
            setStats(getDefaultStats());
        }
        finally {
            setLoading(false);
        }
    };
    const getDefaultStats = () => ({
        totalChats: 0,
        activeToday: 0,
        avgResponseTime: '0s',
        tokensUsed: 0,
        topModels: [
            { name: aiProvider === 'gemini' ? 'Gemini 2.5 Flash' : aiProvider === 'openai' ? 'GPT-4o' : aiProvider === 'anthropic' ? 'Claude Sonnet 4' : aiModel, usage: 100, requests: 0 },
        ],
        recentActivity: [
            { time: 'Just now', action: 'Connected to AI assistant', model: aiModel },
        ],
    });
    const statCards = [
        { label: 'Total Chats', value: stats?.totalChats ?? 0, icon: MessageSquare, color: 'text-accent-cyan' },
        { label: 'Active Today', value: stats?.activeToday ?? 0, icon: Activity, color: 'text-accent-green' },
        { label: 'Avg Response Time', value: stats?.avgResponseTime ?? '0s', icon: Clock, color: 'text-accent-purple' },
        { label: 'Tokens Used', value: stats?.tokensUsed ? `${(stats.tokensUsed / 1000).toFixed(1)}K` : '0', icon: Zap, color: 'text-accent-orange' },
    ];
    if (loading) {
        return (_jsx("div", { className: "flex-1 overflow-y-auto p-6", children: _jsx("div", { className: "max-w-6xl mx-auto", children: _jsx("div", { className: "flex items-center justify-center h-64", children: _jsx(RefreshCw, { className: "w-8 h-8 animate-spin text-accent-cyan" }) }) }) }));
    }
    return (_jsx("div", { className: "flex-1 overflow-y-auto p-6", children: _jsxs("div", { className: "max-w-6xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-8", children: [_jsxs("div", { children: [_jsxs("h1", { className: "text-2xl font-bold text-text-primary mb-2", children: ["Welcome back, ", user?.name || 'User', "!"] }), _jsx("p", { className: "text-text-muted", children: "Here's your AI assistant activity overview" })] }), _jsx("button", { onClick: fetchDashboardData, className: "p-2 rounded-lg bg-surface-elevated text-text-muted hover:text-text-primary transition-colors", children: _jsx(RefreshCw, { className: "w-5 h-5" }) })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8", children: statCards.map((stat) => (_jsx(Card, { children: _jsxs(CardContent, { className: "flex items-center gap-4", children: [_jsx("div", { className: `p-3 rounded-lg bg-surface-elevated ${stat.color}`, children: _jsx(stat.icon, { className: "w-6 h-6" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-text-primary", children: stat.value }), _jsx("p", { className: "text-sm text-text-muted", children: stat.label })] })] }) }, stat.label))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(TrendingUp, { className: "w-5 h-5 text-accent-cyan" }), "Model Usage"] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-4", children: [stats?.topModels.map((model) => (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "text-text-primary", children: model.name }), _jsxs("span", { className: "text-text-muted", children: [model.requests, " requests"] })] }), _jsx("div", { className: "h-2 bg-surface-elevated rounded-full overflow-hidden", children: _jsx("div", { className: "h-full bg-gradient-to-r from-accent-cyan to-accent-purple rounded-full transition-all duration-500", style: { width: `${model.usage}%` } }) })] }, model.name))), !stats?.topModels.length && (_jsx("p", { className: "text-text-muted text-sm", children: "No model usage data yet" }))] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Activity, { className: "w-5 h-5 text-accent-green" }), "Recent Activity"] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-4", children: [stats?.recentActivity.map((activity, i) => (_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "w-2 h-2 mt-2 rounded-full bg-accent-cyan" }), _jsxs("div", { className: "flex-1", children: [_jsx("p", { className: "text-sm text-text-primary", children: activity.action }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx(Badge, { size: "sm", variant: "primary", children: activity.model }), _jsx("span", { className: "text-xs text-text-muted", children: activity.time })] })] })] }, i))), !stats?.recentActivity.length && (_jsx("p", { className: "text-text-muted text-sm", children: "No recent activity" }))] }) })] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Bot, { className: "w-5 h-5 text-accent-cyan" }), "Current Model"] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-text-muted", children: "Provider" }), _jsx("span", { className: "text-text-primary font-medium capitalize", children: aiProvider })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-text-muted", children: "Model" }), _jsx("span", { className: "text-text-primary font-medium", children: aiModel })] })] }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Zap, { className: "w-5 h-5 text-accent-orange" }), "RAG Status"] }) }), _jsxs(CardContent, { children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("div", { className: `w-3 h-3 rounded-full ${ragStatus?.ollamaConnected ? 'bg-accent-green' : 'bg-accent-orange'}` }), _jsx("span", { className: "text-text-primary", children: ragStatus?.ollamaConnected ? 'Connected' : 'Not Connected' })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Vectors" }), _jsx("p", { className: "text-text-primary font-medium", children: ragStatus?.vectors ?? 0 })] }), _jsxs("div", { children: [_jsx("span", { className: "text-text-muted", children: "Projects" }), _jsx("p", { className: "text-text-primary font-medium", children: ragStatus?.projects?.length ?? 0 })] })] })] })] }), _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(Users, { className: "w-5 h-5 text-accent-purple" }), "Quick Actions"] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-2", children: [_jsx("button", { className: "w-full text-left px-3 py-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary text-sm transition-colors", children: "Start new chat" }), _jsx("button", { className: "w-full text-left px-3 py-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary text-sm transition-colors", children: "Configure AI models" }), _jsx("button", { className: "w-full text-left px-3 py-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary text-sm transition-colors", children: "Manage API keys" })] }) })] })] })] }) }));
}
