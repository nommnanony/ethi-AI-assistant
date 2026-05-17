import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
export function Spinner({ size = 'md', className, label }) {
    const sizes = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-12 h-12',
    };
    return (_jsxs("div", { className: cn('flex flex-col items-center justify-center gap-2', className), children: [_jsx(Loader2, { className: cn('animate-spin text-accent-cyan', sizes[size]) }), label && _jsx("span", { className: "text-sm text-text-muted", children: label })] }));
}
export function LoadingOverlay({ isLoading, children, className, spinner }) {
    return (_jsxs("div", { className: cn('relative', className), children: [children, isLoading && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg", children: spinner || _jsx(Spinner, { size: "lg" }) }))] }));
}
export function Skeleton({ className, variant = 'rectangular', width, height, ...props }) {
    const variants = {
        text: 'rounded',
        circular: 'rounded-full',
        rectangular: 'rounded-lg',
    };
    return (_jsx("div", { className: cn('bg-surface-elevated animate-pulse', variants[variant], className), style: { width, height }, ...props }));
}
