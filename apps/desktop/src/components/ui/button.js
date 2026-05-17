import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';
export const Button = React.forwardRef(({ className, variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed';
    const variants = {
        primary: 'bg-gradient-to-r from-accent-cyan to-accent-purple text-white hover:opacity-90 focus:ring-accent-cyan',
        secondary: 'bg-surface-elevated text-text-primary hover:bg-surface-hover border border-border focus:ring-border',
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-hover focus:ring-border',
        danger: 'bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 focus:ring-red-500',
        outline: 'border border-border text-text-secondary hover:text-text-primary hover:border-accent-cyan focus:ring-accent-cyan',
    };
    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
        icon: 'p-2',
    };
    return (_jsxs("button", { ref: ref, className: cn(baseStyles, variants[variant], sizes[size], className), disabled: disabled || isLoading, ...props, children: [isLoading ? (_jsx(Loader2, { className: "w-4 h-4 mr-2 animate-spin" })) : leftIcon ? (_jsx("span", { className: "mr-2", children: leftIcon })) : null, children, rightIcon && !isLoading && _jsx("span", { className: "ml-2", children: rightIcon })] }));
});
Button.displayName = 'Button';
