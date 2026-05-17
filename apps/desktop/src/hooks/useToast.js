import { jsx as _jsx } from "react/jsx-runtime";
import { useState, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
export function useToast() {
    const [toastId, setToastId] = useState(null);
    const success = useCallback((message, options) => {
        return toast.success(message, {
            duration: options?.duration ?? 3000,
            style: {
                background: '#161b22',
                color: '#f0f6fc',
                border: '1px solid #30363d',
                ...options?.style,
            },
        });
    }, []);
    const error = useCallback((message, options) => {
        return toast.error(message, {
            duration: options?.duration ?? 4000,
            style: {
                background: '#161b22',
                color: '#f85149',
                border: '1px solid #f85149',
                ...options?.style,
            },
        });
    }, []);
    const loading = useCallback((message, options) => {
        const id = toast.loading(message, {
            style: {
                background: '#161b22',
                color: '#f0f6fc',
                border: '1px solid #30363d',
                ...options?.style,
            },
        });
        setToastId(id);
        return id;
    }, []);
    const dismiss = useCallback((id) => {
        if (id !== undefined) {
            toast.dismiss(String(id));
        }
        else if (toastId !== null) {
            toast.dismiss(String(toastId));
        }
    }, [toastId]);
    const custom = useCallback((message, options) => {
        return toast(message, {
            duration: options?.duration ?? 3000,
            style: {
                background: '#161b22',
                color: '#f0f6fc',
                border: '1px solid #30363d',
                ...options?.style,
            },
        });
    }, []);
    const ToasterComponent = () => (_jsx(Toaster, { position: "bottom-right", toastOptions: {
            style: {
                background: '#161b22',
                color: '#f0f6fc',
                border: '1px solid #30363d',
            },
        } }));
    return {
        success,
        error,
        loading,
        dismiss,
        custom,
        Toaster: ToasterComponent,
    };
}
