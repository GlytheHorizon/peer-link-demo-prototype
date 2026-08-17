import { useState, useEffect, useCallback } from 'react';

/**
 * Small data-fetching hook: loads on mount (loading starts true) and exposes
 * { data, loading, error, reload }.
 */
export function useApi(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    const res = await loader(...args);
    if (res.ok) {
      setData(res.data);
    } else {
      setError(res);
    }
    setLoading(false);
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error, setData, reload: load };
}