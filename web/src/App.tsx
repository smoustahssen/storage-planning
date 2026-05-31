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
    items: [{ id: "exec" as ViewId, icon: "◳", label: "Executive dashboard" }],
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
    items: [{ id: "access" as ViewId, icon: "⚿", label: "Access & audit" }],
  },
];

export default function App() {
  const [view, setView]           = useState<ViewId>("exec");
  const [editMode, setEditMode]   = useState(false);
  const [asUser, setAsUser]       = useState<string | undefined>(undefined);

  // Email stored in localStorage — shown on first visit
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem("user_email") ?? "");
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");

  const quarters = useQuarters(userEmail);
  const currentQuarterId =
    quarters.find((q) => q.state === "current")?.id ?? quarters[0]?.id ?? "2026Q3";
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");

  useEffect(() => {
    if (currentQuarterId && !selectedQuarter) setSelectedQuarter(currentQuarterId);
  }, [currentQuarterId]);

  const quarterId = selectedQuarter || currentQuarterId;
  const me        = useMe(userEmail, asUser);
  const { plan, loading, error, reload } = usePlan(quarterId, userEmail, asUser);

  const selectedQ = quarters.find((q) => q.id === quarterId);

  useEffect(() => {
    document.body.setAttribute("data-edit", editMode ? "true" : "");
    if (!editMode) document.body.removeAttribute("data-edit");
  }, [editMode]);

  const canEdit = me?.role === "admin" || (me?.role === "editor" && !selectedQ?.locked);

  const qStateLabel =
    selectedQ?.state === "current"  ? "Active" :
    selectedQ?.state === "previous" ? "Closed" : "Draft";
  const qStateCls =
    selectedQ?.state === "current"  ? "active" :
    selectedQ?.state === "previous" ? "closed" : "draft";

  // ── Email prompt (first visit) ────────────────────────────────────────────
  if (!userEmail) {
    function handleSubmit(e: React.FormEvent) {
      e.preventDefault();
      const trimmed = emailInput.trim().toLowerCase();
      if (!trimmed.endsWith("@roblox.com")) {
        setEmailError("Must be a @roblox.com email address");
        return;
      }
      localStorage.setItem("user_email", trimmed);
      setUserEmail(trimmed);
    }

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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, width: 320 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
            Enter your Roblox email to continue
          </label>
          <input
            type="email"
            autoFocus
            placeholder="yourname@roblox.com"
            value={emailInput}
            onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
            style={{
              padding: "9px 12px", borderRadius: 8, fontSize: 14,
              border: "1px solid var(--line)", outline: "none",
              color: "var(--ink)", background: "#fff",
            }}
          />
          {emailError && (
            <div style={{ fontSize: 12, color: "#b91c1c" }}>{emailError}</div>
          )}
          <button type="submit" style={{
            padding: "9px 0", borderRadius: 8, fontSize: 14, fontWeight: 500,
            background: "var(--petrol)", color: "#fff", border: "none", cursor: "pointer",
          }}>
            Continue
          </button>
        </form>

        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          All @roblox.com employees have view access by default
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
          <div className="nm">Storage planner<small>portfolio roadmap</small></div>
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
            <h1>{NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.id === view)?.label}</h1>
            <span>Storage Platform Engineering</span>
          </div>

          <div className="right">
            <div className="pick">
              <label>Quarter</label>
              <select value={quarterId} onChange={(e) => setSelectedQuarter(e.target.value)}>
                {quarters.map((q) => (
                  <option key={q.id} value={q.id}>{q.label}</option>
                ))}
              </select>
            </div>

            {selectedQ && (
              <span className={`qstate ${qStateCls}`}>{qStateLabel}</span>
            )}

            {me && (
              <span className={`roletag ${me.role.charAt(0).toUpperCase() + me.role.slice(1)}`}>
                {me.role.charAt(0).toUpperCase() + me.role.slice(1)}
              </span>
            )}

            {canEdit && (
              <button
                className={`editbtn${editMode ? " on" : ""}`}
                onClick={() => setEditMode((v) => !v)}
              >
                {editMode ? "✎ Editing" : "✎ Edit"}
              </button>
            )}

            {me?.role === "admin" && (
              <input
                type="text"
                placeholder="View as rosId…"
                style={{
                  fontSize: 12, padding: "5px 9px", borderRadius: 15,
                  border: "1px solid var(--line)", background: "#fff",
                  color: "var(--ink)", width: 180,
                }}
                value={asUser ?? ""}
                onChange={(e) => setAsUser(e.target.value || undefined)}
              />
            )}

            {/* Sign out — clears localStorage and reloads */}
            <button
              style={{
                fontSize: 12, padding: "5px 10px", borderRadius: 15,
                border: "1px solid var(--line)", background: "transparent",
                color: "var(--muted)", cursor: "pointer",
              }}
              onClick={() => {
                localStorage.removeItem("user_email");
                window.location.reload();
              }}
            >
              {userEmail} · Sign out
            </button>
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
              {view === "roadmap"  && <Roadmap   plan={plan} me={me} onReload={reload} editMode={editMode} />}
              {view === "capacity" && <Capacity  plan={plan} me={me} onReload={reload} editMode={editMode} />}
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
