import { useState } from "react";
import type { PlanResponse, Me, Initiative } from "../api/types.js";
import { ThemeChip, TeamBadge } from "../components/ThemeChip.js";
import { api } from "../api/client.js";

interface Props {
  plan: PlanResponse;
  me: Me;
  onReload: () => void;
}

const READINESS_DEFS = [
  { key: "ready",  label: "Ready",       desc: "Scope clear, resources identified. Could start this quarter if funded." },
  { key: "scope",  label: "Needs Scope", desc: "Problem understood but solution needs more definition before committing." },
  { key: "parked", label: "Parked",      desc: "Deprioritized. Not actively scoped. Keep for future consideration." },
  { key: "watch",  label: "Watch",       desc: "Monitoring a condition before deciding to scope or park." },
] as const;

const TEAMS  = ["All", "RDB-KV", "RDB-PG", "EaaS", "RaaS", "QaaS", "R3", "SIM", "MS SQL"];
const THEMES = ["KTLO", "Reliability", "Security", "Cust Exp", "Efficiency"] as const;

function canEditTeam(me: Me, team: string): boolean {
  if (me.role === "admin") return true;
  if (me.role === "editor") return me.scope === "All" || me.scope === team;
  return false;
}

export function Backlog({ plan, me, onReload }: Props) {
  const { initiatives, quarter } = plan;
  const [teamFilter, setTeamFilter]         = useState("All");
  const [readinessFilter, setReadinessFilter] = useState("All");
  const [addingNew, setAddingNew]           = useState(false);
  const [editId, setEditId]                 = useState<string | null>(null);
  const [form, setForm] = useState({
    team: me.role === "editor" && me.scope !== "All" ? me.scope : "RDB-KV",
    theme: "KTLO" as string, readiness: "scope" as string,
    name: "", problemValue: "", successMetric: "", effort: "", earliest: "", requestorDri: "", nextAction: "",
  });

  const locked  = quarter.locked;
  const canEdit = (me.role === "admin" || me.role === "editor") && !locked;

  const backlog = initiatives
    .filter((i) => i.status === "backlog")
    .filter((i) => teamFilter === "All" || i.team === teamFilter)
    .filter((i) => readinessFilter === "All" || i.readiness === readinessFilter)
    .sort((a, b) => {
      const o: Record<string, number> = { ready: 0, scope: 1, watch: 2, parked: 3 };
      return (o[a.readiness ?? "parked"] ?? 3) - (o[b.readiness ?? "parked"] ?? 3);
    });

  async function handleSaveNew() {
    try {
      await api.initiatives.create(plan.quarter.id, {
        status: "backlog", team: form.team, name: form.name, theme: form.theme,
        readiness: form.readiness, problem_value: form.problemValue || null,
        success_metric: form.successMetric || null, effort: form.effort || null,
        earliest: form.earliest || null, requestor_dri: form.requestorDri || null,
        next_action: form.nextAction || null,
      });
      setAddingNew(false);
      setForm({ team: "RDB-KV", theme: "KTLO", readiness: "scope", name: "", problemValue: "", successMetric: "", effort: "", earliest: "", requestorDri: "", nextAction: "" });
      onReload();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleInlineEdit(id: string, patches: Record<string, unknown>) {
    try { await api.initiatives.patch(id, patches); setEditId(null); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await api.initiatives.delete(id); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div>
      {/* ── Readiness definition cards ── */}
      <div className="defs">
        {READINESS_DEFS.map((d) => (
          <div key={d.key} className="def">
            <span className={`readi ${d.key}`}>{d.label}</span>
            <div>
              <b>{d.label}</b>
              <span>{d.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bar-actions">
        <div className="chips">
          {TEAMS.map((t) => (
            <div key={t} className={`chip${teamFilter === t ? " on" : ""}`} onClick={() => setTeamFilter(t)}>{t}</div>
          ))}
        </div>
        <span className="sp">Readiness:</span>
        <div className="chips">
          {["All", ...READINESS_DEFS.map((d) => d.key)].map((r) => (
            <div key={r} className={`chip${readinessFilter === r ? " on" : ""}`}
              onClick={() => setReadinessFilter(r)}>
              {r === "All" ? "All" : READINESS_DEFS.find((d) => d.key === r)?.label ?? r}
            </div>
          ))}
        </div>
        {canEdit && (
          <>
            <span className="spacer" />
            <button className="addbtn" disabled={addingNew} onClick={() => setAddingNew(true)}>
              + Add item
            </button>
          </>
        )}
      </div>

      {/* ── Add new form ── */}
      {addingNew && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="ph"><h3>New Backlog Item</h3></div>
          <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: "Name *",        field: "name",         type: "text" },
              { label: "Effort",        field: "effort",       type: "text" },
              { label: "Earliest",      field: "earliest",     type: "text" },
              { label: "Requestor/DRI", field: "requestorDri", type: "text" },
              { label: "Next action",   field: "nextAction",   type: "text" },
            ].map(({ label, field, type }) => (
              <div key={field}>
                <label className="fl">{label}</label>
                <input className="fin" type={type} value={(form as Record<string, string>)[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="fl">Team *</label>
              <select className="fin" value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value })}>
                {TEAMS.filter((t) => t !== "All").map((t) => (
                  <option key={t} value={t} disabled={!canEditTeam(me, t)}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="fl">Theme * {me.role !== "admin" && <span style={{ color: "var(--muted)", fontSize: 9 }}>(admin)</span>}</label>
              <select className="fin" value={form.theme} disabled={me.role !== "admin"}
                onChange={(e) => setForm({ ...form, theme: e.target.value })}>
                {THEMES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="fl">Readiness</label>
              <select className="fin" value={form.readiness} onChange={(e) => setForm({ ...form, readiness: e.target.value })}>
                {READINESS_DEFS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ padding: "0 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label className="fl">Problem &amp; Value</label>
              <textarea className="fin edt" value={form.problemValue}
                onChange={(e) => setForm({ ...form, problemValue: e.target.value })} />
            </div>
            <div>
              <label className="fl">Success Metric</label>
              <input className="fin" type="text" value={form.successMetric}
                onChange={(e) => setForm({ ...form, successMetric: e.target.value })} />
            </div>
          </div>
          <div style={{ padding: "10px 18px 14px", display: "flex", gap: 8 }}>
            <button className="addbtn" onClick={handleSaveNew} disabled={!form.name}>Save</button>
            <button className="chip" onClick={() => setAddingNew(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Backlog table ── */}
      <div className="listwrap">
        <div className="zone-h">
          <span className="lbl">Backlog</span>
          <span className="hc">{backlog.length} items</span>
        </div>
        <div className="tablescroll">
          <table>
            <thead>
              <tr>
                <th>Readiness</th>
                <th>Team</th>
                <th>Initiative</th>
                <th>Theme</th>
                <th>Problem &amp; Value</th>
                <th>Metric</th>
                <th>Effort</th>
                <th>Earliest</th>
                <th>Requestor / DRI</th>
                <th>Next Action</th>
                {canEdit && <th className="th-act" />}
              </tr>
            </thead>
            <tbody>
              {backlog.map((item) =>
                editId === item.id ? (
                  <BacklogEditRow
                    key={item.id}
                    item={item}
                    me={me}
                    onSave={(patches) => handleInlineEdit(item.id, patches)}
                    onCancel={() => setEditId(null)}
                  />
                ) : (
                  <tr key={item.id} className="rrow">
                    <td><span className={`readi ${item.readiness ?? "parked"}`}>
                      {READINESS_DEFS.find((r) => r.key === item.readiness)?.label ?? item.readiness}
                    </span></td>
                    <td><TeamBadge team={item.team} /></td>
                    <td><span className="iname">{item.name}</span></td>
                    <td><ThemeChip theme={item.theme} /></td>
                    <td><span className="small">{item.problemValue ?? "—"}</span></td>
                    <td><span className="small">{item.successMetric ?? "—"}</span></td>
                    <td><span className="small">{item.effort ?? "—"}</span></td>
                    <td><span className="small">{item.earliest ?? "—"}</span></td>
                    <td><span className="small">{item.requestorDri ?? "—"}</span></td>
                    <td><span className="small">{item.nextAction ?? "—"}</span></td>
                    {canEdit && (
                      <td className="actcell">
                        {canEditTeam(me, item.team) && (
                          <>
                            <button className="iconbtn" title="Edit" onClick={() => setEditId(item.id)}>✎</button>
                            <button className="iconbtn" style={{ color: "var(--red)" }} title="Delete"
                              onClick={() => handleDelete(item.id, item.name)}>×</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                )
              )}
              {backlog.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                    No backlog items
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BacklogEditRow({ item, me, onSave, onCancel }: {
  item: Initiative; me: Me;
  onSave: (patches: Record<string, unknown>) => void; onCancel: () => void;
}) {
  const [f, setF] = useState({
    name: item.name, team: item.team, theme: item.theme,
    readiness: item.readiness ?? "scope",
    problemValue: item.problemValue ?? "", successMetric: item.successMetric ?? "",
    effort: item.effort ?? "", earliest: item.earliest ?? "",
    requestorDri: item.requestorDri ?? "", nextAction: item.nextAction ?? "",
  });
  const fi = (field: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [field]: e.target.value });

  return (
    <tr style={{ background: "var(--petrol-soft)" }}>
      <td><select className="edt" value={f.readiness} onChange={fi("readiness")} style={{ fontSize: 11 }}>
        {["ready","scope","parked","watch"].map((r) => <option key={r}>{r}</option>)}</select></td>
      <td><select className="edt" value={f.team} onChange={fi("team")} style={{ fontSize: 11 }}>
        {["RDB-KV","RDB-PG","EaaS","RaaS","QaaS","R3","SIM","MS SQL"].map((t) => <option key={t}>{t}</option>)}</select></td>
      <td><input className="edt" type="text" value={f.name} onChange={fi("name")} /></td>
      <td><select className="edt" value={f.theme} onChange={fi("theme")} disabled={me.role !== "admin"} style={{ fontSize: 11 }}>
        {["KTLO","Reliability","Security","Cust Exp","Efficiency"].map((t) => <option key={t}>{t}</option>)}</select></td>
      <td><input className="edt" type="text" value={f.problemValue} onChange={fi("problemValue")} /></td>
      <td><input className="edt" type="text" value={f.successMetric} onChange={fi("successMetric")} /></td>
      <td><input className="edt" type="text" value={f.effort} onChange={fi("effort")} /></td>
      <td><input className="edt" type="text" value={f.earliest} onChange={fi("earliest")} /></td>
      <td><input className="edt" type="text" value={f.requestorDri} onChange={fi("requestorDri")} /></td>
      <td><input className="edt" type="text" value={f.nextAction} onChange={fi("nextAction")} /></td>
      <td>
        <button className="addbtn" style={{ fontSize: 11, padding: "2px 8px" }}
          onClick={() => onSave({ name: f.name, team: f.team, theme: f.theme, readiness: f.readiness,
            problem_value: f.problemValue || null, success_metric: f.successMetric || null,
            effort: f.effort || null, earliest: f.earliest || null,
            requestor_dri: f.requestorDri || null, next_action: f.nextAction || null })}>
          Save
        </button>
        <button className="iconbtn" onClick={onCancel}>×</button>
      </td>
    </tr>
  );
}
