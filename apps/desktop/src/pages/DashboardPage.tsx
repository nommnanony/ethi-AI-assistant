import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui';
import { Activity, MessageSquare, Clock, Zap, TrendingUp, Users, RefreshCw, Bot } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSettingsStore } from '../store';
import { ragService } from '../services/api/rag.service';

interface DashboardStats {
  totalChats: number;
  activeToday: number;
  avgResponseTime: string;
  tokensUsed: number;
  topModels: { name: string; usage: number; requests: number }[];
  recentActivity: { time: string; action: string; model: string }[];
}

export function DashboardPage() {
  const { user } = useAuth();
  const { aiModel, aiProvider, ragStatus } = useSettingsStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    fetchRagStatus();
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
      } else {
        setStats(getDefaultStats());
      }
    } catch {
      setStats(getDefaultStats());
    } finally {
      setLoading(false);
    }
  };

  const fetchRagStatus = async () => {
    try {
      const status = await ragService.getStatus();
      useSettingsStore.getState().setRagStatus(status);
    } catch {
      // ignore
    }
  };

  const getDefaultStats = (): DashboardStats => ({
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
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-accent-cyan" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Welcome back, {user?.name || 'User'}!
            </h1>
            <p className="text-text-muted">Here's your AI assistant activity overview</p>
          </div>
          <button
            onClick={fetchDashboardData}
            className="p-2 rounded-lg bg-surface-elevated text-text-muted hover:text-text-primary transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4">
                <div className={`p-3 rounded-lg bg-surface-elevated ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
                  <p className="text-sm text-text-muted">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent-cyan" />
                Model Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.topModels.map((model) => (
                  <div key={model.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-primary">{model.name}</span>
                      <span className="text-text-muted">{model.requests} requests</span>
                    </div>
                    <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple rounded-full transition-all duration-500"
                        style={{ width: `${model.usage}%` }}
                      />
                    </div>
                  </div>
                ))}
                {!stats?.topModels.length && (
                  <p className="text-text-muted text-sm">No model usage data yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-accent-green" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-accent-cyan" />
                    <div className="flex-1">
                      <p className="text-sm text-text-primary">{activity.action}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge size="sm" variant="primary">{activity.model}</Badge>
                        <span className="text-xs text-text-muted">{activity.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {!stats?.recentActivity.length && (
                  <p className="text-text-muted text-sm">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-accent-cyan" />
                Current Model
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Provider</span>
                  <span className="text-text-primary font-medium capitalize">{aiProvider}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Model</span>
                  <span className="text-text-primary font-medium">{aiModel}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent-orange" />
                RAG Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${ragStatus?.ollamaConnected ? 'bg-accent-green' : 'bg-accent-orange'}`} />
                <span className="text-text-primary">{ragStatus?.ollamaConnected ? 'Connected' : 'Not Connected'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-text-muted">Vectors</span>
                  <p className="text-text-primary font-medium">{ragStatus?.vectors ?? 0}</p>
                </div>
                <div>
                  <span className="text-text-muted">Projects</span>
                  <p className="text-text-primary font-medium">{ragStatus?.projects?.length ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-accent-purple" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary text-sm transition-colors">
                  Start new chat
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary text-sm transition-colors">
                  Configure AI models
                </button>
                <button className="w-full text-left px-3 py-2 rounded-lg bg-surface-elevated text-text-secondary hover:text-text-primary text-sm transition-colors">
                  Manage API keys
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}