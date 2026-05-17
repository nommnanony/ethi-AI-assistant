import { useState, useCallback } from 'react';
export function useApi(options) {
    const [state, setState] = useState({
        data: null,
        error: null,
        isLoading: false,
    });
    const execute = useCallback(async (promise) => {
        setState({ data: null, error: null, isLoading: true });
        try {
            const data = await promise;
            setState({ data, error: null, isLoading: false });
            options?.onSuccess?.(data);
            return data;
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setState({ data: null, error, isLoading: false });
            options?.onError?.(error);
            throw error;
        }
    }, [options]);
    const reset = useCallback(() => {
        setState({ data: null, error: null, isLoading: false });
    }, []);
    return {
        ...state,
        execute,
        reset,
    };
}
export function useAsync(asyncFunction, _immediate = true) {
    const [status, setStatus] = useState('idle');
    const [value, setValue] = useState(null);
    const [error, setError] = useState(null);
    const execute = useCallback(async (...params) => {
        setStatus('pending');
        setValue(null);
        setError(null);
        try {
            const response = await asyncFunction(...params);
            setValue(response);
            setStatus('success');
            return response;
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setStatus('error');
            throw err;
        }
    }, [asyncFunction]);
    return {
        execute,
        status,
        value,
        error,
        isLoading: status === 'pending',
        isSuccess: status === 'success',
        isError: status === 'error',
    };
}
