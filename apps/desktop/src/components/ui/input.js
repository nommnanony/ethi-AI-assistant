import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { cn } from '../../lib/utils';
export const Input = React.forwardRef(({ className, label, error, helperText, leftIcon, rightIcon, type = 'text', ...props }, ref) => {
    const inputId = props.id || props.name;
    return (_jsxs("div", { className: "w-full", children: [label && (_jsx("label", { htmlFor: inputId, className: "block text-sm font-medium text-text-secondary mb-1.5", children: label })), _jsxs("div", { className: "relative", children: [leftIcon && (_jsx("div", { className: "absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted", children: leftIcon })), _jsx("input", { ref: ref, id: inputId, type: type, className: cn('w-full bg-background border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted', 'focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan', 'transition-colors duration-200', error ? 'border-red-500' : 'border-border', leftIcon ? 'pl-10' : '', rightIcon ? 'pr-10' : '', className), ...props }), rightIcon && (_jsx("div", { className: "absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted", children: rightIcon }))] }), error && _jsx("p", { className: "mt-1 text-xs text-red-400", children: error }), helperText && !error && _jsx("p", { className: "mt-1 text-xs text-text-muted", children: helperText })] }));
});
Input.displayName = 'Input';
export const Textarea = React.forwardRef(({ className, label, error, ...props }, ref) => {
    return (_jsxs("div", { className: "w-full", children: [label && (_jsx("label", { className: "block text-sm font-medium text-text-secondary mb-1.5", children: label })), _jsx("textarea", { ref: ref, className: cn('w-full bg-background border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted', 'focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan', 'transition-colors duration-200 resize-none', error ? 'border-red-500' : 'border-border', className), ...props }), error && _jsx("p", { className: "mt-1 text-xs text-red-400", children: error })] }));
});
Textarea.displayName = 'Textarea';
