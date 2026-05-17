import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { X } from 'lucide-react';
import { Button } from './button';
export function Modal({ isOpen, onClose, title, description, children, size = 'md', showCloseButton = true, closeOnOverlayClick = true, closeOnEscape = true, className, }) {
    const overlayRef = useRef(null);
    useEffect(() => {
        if (!isOpen)
            return;
        const handleEscape = (e) => {
            if (e.key === 'Escape' && closeOnEscape) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, closeOnEscape, onClose]);
    if (!isOpen)
        return null;
    const sizes = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-4xl',
    };
    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current && closeOnOverlayClick) {
            onClose();
        }
    };
    return createPortal(_jsx("div", { ref: overlayRef, onClick: handleOverlayClick, className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200", children: _jsxs("div", { className: cn('w-full mx-4 bg-background-secondary border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200', sizes[size], className), children: [(title || showCloseButton) && (_jsxs("div", { className: "flex items-start justify-between p-4 border-b border-border", children: [_jsxs("div", { children: [title && _jsx("h2", { className: "text-lg font-semibold text-text-primary", children: title }), description && _jsx("p", { className: "mt-1 text-sm text-text-muted", children: description })] }), showCloseButton && (_jsx(Button, { variant: "ghost", size: "icon", onClick: onClose, className: "text-text-muted hover:text-text-primary", children: _jsx(X, { className: "w-4 h-4" }) }))] })), _jsx("div", { className: "p-4", children: children })] }) }), document.body);
}
