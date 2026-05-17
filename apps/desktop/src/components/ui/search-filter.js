import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Input } from './input';
import { cn } from '../../lib/utils';
import { Search, X, Filter } from 'lucide-react';
import { Button } from './button';
export function SearchFilter({ placeholder = 'Search...', value, onChange, filters = [], onSearch, className, }) {
    const [showFilters, setShowFilters] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    const hasActiveFilters = useMemo(() => filters.some((f) => f.value !== null), [filters]);
    const handleSearch = () => {
        onChange(localValue);
        onSearch?.();
    };
    const handleClear = () => {
        setLocalValue('');
        onChange('');
        filters.forEach((f) => f.onChange(null));
    };
    return (_jsxs("div", { className: cn('space-y-3', className), children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("div", { className: "relative flex-1", children: [_jsx(Input, { value: localValue, onChange: (e) => setLocalValue(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleSearch(), placeholder: placeholder, leftIcon: _jsx(Search, { className: "w-4 h-4" }), className: "pr-20" }), _jsxs("div", { className: "absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1", children: [localValue && (_jsx("button", { onClick: handleClear, className: "p-1 rounded hover:bg-surface-hover text-text-muted", children: _jsx(X, { className: "w-4 h-4" }) })), onSearch && (_jsx(Button, { variant: "ghost", size: "sm", onClick: handleSearch, className: "h-7 px-2", children: "Search" }))] })] }), filters.length > 0 && (_jsxs(Button, { variant: showFilters || hasActiveFilters ? 'primary' : 'outline', onClick: () => setShowFilters(!showFilters), leftIcon: _jsx(Filter, { className: "w-4 h-4" }), children: ["Filters", hasActiveFilters && (_jsx("span", { className: "ml-1 px-1.5 py-0.5 text-xs bg-accent-cyan/20 rounded-full", children: filters.filter((f) => f.value).length }))] }))] }), showFilters && filters.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-3 p-3 bg-surface-elevated rounded-lg border border-border", children: filters.map((filter) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-sm text-text-muted", children: [filter.label, ":"] }), _jsxs("select", { value: filter.value || '', onChange: (e) => filter.onChange(e.target.value || null), className: "px-2 py-1 bg-background border border-border rounded text-sm text-text-primary", children: [_jsx("option", { value: "", children: "All" }), filter.options.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value)))] })] }, filter.label))) }))] }));
}
