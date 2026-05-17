import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Routes, Route, BrowserRouter, Navigate, useLocation } from 'react-router-dom';
import { LoginPage, RegisterPage, ChatPage, SettingsPage, DashboardPage } from './pages';
import { Layout } from './components/layout';
function AuthProvider(_props) {
    const [isReady, setIsReady] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const location = useLocation();
    useEffect(() => {
        const checkAuth = () => {
            try {
                const stored = localStorage.getItem('auth-storage');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.state?.isAuthenticated && parsed.state?.user) {
                        setIsAuthenticated(true);
                    }
                }
            }
            catch { }
            setIsReady(true);
        };
        checkAuth();
    }, []);
    if (!isReady) {
        return (_jsx("div", { className: "min-h-screen bg-[#0d1117] flex items-center justify-center", children: _jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 border-4 border-[#58a6ff] border-t-transparent rounded-full animate-spin" }), _jsx("span", { className: "text-[#8b949e] text-sm", children: "Loading..." })] }) }));
    }
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: isAuthenticated ? (_jsx(Navigate, { to: "/chat", replace: true })) : (_jsx(LoginPage, {})) }), _jsx(Route, { path: "/register", element: isAuthenticated ? (_jsx(Navigate, { to: "/chat", replace: true })) : (_jsx(RegisterPage, {})) }), _jsxs(Route, { path: "/", element: isAuthenticated ? (_jsx(Layout, {})) : (_jsx(Navigate, { to: "/login", state: { from: location }, replace: true })), children: [_jsx(Route, { index: true, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "chat", element: _jsx(ChatPage, {}) }), _jsx(Route, { path: "settings", element: _jsx(SettingsPage, {}) })] }), _jsx(Route, { path: "*", element: isAuthenticated ? (_jsx(Navigate, { to: "/", replace: true })) : (_jsx(Navigate, { to: "/login", replace: true })) })] }));
}
function App() {
    return (_jsx(BrowserRouter, { children: _jsx(AuthProvider, {}) }));
}
export default App;
