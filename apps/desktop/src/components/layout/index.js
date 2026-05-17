import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { Button } from '../ui';
import { MessageSquare, Settings, LayoutDashboard, LogOut, Menu, X, Bot, ChevronDown, } from 'lucide-react';
import { cn } from '../../lib/utils';
export function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };
    const navItems = [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/chat', icon: MessageSquare, label: 'Chat' },
        { to: '/settings', icon: Settings, label: 'Settings' },
    ];
    return (_jsxs("div", { className: "h-screen w-screen flex overflow-hidden bg-background", children: [_jsxs("aside", { className: cn('bg-background border-r border-border flex flex-col transition-all duration-300', sidebarOpen ? 'w-60' : 'w-16'), children: [_jsxs("div", { className: "h-14 flex items-center justify-between px-4 border-b border-border", children: [sidebarOpen && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Bot, { className: "w-6 h-6 text-accent-cyan" }), _jsx("span", { className: "font-semibold text-text-primary", children: "Natively" })] })), _jsx("button", { onClick: () => setSidebarOpen(!sidebarOpen), className: "p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover", children: sidebarOpen ? _jsx(X, { className: "w-5 h-5" }) : _jsx(Menu, { className: "w-5 h-5" }) })] }), _jsx("nav", { className: "flex-1 p-2 space-y-1", children: navItems.map((item) => (_jsxs(NavLink, { to: item.to, end: item.to === '/', className: ({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors', isActive
                                ? 'bg-accent-cyan/10 text-accent-cyan'
                                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'), children: [_jsx(item.icon, { className: "w-5 h-5 flex-shrink-0" }), sidebarOpen && _jsx("span", { className: "text-sm font-medium", children: item.label })] }, item.to))) }), _jsx("div", { className: "p-2 border-t border-border", children: sidebarOpen && user ? (_jsxs("div", { className: "px-3 py-2", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center text-white text-sm font-medium", children: user.name?.[0]?.toUpperCase() || 'U' }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-text-primary truncate", children: user.name || 'User' }), _jsx("p", { className: "text-xs text-text-muted truncate", children: user.email })] })] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: handleLogout, className: "w-full mt-3 justify-start text-text-muted hover:text-red-400", children: [_jsx(LogOut, { className: "w-4 h-4 mr-2" }), "Sign Out"] })] })) : (_jsx("button", { onClick: () => setSidebarOpen(true), className: "w-full flex items-center justify-center p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover", children: _jsx(ChevronDown, { className: "w-5 h-5" }) })) })] }), _jsx("main", { className: "flex-1 flex flex-col min-w-0", children: _jsx(Outlet, {}) })] }));
}
