import { useState, useEffect, useCallback, useRef } from "react";
import { api, ApiError } from "../api/client.js";
import type { PlanResponse, Me, Quarter } from "../api/types.js";

const POLL_INTERVAL_MS = 5000;

export function usePlan(quarterId: string, asUser?: string) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef<number>(0);

  const reload = useCallback(async () => {
    try {
      const data = await api.quarters.plan(quarterId, asUser);
      setPlan(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    }
  }, [quarterId, asUser]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload]);

  // Live-update polling
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { version } = await api.quarters.version(quarterId);
        if (version !== versionRef.current) {
          versionRef.current = version;
          await reload();
        }
      } catch {
        // Polling failures are silent
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [quarterId, reload]);

  return { plan, loading, error, reload };
}

export function useMe(asUser?: string): { me: Me | null; unauthenticated: boolean } {
  const [me, setMe] = useState<Me | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);

  useEffect(() => {
    api.access.me(asUser)
      .then((data) => { setMe(data); setUnauthenticated(false); })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setUnauthenticated(true);
        }
      });
  }, [asUser]);

  return { me, unauthenticated };
}

export function useQuarters() {
  const [quarters, setQuarters] = useState<Quarter[]>([]);

  useEffect(() => {
    api.quarters.list().then(({ quarters }) => setQuarters(quarters)).catch(console.error);
  }, []);

  return quarters;
}
