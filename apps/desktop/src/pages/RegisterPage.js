import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Bot, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
export function RegisterPage() {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!name) {
            setError('Name is required');
            return;
        }
        if (!email) {
            setError('Email is required');
            return;
        }
        if (!password || password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        if (!/[A-Z]/.test(password)) {
            setError('Password must contain an uppercase letter');
            return;
        }
        if (!/[a-z]/.test(password)) {
            setError('Password must contain a lowercase letter');
            return;
        }
        if (!/[0-9]/.test(password)) {
            setError('Password must contain a number');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setIsLoading(true);
        try {
            await register({ email, password, name });
            navigate('/chat');
        }
        catch (err) {
            const message = err.message || 'Registration failed. Please try again.';
            setError(message);
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-[#0d1117] flex items-center justify-center p-4", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#58a6ff] to-[#a371f7] flex items-center justify-center", children: _jsx(Bot, { className: "w-8 h-8 text-white" }) }), _jsx("h1", { className: "text-3xl font-bold text-[#f0f6fc] mb-2", children: "Create Account" }), _jsx("p", { className: "text-[#8b949e]", children: "Join EthiAI today" })] }), _jsxs("div", { className: "bg-[#161b22] border border-[#30363d] rounded-xl p-6", children: [_jsx("h2", { className: "text-xl font-semibold text-[#f0f6fc] mb-4", children: "Get Started" }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-[#8b949e] mb-1.5", children: "Name" }), _jsxs("div", { className: "relative", children: [_jsx(User, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7681]" }), _jsx("input", { type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "Your name", className: "w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-10 pr-3 py-2.5 text-sm text-[#f0f6fc] placeholder:text-[#6e7681] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]/50", autoComplete: "name", disabled: isLoading })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-[#8b949e] mb-1.5", children: "Email" }), _jsxs("div", { className: "relative", children: [_jsx(Mail, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7681]" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com", className: "w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-10 pr-3 py-2.5 text-sm text-[#f0f6fc] placeholder:text-[#6e7681] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]/50", autoComplete: "email", disabled: isLoading })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-[#8b949e] mb-1.5", children: "Password" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7681]" }), _jsx("input", { type: showPassword ? 'text' : 'password', value: password, onChange: (e) => setPassword(e.target.value), placeholder: "At least 8 characters", className: "w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-10 pr-10 py-2.5 text-sm text-[#f0f6fc] placeholder:text-[#6e7681] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]/50", autoComplete: "new-password", disabled: isLoading }), _jsx("button", { type: "button", onClick: () => setShowPassword(!showPassword), className: "absolute right-3 top-1/2 -translate-y-1/2 text-[#6e7681] hover:text-[#8b949e]", children: showPassword ? _jsx(EyeOff, { className: "w-4 h-4" }) : _jsx(Eye, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-[#8b949e] mb-1.5", children: "Confirm Password" }), _jsxs("div", { className: "relative", children: [_jsx(Lock, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7681]" }), _jsx("input", { type: showPassword ? 'text' : 'password', value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), placeholder: "Confirm your password", className: "w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-10 pr-3 py-2.5 text-sm text-[#f0f6fc] placeholder:text-[#6e7681] focus:outline-none focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff]/50", autoComplete: "new-password", disabled: isLoading })] })] }), error && (_jsx("div", { className: "bg-[#f85149]/10 border border-[#f85149]/30 rounded-lg p-3", children: _jsx("p", { className: "text-sm text-[#f85149]", children: error }) })), _jsx("button", { type: "submit", disabled: isLoading, className: "w-full py-2.5 bg-gradient-to-r from-[#58a6ff] to-[#a371f7] text-white font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2", children: isLoading ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" }), "Creating account..."] })) : ('Create Account') })] }), _jsx("div", { className: "mt-4 pt-4 border-t border-[#30363d]", children: _jsxs("p", { className: "text-center text-sm text-[#6e7681]", children: ["Already have an account?", ' ', _jsx(Link, { to: "/login", className: "text-[#58a6ff] hover:underline", children: "Sign in" })] }) })] })] }) }));
}
