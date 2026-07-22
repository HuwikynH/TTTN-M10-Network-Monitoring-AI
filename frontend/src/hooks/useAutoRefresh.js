import { useCallback, useEffect, useRef, useState } from "react";

export function getRefreshInterval() {
  const parsed = Number(import.meta.env.VITE_REFRESH_INTERVAL_MS);
  return Number.isFinite(parsed) && parsed >= 3000 ? parsed : 5000;
}

export default function useAutoRefresh(task, options = {}) {
  const intervalMs = options.intervalMs ?? getRefreshInterval();
  const enabled = options.enabled ?? true;
  const refreshOnResume = options.refreshOnResume ?? true;
  const [paused, setPausedState] = useState(options.initiallyPaused ?? false);
  const [isInitialLoading, setIsInitialLoading] = useState(enabled && !paused);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSuccessAt, setLastSuccessAt] = useState(null);
  const taskRef = useRef(task);
  const enabledRef = useRef(enabled);
  const pausedRef = useRef(paused);
  const mountedRef = useRef(false);
  const controllerRef = useRef(null);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const hasAttemptedRef = useRef(false);
  taskRef.current = task;
  enabledRef.current = enabled;
  pausedRef.current = paused;

  const execute = useCallback(async ({ replace = false, force = false } = {}) => {
    if (!mountedRef.current || document.visibilityState === "hidden") return;
    if (!force && (!enabledRef.current || pausedRef.current)) return;
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
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      inFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || paused) {
      controllerRef.current?.abort();
      setIsRefreshing(false);
      if (!hasAttemptedRef.current) setIsInitialLoading(false);
      return undefined;
    }
    if (!hasAttemptedRef.current || refreshOnResume) execute({ replace: true });
    const timerId = window.setInterval(() => execute(), intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") controllerRef.current?.abort();
      else execute({ replace: true });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timerId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, execute, intervalMs, paused, refreshOnResume]);

  const setPaused = useCallback((value) => {
    setPausedState((current) => {
      const next = typeof value === "function" ? value(current) : value;
      pausedRef.current = next;
      if (next) controllerRef.current?.abort();
      return next;
    });
  }, []);

  const pause = useCallback(() => setPaused(true), [setPaused]);
  const resume = useCallback(() => setPaused(false), [setPaused]);
  const refresh = useCallback(() => execute({ replace: true, force: true }), [execute]);
  const togglePaused = useCallback(() => setPaused((current) => !current), [setPaused]);

  return {
    error,
    initialLoading: isInitialLoading,
    isInitialLoading,
    refreshing: isRefreshing,
    isRefreshing,
    lastSuccessAt,
    paused,
    pause,
    refresh,
    resume,
    setPaused,
    togglePaused,
  };
}
