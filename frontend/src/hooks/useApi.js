import { useState, useEffect, useCallback } from 'react';

/**
 * Small data-fetching hook: loads on mount (loading starts true) and exposes
 * { data, loading, error, reload, load }.
 * - reload() sets loading=true (spinner) then refetches.
 * - load() refetches silently, for background polling.
 * - Pass interval (ms) to auto-refresh; the poll is silent so no spinner flashes.
 */
export function useApi(loader, deps = [], interval = 0) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (...args) => {
    const res = await loader(...args);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      setError(res);
    }
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    const res = await load(...args);
    setLoading(false);
    return res;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!interval) return undefined;
    const t = setInterval(() => { load(); }, interval);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, load]);

  return { data, loading, error, setData, reload, load };
}