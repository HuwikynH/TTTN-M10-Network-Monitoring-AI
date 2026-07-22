import { useCallback, useEffect, useRef, useState } from "react";

export function getRefreshInterval() {
  const parsed = Number(import.meta.env.VITE_REFRESH_INTERVAL_MS);
  return Number.isFinite(parsed) && parsed >= 3000 ? parsed : 5000;
}

export default function useAutoRefresh(task, options = {}) {
  const intervalMs = options.intervalMs ?? getRefreshInterval();
  const enabled = options.enabled ?? true;
  const [paused, setPaused] = useState(options.initiallyPaused ?? false);
  const [isInitialLoading, setIsInitialLoading] = useState(enabled && !paused);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSuccessAt, setLastSuccessAt] = useState(null);
  const taskRef = useRef(task);
  const mountedRef = useRef(false);
  const controllerRef = useRef(null);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const hasAttemptedRef = useRef(false);
  taskRef.current = task;

  const execute = useCallback(async ({ replace = false } = {}) => {
    if (!mountedRef.current || !enabled || paused || document.visibilityState === "hidden") return;
    if (inFlightRef.current) {
      if (!replace) return;
      controllerRef.current?.abort();
    }
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    inFlightRef.current = true;
    if (hasAttemptedRef.current) setIsRefreshing(true);
    else setIsInitialLoading(true);
    try {
      await taskRef.current(controller.signal);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      hasAttemptedRef.current = true;
      setLastSuccessAt(new Date());
      setError(null);
    } catch (requestError) {
      if (requestError.name !== "AbortError" && mountedRef.current && requestId === requestIdRef.current) {
        hasAttemptedRef.current = true;
        setError(requestError);
      }
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) {
        inFlightRef.current = false;
        setIsInitialLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [enabled, paused]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || paused) {
      setIsInitialLoading(false);
      controllerRef.current?.abort();
      return () => { mountedRef.current = false; };
    }
    execute();
    const timerId = window.setInterval(() => execute(), intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") controllerRef.current?.abort();
      else execute({ replace: true });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      mountedRef.current = false;
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controllerRef.current?.abort();
      inFlightRef.current = false;
    };
  }, [enabled, execute, intervalMs, paused]);

  return {
    error,
    isInitialLoading,
    isRefreshing,
    lastSuccessAt,
    paused,
    pause: useCallback(() => setPaused(true), []),
    refresh: useCallback(() => execute({ replace: true }), [execute]),
    resume: useCallback(() => setPaused(false), []),
    setPaused,
    togglePaused: useCallback(() => setPaused((current) => !current), []),
  };
}
