import { useState, useEffect } from "react";
import React from "react";
import { usePlan, useMe, useQuarters } from "./hooks/usePlan.js";
import { Dashboard } from "./tabs/Dashboard.js";
import { Roadmap } from "./tabs/Roadmap.js";
import { Capacity } from "./tabs/Capacity.js";
import { Lending } from "./tabs/Lending.js";
import { Backlog } from "./tabs/Backlog.js";
import { Access } from "./tabs/Access.js";

type ViewId = "exec" | "roadmap" | "capacity" | "lending" | "backlog" | "access";

const NAV_SECTIONS = [
  {
    label: "Report",
    items: [
      { id: "exec" as ViewId, icon: "◳", label: "Executive dashboard" },
    ],
  },
  {
    label: "Plan & build",
    items: [
      { id: "roadmap"  as ViewId, icon: "▤", label: "Roadmap" },
      { id: "capacity" as ViewId, icon: "◫", label: "Capacity & staffing" },
      { id: "lending"  as ViewId, icon: "⇄", label: "Lending flows" },
      { id: "backlog"  as ViewId, icon: "☰", label: "Backlog" },
    ],
  },
  {
    label: "Govern",
    items: [
      { id: "access" as ViewId, icon: "⚿", label: "Access & audit" },
    ],
  },
];

// Show an error hint from the URL if GitHub OAuth redirected with ?auth_error=
function getAuthError(): string | null {
  const p = new URLSearchParams(window.location.search);
  const code = p.get("auth_error");
  if (!code) return null;
  const msgs: Record<string, string> = {
    github_denied:         "GitHub sign-in was cancelled.",
    token_exchange_failed: "Could not exchange GitHub token — please try again.",
    email_fetch_failed:    "Could not fetch your GitHub emails — make sure your @roblox.com email is verified on GitHub.",
    no_roblox_email:       "No verified @roblox.com email found on your GitHub account.",
    not_in_directory:      "Your @roblox.com email is not in the org directory yet — ask an admin to add you.",
  };
  return msgs[code] ?? `Sign-in error: ${code}`;
}

