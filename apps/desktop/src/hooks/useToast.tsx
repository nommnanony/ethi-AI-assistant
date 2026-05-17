import React, { useState, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';

export type ToastType = 'success' | 'error' | 'loading' | 'custom';

interface ToastOptions {
  duration?: number;
  icon?: string;
  style?: React.CSSProperties;
}

export function useToast() {
  const [toastId, setToastId] = useState<string | number | null>(null);

  const success = useCallback((message: string, options?: ToastOptions) => {
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

  const error = useCallback((message: string, options?: ToastOptions) => {
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

  const loading = useCallback((message: string, options?: ToastOptions) => {
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

  const dismiss = useCallback((id?: string | number) => {
    if (id !== undefined) {
      toast.dismiss(String(id));
    } else if (toastId !== null) {
      toast.dismiss(String(toastId));
    }
  }, [toastId]);

  const custom = useCallback((message: React.ReactNode, options?: ToastOptions) => {
    return toast(message as any, {
      duration: options?.duration ?? 3000,
      style: {
        background: '#161b22',
        color: '#f0f6fc',
        border: '1px solid #30363d',
        ...options?.style,
      },
    });
  }, []);

  const ToasterComponent = () => (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#161b22',
          color: '#f0f6fc',
          border: '1px solid #30363d',
        },
      }}
    />
  );

  return {
    success,
    error,
    loading,
    dismiss,
    custom,
    Toaster: ToasterComponent,
  };
}
