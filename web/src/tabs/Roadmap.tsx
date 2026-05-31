import { useState } from "react";
import type { PlanResponse, Initiative, Me } from "../api/types.js";
import { ThemeChip, TeamBadge } from "../components/ThemeChip.js";
import { CapacityMeter } from "../components/CapacityMeter.js";
import { Drawer } from "../components/Drawer.js";
import { api } from "../api/client.js";

const TEAMS = ["All", "RDB-KV", "RDB-PG", "EaaS", "RaaS", "QaaS", "R3", "SIM", "MS SQL"];
const THEMES = ["KTLO", "Reliability", "Security", "Cust Exp", "Efficiency"] as const;
const PRIORITIES = ["P0", "P1", "P2"] as const;

interface Props {
  plan: PlanResponse;
  me: Me;
  onReload: () => void;
  editMode: boolean;
}

function canEditTeam(me: Me, team: string): boolean {
  if (me.role === "admin") return true;
  if (me.role === "editor") return me.scope === "All" || me.scope === team;
  return false;
}

export function Roadmap({ plan, me, onReload, editMode }: Props) {
  const [teamFilter, setTeamFilter] = useState("All");
  const [drawer, setDrawer]         = useState<Initiative | null>(null);
  const [addingNew, setAddingNew]   = useState(false);
  const [form, setForm] = useState({
    name: "", team: me.role === "editor" ? me.scope : "RDB-KV",
    theme: "KTLO", pri: "P1", deliverables: "", metrics: "",
  });
  const [saving, setSaving] = useState(false);

  const { derived, initiatives, assignments, quarter } = plan;
  const locked  = quarter.locked;
  const canEdit = editMode && (me.role === "admin" || me.role === "editor");

  const committed = initiatives
    .filter((i) => i.status === "committed")
    .filter((i) => teamFilter === "All" || i.team === teamFilter)
    .sort((a, b) => {
      const o: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
      return (o[a.pri ?? "P2"] ?? 2) - (o[b.pri ?? "P2"] ?? 2);
    });

  const deferred = initiatives
    .filter((i) => i.status === "backlog" && i.readiness === "ready")
    .filter((i) => teamFilter === "All" || i.team === teamFilter);

  const asgsFor = (id: string) => assignments.filter((a) => a.initiativeId === id);

  async function handleDefer(init: Initiative) {
    try { await api.initiatives.patch(init.id, { status: "backlog", readiness: "ready" }); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleCommit(init: Initiative) {
    try { await api.initiatives.patch(init.id, { status: "committed", readiness: null }); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleDelete(init: Initiative) {
    if (!confirm(`Delete "${init.name}"?`)) return;
    try { await api.initiatives.delete(init.id); setDrawer(null); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleAdd() {
    setSaving(true);
    try {
      await api.initiatives.create(plan.quarter.id, {
        status: "committed", name: form.name, team: form.team,
        theme: form.theme, pri: form.pri || null,
        deliverables: form.deliverables || null, metrics: form.metrics || null,
      });
      setAddingNew(false);
      setForm({ name: "", team: "RDB-KV", theme: "KTLO", pri: "P1", deliverables: "", metrics: "" });
      onReload();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handleDrawerSave(init: Initiative, patches: Record<string, unknown>) {
    try { await api.initiatives.patch(init.id, patches); setDrawer(null); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div>
      <CapacityMeter allocated={derived.orgAllocatedHC} capacity={derived.orgCapacity} />

      {/* Filters + add button */}
      <div className="bar-actions">
        <div className="chips">
          {TEAMS.map((t) => (
            <div
              key={t}
              className={`chip${teamFilter === t ? " on" : ""}`}
              onClick={() => setTeamFilter(t)}
            >
              {t}
            </div>
          ))}
        </div>
        <span className="spacer" />
        {canEdit && !locked && (
          <button className="addbtn" disabled={addingNew} onClick={() => setAddingNew(true)}>
            + Add initiative
          </button>
        )}
      </div>

      {/* Add new form */}
      {addingNew && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="ph"><h3>New Committed Initiative</h3></div>
          <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            <div>
              <label className="fl">Name *</label>
              <input className="fin" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="fl">Team *</label>
              <select className="fin" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
                {TEAMS.filter((t) => t !== "All" || me.role === "admin").map((t) => (
                  <option key={t} value={t} disabled={!canEditTeam(me, t)}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="fl">Theme * {me.role !== "admin" && <span style={{ color: "var(--muted)" }}>(admin only)</span>}</label>
              <select className="fin" value={form.theme} disabled={me.role !== "admin"} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
                {THEMES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Priority</label>
              <select className="fin" value={form.pri} onChange={(e) => setForm({ ...form, pri: e.target.value })}>
                <option value="">—</option>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Deliverables</label>
              <input className="fin" type="text" value={form.deliverables} onChange={(e) => setForm({ ...form, deliverables: e.target.value })} />
            </div>
            <div>
              <label className="fl">Metrics</label>
              <input className="fin" type="text" value={form.metrics} onChange={(e) => setForm({ ...form, metrics: e.target.value })} />
            </div>
          </div>
          <div style={{ padding: "0 18px 14px", display: "flex", gap: 8 }}>
            <button className="addbtn" onClick={handleAdd} disabled={!form.name || saving}>Add</button>
            <button className="chip" onClick={() => setAddingNew(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Committed (above the line) ── */}
      <div className="listwrap" style={{ marginBottom: 0 }}>
        <div className="zone-h">
          <span className="lbl">Committed</span>
          <span className="hc">{derived.orgAllocatedHC.toFixed(1)} HC</span>
        </div>
        <div className="tablescroll">
          <table>
            <thead>
              <tr>
                <th className="handle th-act" />
                <th className="num" style={{ width: 32 }}>#</th>
                <th>Pri</th>
                <th>Team</th>
                <th>Initiative</th>
                <th>Theme</th>
                <th>Deliverables</th>
                <th>Metrics</th>
                <th className="num">HC</th>
                <th>DRIs</th>
                <th className="th-act" />
              </tr>
            </thead>
            <tbody>
              {committed.map((i, idx) => {
                const asg = asgsFor(i.id);
                return (
                  <tr key={i.id} className="rrow" style={{ cursor: "pointer" }} onClick={() => setDrawer(i)}>
                    <td className="handle">⠿</td>
                    <td className="num" style={{ color: "var(--muted)", fontSize: 11 }}>{idx + 1}</td>
                    <td>
                      {i.pri ? <span className={`pri ${i.pri}`}>{i.pri}</span> : <span className="pri def">—</span>}
                    </td>
                    <td><TeamBadge team={i.team} /></td>
                    <td><span className="iname">{i.name}</span></td>
                    <td><ThemeChip theme={i.theme} /></td>
                    <td><span className="small">{i.deliverables ?? "—"}</span></td>
                    <td><span className="small">{i.metrics ?? "—"}</span></td>
                    <td className="num">
                      <span className="hcpill">{i.hc.toFixed(1)}</span>
                    </td>
                    <td>
                      <div className="dris">
                        {asg.slice(0, 5).map((a) => (
                          <div key={a.id} className="av" title={a.personName}>
                            {a.personName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                        ))}
                        {asg.length > 5 && <div className="av">+{asg.length - 5}</div>}
                      </div>
                    </td>
                    <td className="actcell" onClick={(e) => e.stopPropagation()}>
                      {canEditTeam(me, i.team) && !locked && (
                        <button className="iconbtn movebtn" title="Defer below line" onClick={() => handleDefer(i)}>↓</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {committed.length === 0 && (
                <tr><td colSpan={11} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>No committed initiatives</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Commit line ── */}
      <div className="redline">
        <div className="tag">Commit line</div>
        <div className="bar" />
        <div className="tag">Not funded this quarter ↓</div>
      </div>

      {/* ── Below the line: ready backlog ── */}
      <div className="listwrap">
        <div className="zone-h">
          <span className="lbl">Deferred — ready to fund</span>
          <span className="hc">{deferred.length}</span>
        </div>
        <div className="tablescroll">
          <table>
            <thead>
              <tr>
                <th className="num" style={{ width: 32 }}>#</th>
                <th>Team</th>
                <th>Initiative</th>
                <th>Theme</th>
                <th>Problem / Value</th>
                <th>Readiness</th>
                <th className="th-act" />
              </tr>
            </thead>
            <tbody>
              {deferred.map((i, idx) => (
                <tr key={i.id} className="rrow" style={{ cursor: "pointer" }} onClick={() => setDrawer(i)}>
                  <td className="num" style={{ color: "var(--muted)", fontSize: 11 }}>{idx + 1}</td>
                  <td><TeamBadge team={i.team} /></td>
                  <td><span className="iname">{i.name}</span></td>
                  <td><ThemeChip theme={i.theme} /></td>
                  <td><span className="small">{i.problemValue ?? "—"}</span></td>
                  <td><span className="readi ready">Ready</span></td>
                  <td className="actcell" onClick={(e) => e.stopPropagation()}>
                    {canEditTeam(me, i.team) && !locked && (
                      <button className="iconbtn movebtn promote" onClick={() => handleCommit(i)}>↑ Commit</button>
                    )}
                  </td>
                </tr>
              ))}
              {deferred.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>No deferred initiatives</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Initiative detail drawer ── */}
      {drawer && (
        <InitiativeDrawer
          initiative={drawer}
          assignments={asgsFor(drawer.id)}
          me={me}
          quarterId={plan.quarter.id}
          locked={locked}
          editMode={editMode}
          onClose={() => setDrawer(null)}
          onSave={(patches) => handleDrawerSave(drawer, patches)}
          onDelete={() => handleDelete(drawer)}
          onReload={onReload}
        />
      )}
    </div>
  );
}

interface DrawerInnerProps {
  initiative: Initiative;
  assignments: PlanResponse["assignments"];
  me: Me;
  quarterId: string;
  locked: boolean;
  editMode: boolean;
  onClose: () => void;
  onSave: (patches: Record<string, unknown>) => void;
  onDelete: () => void;
  onReload: () => void;
}

function InitiativeDrawer({ initiative: i, assignments, me, quarterId, locked, editMode, onClose, onSave, onDelete, onReload }: DrawerInnerProps) {
  const canEdit      = editMode && !locked && canEditTeam(me, i.team);
  const canEditTheme = editMode && !locked && me.role === "admin";

  const [form, setForm] = useState({
    name: i.name, team: i.team, theme: i.theme,
    pri: i.pri ?? "", deliverables: i.deliverables ?? "", metrics: i.metrics ?? "",
  });
  const [newRosId, setNewRosId] = useState("");
  const [newPct, setNewPct]     = useState("1.0");
  const [search, setSearch]     = useState<Array<{ rosId: string; name: string }>>([]);

  async function searchPeople(q: string) {
    if (!q) { setSearch([]); return; }
    try {
      const { people } = await api.people.search(q);
      setSearch(people.map((p) => ({ rosId: p.rosId, name: p.name })));
    } catch {}
  }

  async function addAssignment() {
    if (!newRosId) return;
    try {
      await api.assignments.upsert({ quarterId, rosId: newRosId, initiativeId: i.id, pct: parseFloat(newPct) });
      setNewRosId(""); setNewPct("1.0"); setSearch([]); onReload();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function removeAssignment(id: string) {
    try { await api.assignments.delete(id); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  const footer = canEdit ? (
    <>
      <button className="del" onClick={onDelete}>Delete</button>
      <button className="save" onClick={() => onSave({
        name: form.name, team: form.team, theme: form.theme,
        pri: form.pri || null, deliverables: form.deliverables || null, metrics: form.metrics || null,
      })}>
        Save
      </button>
    </>
  ) : (
    <button className="save" style={{ background: "var(--ink-2)" }} onClick={onClose}>Close</button>
  );

  return (
    <Drawer title={i.name} onClose={onClose} footer={footer}>
      <label className="fl">Name</label>
      <input className="fin" type="text" value={form.name} disabled={!canEdit}
        onChange={(e) => setForm({ ...form, name: e.target.value })} />

      <div className="frow">
        <div>
          <label className="fl">Team</label>
          <select className="fin" value={form.team} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, team: e.target.value })}>
            {["RDB-KV","RDB-PG","EaaS","RaaS","QaaS","R3","SIM","MS SQL","All"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="fl">Theme {!canEditTheme && <span style={{ fontSize: 9, color: "var(--muted)" }}>(admin)</span>}</label>
          <select className="fin" value={form.theme} disabled={!canEditTheme}
            onChange={(e) => setForm({ ...form, theme: e.target.value as Initiative["theme"] })}>
            {["KTLO","Reliability","Security","Cust Exp","Efficiency"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="fl">Priority</label>
          <select className="fin" value={form.pri} disabled={!canEdit}
            onChange={(e) => setForm({ ...form, pri: e.target.value })}>
            <option value="">—</option>
            {["P0","P1","P2"].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <label className="fl">Deliverables</label>
      <textarea className="fin edt" value={form.deliverables} disabled={!canEdit}
        onChange={(e) => setForm({ ...form, deliverables: e.target.value })} />

      <label className="fl">Metrics</label>
      <textarea className="fin edt" value={form.metrics} disabled={!canEdit}
        onChange={(e) => setForm({ ...form, metrics: e.target.value })} />

      {/* Staffing */}
      <label className="fl" style={{ marginTop: 18 }}>
        Staffing
        <span style={{ marginLeft: 8, fontSize: 9.5, background: "var(--petrol-soft)", color: "var(--petrol)", padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>
          {i.hc.toFixed(1)} HC auto
        </span>
      </label>
      {assignments.map((a) => (
        <div key={a.id} className="asg">
          <span className="nm">{a.personName}</span>
          <span className="ht" style={{ background: "var(--petrol)" }}>{a.homeTeam}</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{(a.pct * 100).toFixed(0)}%</span>
          {canEdit && (
            <button className="rm" onClick={() => removeAssignment(a.id)}>×</button>
          )}
        </div>
      ))}
      {assignments.length === 0 && (
        <div style={{ color: "var(--muted)", fontSize: 12 }}>No one assigned yet</div>
      )}
      <div style={{ fontSize: 11, color: "var(--muted)", textAlign: "right", marginTop: 2 }}>
        Total: {assignments.reduce((s, a) => s + a.pct, 0).toFixed(2)} HC
      </div>

      {canEdit && (
        <div className="addasg">
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="text"
              className="fin"
              placeholder="Search person…"
              onChange={(e) => searchPeople(e.target.value)}
            />
            {search.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--line)", borderRadius: 8, zIndex: 10 }}>
                {search.map((p) => (
                  <div key={p.rosId} style={{ padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                    onMouseDown={() => { setNewRosId(p.rosId); setSearch([]); }}>
                    {p.name} {newRosId === p.rosId && "✓"}
                  </div>
                ))}
              </div>
            )}
          </div>
          <input
            type="number"
            value={newPct}
            min="0.05" max="1" step="0.05"
            onChange={(e) => setNewPct(e.target.value)}
          />
          <button onClick={addAssignment} disabled={!newRosId}>+</button>
        </div>
      )}
    </Drawer>
  );
}