export default function App() {
  const [view, setView]         = useState<ViewId>("exec");
  const [editMode, setEditMode] = useState(false);
  const [asUser, setAsUser]     = useState<string | undefined>(undefined);

  const quarters = useQuarters();
  const currentQuarterId =
    quarters.find((q) => q.state === "current")?.id ?? quarters[0]?.id ?? "2026Q3";
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");

  useEffect(() => {
    if (currentQuarterId && !selectedQuarter) setSelectedQuarter(currentQuarterId);
  }, [currentQuarterId]);

  const quarterId  = selectedQuarter || currentQuarterId;
  const { me, unauthenticated } = useMe(asUser);
  const { plan, loading, error, reload } = usePlan(quarterId, asUser);

  const selectedQ = quarters.find((q) => q.id === quarterId);

  useEffect(() => {
    if (editMode) {
      document.body.setAttribute("data-edit", "true");
    } else {
      document.body.removeAttribute("data-edit");
    }
  }, [editMode]);

  const canEdit =
    me?.role === "admin" || (me?.role === "editor" && !selectedQ?.locked);

  const qStateLabel =
    selectedQ?.state === "current"  ? "Active"  :
    selectedQ?.state === "previous" ? "Closed"  : "Draft";
  const qStateCls =
    selectedQ?.state === "current"  ? "active"  :
    selectedQ?.state === "previous" ? "closed"  : "draft";

  // ── Login screen (shown when session is missing / expired) ────────────────
  if (unauthenticated) {
    const authErrorMsg = getAuthError();
    return (
      <div style={{
        height: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 24,
        background: "var(--paper)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "var(--petrol)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "#fff",
          }}>S</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>Storage Planner</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Storage Platform Engineering</div>
          </div>
        </div>

        {authErrorMsg && (
          <div style={{
            padding: "10px 16px", background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: 8, fontSize: 13, color: "#b91c1c", maxWidth: 340, textAlign: "center",
          }}>
            {authErrorMsg}
          </div>
        )}

        <a
          href="/auth/github"
          style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 500,
            background: "#24292f", color: "#fff", textDecoration: "none",
            border: "none", cursor: "pointer",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 98 96" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/>
          </svg>
          Sign in with GitHub
        </a>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          Sign in with your @roblox.com GitHub account
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside>
        <div className="brand">
          <div className="sq">S</div>
          <div className="nm">
            Storage planner<small>portfolio roadmap</small>
          </div>
        </div>

        {NAV_SECTIONS.map((section) => (
          <React.Fragment key={section.label}>
            <div className="navlbl">{section.label}</div>
            {section.items.map((item) => (
              <div
                key={item.id}
                className={`nav${view === item.id ? " active" : ""}`}
                onClick={() => setView(item.id)}
              >
                <span className="ic">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </React.Fragment>
        ))}

        <div className="foot">
          10 services · 8 delivery teams<br />
          HC = sum of assignments
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────── */}
      <main>
        <header>
          <div className="title">
            <h1>
              {NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.id === view)?.label}
            </h1>
            <span>Storage Platform Engineering</span>
          </div>

          <div className="right">
            {/* Quarter picker */}
            <div className="pick">
              <label>Quarter</label>
              <select
                value={quarterId}
                onChange={(e) => setSelectedQuarter(e.target.value)}
              >
                {quarters.map((q) => (
                  <option key={q.id} value={q.id}>{q.label}</option>
                ))}
              </select>
            </div>

            {/* Quarter state badge */}
            {selectedQ && (
              <span className={`qstate ${qStateCls}`}>{qStateLabel}</span>
            )}

            {/* Role tag */}
            {me && (
              <span className={`roletag ${me.role.charAt(0).toUpperCase() + me.role.slice(1)}`}>
                {me.role.charAt(0).toUpperCase() + me.role.slice(1)}
              </span>
            )}

            {/* Edit mode toggle — only visible when user can edit */}
            {canEdit && (
              <button
                className={`editbtn${editMode ? " on" : ""}`}
                onClick={() => setEditMode((v) => !v)}
              >
                {editMode ? "✎ Editing" : "✎ Edit"}
              </button>
            )}

            {/* Admin "as" impersonation */}
            {me?.role === "admin" && (
              <input
                type="text"
                placeholder="View as rosId…"
                style={{
                  fontSize: 12,
                  padding: "5px 9px",
                  borderRadius: 15,
                  border: "1px solid var(--line)",
                  background: "#fff",
                  color: "var(--ink)",
                  width: 180,
                }}
                value={asUser ?? ""}
                onChange={(e) => setAsUser(e.target.value || undefined)}
              />
            )}

            {/* Sign out */}
            {me && (
              <button
                style={{
                  fontSize: 12, padding: "5px 10px", borderRadius: 15,
                  border: "1px solid var(--line)", background: "transparent",
                  color: "var(--muted)", cursor: "pointer",
                }}
                onClick={async () => {
                  await fetch("/auth/logout", { method: "POST", credentials: "include" });
                  window.location.reload();
                }}
              >
                Sign out
              </button>
            )}
          </div>
        </header>

        <div className="scroll">
          {loading ? (
            <div className="spin">Loading plan…</div>
          ) : error ? (
            <div className="error-msg">{error}</div>
          ) : !plan || !me ? (
            <div className="spin">Initializing…</div>
          ) : (
            <>
              {view === "exec"     && <Dashboard plan={plan} me={me} onReload={reload} />}
              {view === "roadmap"  && <Roadmap   plan={plan} me={me} onReload={reload} />}
              {view === "capacity" && <Capacity  plan={plan} me={me} onReload={reload} />}
              {view === "lending"  && <Lending   plan={plan} me={me} onReload={reload} />}
              {view === "backlog"  && <Backlog   plan={plan} me={me} onReload={reload} />}
              {view === "access"   && <Access    quarterId={quarterId} me={me} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
