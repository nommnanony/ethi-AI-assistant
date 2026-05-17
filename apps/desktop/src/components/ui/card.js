import { jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/utils';
export function Card({ className, variant = 'default', padding = 'md', hover = false, children, ...props }) {
    const variants = {
        default: 'bg-surface-base border border-border',
        elevated: 'bg-surface-elevated shadow-lg',
        outline: 'bg-transparent border border-border',
        ghost: 'bg-transparent hover:bg-surface-hover',
    };
    const paddings = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
    };
    return (_jsx("div", { className: cn('rounded-lg', variants[variant], paddings[padding], hover && 'transition-colors duration-200 cursor-pointer', className), ...props, children: children }));
}
export function CardHeader({ className, children, ...props }) {
    return (_jsx("div", { className: cn('flex flex-col space-y-1.5 pb-4', className), ...props, children: children }));
}
export function CardTitle({ className, children, ...props }) {
    return (_jsx("h3", { className: cn('text-lg font-semibold text-text-primary leading-none tracking-tight', className), ...props, children: children }));
}
export function CardDescription({ className, children, ...props }) {
    return (_jsx("p", { className: cn('text-sm text-text-muted', className), ...props, children: children }));
}
export function CardContent({ className, children, ...props }) {
    return (_jsx("div", { className: cn('', className), ...props, children: children }));
}
export function CardFooter({ className, children, ...props }) {
    return (_jsx("div", { className: cn('flex items-center pt-4', className), ...props, children: children }));
}
