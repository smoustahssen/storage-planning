import { useState, useEffect } from "react";
import type { Me, AccessGrant, AuditEntry } from "../api/types.js";
import { api } from "../api/client.js";

interface Props {
  quarterId: string;
  me: Me;
}

const TEAMS = ["RDB-KV", "RDB-PG", "EaaS", "RaaS", "QaaS", "R3", "SIM", "MS SQL", "All"];

const MATRIX_ROWS = [
  ["View all tabs",                                  "✓",             "✓ (own team)",   "✓"],
  ["Create/edit/delete initiatives",                 "✓",             "✓ (own team)",   "—"],
  ["Commit / defer initiatives",                     "✓",             "✓ (own team)",   "—"],
  ["Manage assignments",                             "✓",             "✓ (own team)",   "—"],
  ["Lend engineers from own team",                   "✓",             "✓ (own team)",   "—"],
  ["Edit initiative theme",                          "✓",             "— (admin only)", "—"],
  ["Edit top priorities",                            "✓",             "—",              "—"],
  ["Manage access grants",                           "✓",             "—",              "—"],
  ["Lock / unlock quarters",                         "✓",             "—",              "—"],
];

export function Access({ quarterId, me }: Props) {
  const [grants, setGrants]           = useState<AccessGrant[]>([]);
  const [audit, setAudit]             = useState<AuditEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [addRosId, setAddRosId]       = useState("");
  const [addRole, setAddRole]         = useState<"admin" | "editor">("editor");
  const [addScope, setAddScope]       = useState("RDB-KV");
  const [peopleSearch, setPeopleSearch] = useState<Array<{ rosId: string; name: string; email: string }>>([]);
  const [error, setError]             = useState<string | null>(null);
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

  async function handleRevoke(rosId: string) {
    if (!confirm("Revoke access for this person?")) return;
    try { await api.access.revoke(rosId); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleSet(rosId: string, role: "admin" | "editor", scope: string) {
    try { await api.access.set(rosId, role, scope); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleRevokeAll() {
    if (!confirm("Revoke all non-admin grants?")) return;
    try { await api.access.revokeAll(); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function searchPeople(q: string) {
    if (!q) { setPeopleSearch([]); return; }
    try {
      const { people } = await api.people.search(q);
      setPeopleSearch(people.map((p) => ({ rosId: p.rosId, name: p.name, email: p.email })));
    } catch {}
  }

  async function handleAdd() {
    if (!addRosId) return;
    try { await api.access.set(addRosId, addRole, addScope); setAddRosId(""); setPeopleSearch([]); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  if (loading) return <div className="spin">Loading…</div>;

  return (
    <div>
      {error && <div style={{ background: "var(--red-soft)", color: "var(--red)", padding: "9px 14px", borderRadius: 8, marginBottom: 14, fontSize: 12 }}>{error}</div>}

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
              Revoke all non-admin
            </button>
          )}
        </div>

        {isAdmin && (
          <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 180, position: "relative" }}>
              <label className="fl">Add person</label>
              <input className="fin" type="text" placeholder="Search by name or email…"
                onChange={(e) => searchPeople(e.target.value)} />
              {peopleSearch.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 8, zIndex: 10 }}>
                  {peopleSearch.map((p) => (
                    <div key={p.rosId} style={{ padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                      onMouseDown={() => { setAddRosId(p.rosId); setPeopleSearch([]); }}>
                      {p.name} — <span style={{ color: "var(--muted)" }}>{p.email}</span>
                      {addRosId === p.rosId && " ✓"}
                    </div>
                  ))}
                </div>
              )}
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
            <button className="addbtn" onClick={handleAdd} disabled={!addRosId}>Add</button>
          </div>
        )}

        <div className="tablescroll">
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Email</th>
                <th>Role</th>
                <th>Scope</th>
                {isAdmin && <th className="th-act" />}
              </tr>
            </thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.rosId} className="rrow">
                  <td style={{ fontWeight: 500 }}>{g.name}</td>
                  <td style={{ fontSize: 12, color: "var(--muted)" }}>{g.email}</td>
                  <td>
                    {isAdmin ? (
                      <select style={{ fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, padding: "3px 6px" }}
                        value={g.role} onChange={(e) => handleSet(g.rosId, e.target.value as "admin" | "editor", g.scope)}>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`roletag ${g.role.charAt(0).toUpperCase() + g.role.slice(1)}`}>{g.role}</span>
                    )}
                  </td>
                  <td>
                    {isAdmin && g.role === "editor" ? (
                      <select style={{ fontSize: 12, border: "1px solid var(--line)", borderRadius: 6, padding: "3px 6px" }}
                        value={g.scope} onChange={(e) => handleSet(g.rosId, g.role as "admin" | "editor", e.target.value)}>
                        {TEAMS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    ) : g.scope}
                  </td>
                  {isAdmin && (
                    <td className="actcell">
                      <button className="revoke" onClick={() => handleRevoke(g.rosId)}>Revoke</button>
                    </td>
                  )}
                </tr>
              ))}
              {grants.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>No additional grants — only default viewer access</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "8px 18px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--muted)" }}>
          Everyone not listed has view-only access by default. No grant row needed.
        </div>
      </div>

      {/* ── Change log ── */}
      <div className="panel">
        <div className="ph"><h3>Change Log</h3></div>
        {audit.length === 0 ? (
          <div style={{ padding: "24px 18px", color: "var(--muted)", fontSize: 12 }}>No changes recorded yet</div>
        ) : (
          <div>
            {audit.map((entry) => (
              <div key={entry.id} className="logrow">
                <span className="who">{entry.actorName ?? entry.actorRosId}</span>
                <span style={{ flex: 1 }}>
                  <b>{entry.action}</b>
                  {" "}{entry.entity}
                  {entry.detail && (
                    <span style={{ color: "var(--muted)" }}>
                      {" — "}{typeof entry.detail === "string" ? entry.detail.slice(0, 100) : JSON.stringify(entry.detail).slice(0, 100)}
                    </span>
                  )}
                </span>
                <span className="when">{new Date(entry.ts).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
