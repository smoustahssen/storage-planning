import { useState, useEffect } from "react";
import type { Me, AccessGrant, AuditEntry } from "../api/types.js";
import { api } from "../api/client.js";

interface Props {
  quarterId: string;
  me: Me;
}

const TEAMS = ["RDB-KV", "RDB-PG", "EaaS", "RaaS", "QaaS", "R3", "SIM", "MS SQL", "All"];

function timeAgo(ts: string): string {
  const date = new Date(ts + "Z");
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return "just now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 12)  return `${h}h ago`;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function describeEntry(action: string, d: any): string {
  switch (action) {
    case "initiative.create":
      return `Created "${d.name}" in ${d.team} · ${d.theme}${d.pri ? ` · ${d.pri}` : ""}`;
    case "initiative.delete":
      return d.name ? `Deleted "${d.name}" (${d.team})` : "Deleted an initiative";
    case "initiative.patch": {
      const label = d._name ? `"${d._name}"` : "an initiative";
      const fields = Object.keys(d).filter((k) => !k.startsWith("_"));
      if (fields.length === 1 && fields[0] === "status") {
        return d.status === "committed" ? `Committed ${label}` : `Deferred ${label} to backlog`;
      }
      return fields.length ? `Updated ${label} — changed ${fields.join(", ")}` : `Updated ${label}`;
    }
    case "assignment.create":
      return `Assigned ${d.personName ?? d.rosId} to "${d.initiativeName ?? d.initiativeId}" — ${Math.round((d.pct ?? 0) * 100)}%`;
    case "assignment.update":
      return `Updated ${d.personName ?? d.rosId ?? "someone"}'s allocation on "${d.initiativeName ?? d.initiativeId ?? "an initiative"}" → ${Math.round((d.pct ?? 0) * 100)}%`;
    case "assignment.delete":
      return d.personName && d.initiativeName
        ? `Removed ${d.personName} from "${d.initiativeName}"`
        : "Removed an assignment";
    case "quarter.patch":
      if (d.locked === 1 || d.locked === true)  return "Locked the quarter";
      if (d.locked === 0 || d.locked === false) return "Unlocked the quarter";
      return "Updated quarter settings";
    case "priorities.set":
      return `Updated priorities (${d.count} item${d.count === 1 ? "" : "s"})`;
    default:
      return action;
  }
}

const MATRIX_ROWS = [
  ["View all tabs",                     "✓",             "✓ (own team)",   "✓"],
  ["Create/edit/delete initiatives",    "✓",             "✓ (own team)",   "—"],
  ["Commit / defer initiatives",        "✓",             "✓ (own team)",   "—"],
  ["Manage assignments",                "✓",             "✓ (own team)",   "—"],
  ["Lend engineers from own team",      "✓",             "✓ (own team)",   "—"],
  ["Edit initiative theme",             "✓",             "— (admin only)", "—"],
  ["Edit top priorities",               "✓",             "—",              "—"],
  ["Manage access grants",              "✓",             "—",              "—"],
  ["Lock / unlock quarters",            "✓",             "—",              "—"],
];

