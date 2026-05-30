import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api/client.js";
import type { PlanResponse, Me, Quarter } from "../api/types.js";

const POLL_INTERVAL_MS = 5000;

export function usePlan(quarterId: string, userEmail: string, asUser?: string) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const versionRef = useRef<number>(0);

  const reload = useCallback(async () => {
    if (!userEmail) return;
    try {
      const data = await api.quarters.plan(quarterId, asUser);
      setPlan(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    }
  }, [quarterId, userEmail, asUser]);

  useEffect(() => {
    if (!userEmail) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [reload, userEmail]);

  useEffect(() => {
    if (!userEmail) return;
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
  }, [quarterId, userEmail, reload]);

  return { plan, loading, error, reload };
}

export function useMe(userEmail: string, asUser?: string): Me | null {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!userEmail) return;
    api.access.me(asUser).then(setMe).catch(console.error);
  }, [userEmail, asUser]);

  return me;
}

export function useQuarters(userEmail: string) {
  const [quarters, setQuarters] = useState<Quarter[]>([]);

  useEffect(() => {
    if (!userEmail) return;
    api.quarters.list().then(({ quarters }) => setQuarters(quarters)).catch(console.error);
  }, [userEmail]);

  return quarters;
}
