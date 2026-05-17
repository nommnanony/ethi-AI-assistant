import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown, Check } from 'lucide-react';
export function Select({ options, value, onChange, placeholder = 'Select...', label, error, disabled = false, className, }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const selectedOption = options.find((opt) => opt.value === value);
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const handleSelect = (option) => {
        if (option.disabled)
            return;
        onChange?.(option.value);
        setIsOpen(false);
    };
    return (_jsxs("div", { className: cn('w-full', className), ref: containerRef, children: [label && (_jsx("label", { className: "block text-sm font-medium text-text-secondary mb-1.5", children: label })), _jsxs("div", { className: "relative", children: [_jsxs("button", { type: "button", onClick: () => !disabled && setIsOpen(!isOpen), className: cn('w-full flex items-center justify-between px-3 py-2 bg-background border rounded-lg text-sm text-left', 'focus:outline-none focus:ring-2 focus:ring-accent-cyan/50 focus:border-accent-cyan', 'transition-colors duration-200', disabled && 'opacity-50 cursor-not-allowed', error ? 'border-red-500' : 'border-border'), disabled: disabled, children: [_jsxs("span", { className: cn('flex items-center gap-2', !selectedOption && 'text-text-muted'), children: [selectedOption?.icon, selectedOption?.label || placeholder] }), _jsx(ChevronDown, { className: cn('w-4 h-4 text-text-muted transition-transform', isOpen && 'rotate-180') })] }), isOpen && (_jsx("div", { className: "absolute z-50 w-full mt-1 bg-background-secondary border border-border rounded-lg shadow-lg max-h-60 overflow-auto", children: options.map((option) => (_jsxs("button", { type: "button", onClick: () => handleSelect(option), disabled: option.disabled, className: cn('w-full flex items-center gap-2 px-3 py-2 text-sm text-left', 'hover:bg-surface-hover transition-colors', option.value === value && 'bg-surface-elevated text-accent-cyan', option.disabled && 'opacity-50 cursor-not-allowed'), children: [option.icon, _jsx("span", { className: "flex-1", children: option.label }), option.value === value && _jsx(Check, { className: "w-4 h-4" })] }, option.value))) }))] }), error && _jsx("p", { className: "mt-1 text-xs text-red-400", children: error })] }));
}