export function Access({ quarterId, me }: Props) {
  const [grants, setGrants]   = useState<AccessGrant[]>([]);
  const [audit, setAudit]     = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole]   = useState<"admin" | "editor">("editor");
  const [addScope, setAddScope] = useState("RDB-KV");
  const [error, setError]       = useState<string | null>(null);
  const isAdmin = me.role === "admin";

  async function load() {
    const [{ grants }, { entries }] = await Promise.all([
      api.access.list(),
      api.quarters.audit(quarterId),
    ]);
    setGrants(grants);
    setAudit(entries);
  }

  useEffect(() => { load().catch(console.error).finally(() => setLoading(false)); }, [quarterId]);

  async function handleRevoke(email: string) {
    if (!confirm(`Revoke elevated access for ${email}? They'll go back to viewer.`)) return;
    try { await api.access.revoke(email); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleSet(email: string, role: "admin" | "editor", scope: string) {
    try { await api.access.set(email, role, scope); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleRevokeAll() {
    if (!confirm("Revoke all editor access? Admins are kept.")) return;
    try { await api.access.revokeAll(); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleAdd() {
    const email = addEmail.trim().toLowerCase();
    if (!email.endsWith("@roblox.com")) {
      setError("Must be a @roblox.com email");
      return;
    }
    try {
      await api.access.set(email, addRole, addRole === "admin" ? "All" : addScope);
      setAddEmail("");
      setError(null);
      load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  if (loading) return <div className="spin">Loading…</div>;

  return (
    <div>
      {error && (
        <div style={{ background: "var(--red-soft)", color: "var(--red)", padding: "9px 14px", borderRadius: 8, marginBottom: 14, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* ── Role matrix ── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="ph"><h3>Role Capability Matrix</h3></div>
        <div className="tablescroll">
          <table className="matrix">
            <thead>
              <tr>
                <th>Action</th>
                <th>Admin</th>
                <th>Scoped Editor</th>
                <th>Viewer</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map(([action, admin, editor, viewer]) => (
                <tr key={action} className="rrow">
                  <td>{action}</td>
                  <td><span className={`perm ${admin === "✓" ? "edit" : "no"}`}>{admin === "✓" ? "✓" : "—"}</span></td>
                  <td><span className={`perm ${editor?.startsWith("✓") ? "view" : "no"}`}>{editor}</span></td>
                  <td><span className={`perm ${viewer === "✓" ? "view" : "no"}`}>{viewer === "✓" ? "✓" : "—"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── People & access ── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="ph">
          <h3>People &amp; Access</h3>
          {isAdmin && (
            <button className="warnbtn" style={{ marginLeft: "auto" }} onClick={handleRevokeAll}>
              Revoke all editors
            </button>
          )}
        </div>

        {isAdmin && (
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 220 }}>
              <label className="fl">Grant access — @roblox.com email</label>
              <input
                className="fin"
                type="email"
                placeholder="name@roblox.com"
                value={addEmail}
                onChange={(e) => { setAddEmail(e.target.value); setError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div style={{ width: 120 }}>
              <label className="fl">Role</label>
              <select className="fin" value={addRole} onChange={(e) => setAddRole(e.target.value as "admin" | "editor")}>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {addRole === "editor" && (
              <div style={{ width: 120 }}>
                <label className="fl">Scope</label>
                <select className="fin" value={addScope} onChange={(e) => setAddScope(e.target.value)}>
                  {TEAMS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            )}
            <button className="addbtn" onClick={handleAdd} disabled={!addEmail}>Grant</button>
          </div>
        )}

        <div className="tablescroll">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Scope</th>
                {isAdmin && <th className="th-act" />}
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.email} className="rrow">
                  <td style={{ fontWeight: 500 }}>{g.email}</td>
                  <td>
                    {isAdmin ? (
                      <select
                        style={{ fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, padding: "3px 6px" }}
                        value={g.role}
                        onChange={(e) => handleSet(g.email, e.target.value as "admin" | "editor", g.scope)}
                      >
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`roletag ${g.role.charAt(0).toUpperCase() + g.role.slice(1)}`}>{g.role}</span>
                    )}
                  </td>
                  <td>
                    {isAdmin && g.role === "editor" ? (
                      <select
                        style={{ fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, padding: "3px 6px" }}
                        value={g.scope}
                        onChange={(e) => handleSet(g.email, g.role as "admin" | "editor", e.target.value)}
                      >
                        {TEAMS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    ) : g.scope}
                  </td>
                  {isAdmin && (
                    <td className="actcell">
                      <button className="revoke" onClick={() => handleRevoke(g.email)}>Revoke</button>
                    </td>
                  )}
                </tr>
              ))}
              {grants.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>No elevated grants yet — all @roblox.com employees have viewer access</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "8px 18px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--muted)" }}>
          All @roblox.com employees have view-only access by default. Only elevated grants are listed here.
        </div>
      </div>

      {/* ── Change log ── */}
      <div className="panel">
        <div className="ph"><h3>Change Log</h3></div>
        {audit.length === 0 ? (
          <div style={{ padding: "24px 18px", color: "var(--muted)", fontSize: 12 }}>No changes recorded yet</div>
        ) : (
          <div>
            {audit.map((entry) => {
              const d = (() => { try { return JSON.parse(entry.detail); } catch { return {}; } })();
              const desc = describeEntry(entry.action, d);
              return (
                <div key={entry.id} className="logrow">
                  <span className="who">{(entry.actorName ?? entry.actorRosId).replace(/@roblox\.com$/, "")}</span>
                  <span style={{ flex: 1 }}>{desc}</span>
                  <span className="when" title={new Date(entry.ts).toLocaleString()}>{timeAgo(entry.ts)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
