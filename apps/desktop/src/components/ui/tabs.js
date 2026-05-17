import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { cn } from '../../lib/utils';
export function Tabs({ tabs, activeTab, onChange, className, variant = 'default' }) {
    const getContainerClass = () => {
        switch (variant) {
            case 'pills':
                return 'flex gap-2';
            case 'underline':
                return 'flex gap-4';
            default:
                return 'flex border-b border-border';
        }
    };
    const getTabClass = (isActive) => {
        const baseClass = 'px-4 py-2 text-sm font-medium transition-colors';
        switch (variant) {
            case 'pills':
                return cn(baseClass, 'rounded-md', isActive
                    ? 'bg-accent-cyan/20 text-accent-cyan'
                    : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover');
            case 'underline':
                return cn(baseClass, 'border-b-2', isActive
                    ? 'text-accent-cyan border-accent-cyan'
                    : 'text-text-muted hover:text-text-secondary border-transparent');
            default:
                return cn(baseClass, 'relative', isActive ? 'text-accent-cyan' : 'text-text-muted hover:text-text-secondary');
        }
    };
    return (_jsx("div", { className: cn(getContainerClass(), className), children: tabs.map((tab) => (_jsx("button", { onClick: () => !tab.disabled && onChange(tab.id), disabled: tab.disabled, className: cn(getTabClass(activeTab === tab.id), tab.disabled && 'opacity-50 cursor-not-allowed'), children: _jsxs("span", { className: "flex items-center gap-2", children: [tab.icon, tab.label] }) }, tab.id))) }));
}
