import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui';
import { useAuth } from '../../hooks';
import { Mail, Lock, User } from 'lucide-react';
export function LoginForm() {
    const navigate = useNavigate();
    const { login, isLoading, error } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({});
    const validate = () => {
        const newErrors = {};
        if (!email) {
            newErrors.email = 'Email is required';
        }
        else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!password) {
            newErrors.password = 'Password is required';
        }
        else if (password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate())
            return;
        try {
            await login({ email, password });
            navigate('/chat');
        }
        catch (err) {
            // Error is shown via the error state
        }
    };
    return (_jsxs(Card, { variant: "elevated", className: "w-full max-w-md mx-auto", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Sign In" }), _jsx(CardDescription, { children: "Enter your credentials to access your account" })] }), _jsx(CardContent, { children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsx(Input, { type: "email", label: "Email", placeholder: "you@example.com", value: email, onChange: (e) => setEmail(e.target.value), error: errors.email, leftIcon: _jsx(Mail, { className: "w-4 h-4" }), autoComplete: "email" }), _jsx(Input, { type: "password", label: "Password", placeholder: "Enter password", value: password, onChange: (e) => setPassword(e.target.value), error: errors.password, leftIcon: _jsx(Lock, { className: "w-4 h-4" }), autoComplete: "current-password" }), error && _jsx("p", { className: "text-sm text-red-400", children: error }), _jsx(Button, { type: "submit", className: "w-full", isLoading: isLoading, children: "Sign In" }), _jsxs("p", { className: "text-center text-sm text-[#8b949e]", children: ["Don't have an account?", ' ', _jsx("button", { type: "button", onClick: () => navigate('/register'), className: "text-[#58a6ff] hover:underline", children: "Sign up" })] })] }) })] }));
}
export function RegisterForm() {
    const navigate = useNavigate();
    const { register, isLoading, error } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState({});
    const validate = () => {
        const newErrors = {};
        if (!name)
            newErrors.name = 'Name is required';
        if (!email) {
            newErrors.email = 'Email is required';
        }
        else if (!/\S+@\S+\.\S+/.test(email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!password) {
            newErrors.password = 'Password is required';
        }
        else if (password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }
        if (password !== confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate())
            return;
        try {
            await register({ email, password, name });
            navigate('/chat');
        }
        catch (err) {
            // Error is shown via the error state
        }
    };
    return (_jsxs(Card, { variant: "elevated", className: "w-full max-w-md mx-auto", children: [_jsxs(CardHeader, { children: [_jsx(CardTitle, { children: "Create Account" }), _jsx(CardDescription, { children: "Sign up to get started with your AI assistant" })] }), _jsx(CardContent, { children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsx(Input, { type: "text", label: "Name", placeholder: "Your name", value: name, onChange: (e) => setName(e.target.value), error: errors.name, leftIcon: _jsx(User, { className: "w-4 h-4" }), autoComplete: "name" }), _jsx(Input, { type: "email", label: "Email", placeholder: "you@example.com", value: email, onChange: (e) => setEmail(e.target.value), error: errors.email, leftIcon: _jsx(Mail, { className: "w-4 h-4" }), autoComplete: "email" }), _jsx(Input, { type: "password", label: "Password", placeholder: "At least 8 characters", value: password, onChange: (e) => setPassword(e.target.value), error: errors.password, leftIcon: _jsx(Lock, { className: "w-4 h-4" }), autoComplete: "new-password" }), _jsx(Input, { type: "password", label: "Confirm Password", placeholder: "Confirm your password", value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), error: errors.confirmPassword, leftIcon: _jsx(Lock, { className: "w-4 h-4" }), autoComplete: "new-password" }), error && _jsx("p", { className: "text-sm text-red-400", children: error }), _jsx(Button, { type: "submit", className: "w-full", isLoading: isLoading, children: "Create Account" }), _jsxs("p", { className: "text-center text-sm text-[#8b949e]", children: ["Already have an account?", ' ', _jsx("button", { type: "button", onClick: () => navigate('/login'), className: "text-[#58a6ff] hover:underline", children: "Sign in" })] })] }) })] }));
}
