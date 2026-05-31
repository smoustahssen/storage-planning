import type {
  PlanResponse,
  Quarter,
  AccessGrant,
  AuditEntry,
  Person,
  Me,
} from "./types.js";

const BASE = "/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  asUser?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (asUser) headers["x-as-user"] = asUser;

  // Send the user's self-identified @roblox.com email on every request
  const userEmail = localStorage.getItem("user_email");
  if (userEmail) headers["x-user-email"] = userEmail;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, err.error ?? res.statusText);
  }
  return res.json();
}

const get = <T>(path: string, asUser?: string) =>
  request<T>("GET", path, undefined, asUser);
const post = <T>(path: string, body: unknown) => request<T>("POST", path, body);
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const put = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);

// ─── Quarters ───────────────────────────────────────────────────────────────

export const api = {
  quarters: {
    list: () => get<{ quarters: Quarter[] }>("/quarters"),
    plan: (q: string, asUser?: string) =>
      get<PlanResponse>(`/quarters/${q}/plan`, asUser),
    version: (q: string) =>
      get<{ version: number; updated_at: string }>(`/quarters/${q}/version`),
    patch: (q: string, body: { state?: string; locked?: boolean }) =>
      patch<{ ok: boolean }>(`/quarters/${q}`, body),
    copyInitiatives: (q: string, targetQuarterId: string) =>
      post<{ ok: boolean; copied: number }>(`/quarters/${q}/copy`, {
        targetQuarterId,
      }),
    audit: (q: string) =>
      get<{ entries: AuditEntry[] }>(`/quarters/${q}/audit`),
    setPriorities: (
      q: string,
      priorities: Array<{ rank: number; heading: string; body: string }>,
    ) => put<{ ok: boolean }>(`/quarters/${q}/priorities`, { priorities }),
  },

  initiatives: {
    create: (quarterId: string, body: Record<string, unknown>) =>
      post<{ id: string }>(`/quarters/${quarterId}/initiatives`, body),
    patch: (id: string, body: Record<string, unknown>) =>
      patch<{ ok: boolean }>(`/initiatives/${id}`, body),
    delete: (id: string) => del<{ ok: boolean }>(`/initiatives/${id}`),
  },

  assignments: {
    upsert: (body: {
      quarterId: string;
      rosId: string;
      initiativeId: string;
      pct: number;
    }) => post<{ id: string }>("/assignments", body),
    patch: (id: string, pct: number) =>
      patch<{ ok: boolean }>(`/assignments/${id}`, { pct }),
    delete: (id: string) => del<{ ok: boolean }>(`/assignments/${id}`),
  },

  people: {
    list: () => get<{ people: Person[] }>("/people"),
    setAvailability: (rosId: string, availability: number) =>
      put<{ ok: boolean }>(`/people/${rosId}/availability`, { availability }),
    clearAvailability: (rosId: string) =>
      del<{ ok: boolean }>(`/people/${rosId}/availability`),
    search: (q: string) =>
      get<{ people: Person[] }>(`/people/search?q=${encodeURIComponent(q)}`),
  },

  access: {
    list: () => get<{ grants: AccessGrant[] }>("/access"),
    set: (email: string, role: "admin" | "editor", scope: string) =>
      put<{ ok: boolean }>(`/access/${encodeURIComponent(email)}`, { role, scope }),
    revoke: (email: string) => del<{ ok: boolean }>(`/access/${encodeURIComponent(email)}`),
    revokeAll: () =>
      post<{ ok: boolean }>("/access/revoke-all", {}),
    me: (asUser?: string) => get<Me>("/access/me", asUser),
  },
};
