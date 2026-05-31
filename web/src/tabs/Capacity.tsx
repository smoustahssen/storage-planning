import { useState } from "react";
import type { PlanResponse, Me } from "../api/types.js";
import { TeamBadge } from "../components/ThemeChip.js";
import { api } from "../api/client.js";

interface Props {
  plan: PlanResponse;
  me: Me;
  onReload: () => void;
  editMode: boolean;
}

function MiniBar({ allocated, availability }: { allocated: number; availability: number }) {
  const pct  = availability > 0 ? Math.min((allocated / availability) * 100, 100) : 0;
  const over = allocated > availability + 0.01;
  return (
    <span className="minibar">
      <i className={over ? "over" : ""} style={{ width: `${pct}%` }} />
    </span>
  );
}

function canSeeEngineers(me: Me, engineerTeam: string): boolean {
  if (me.role === "admin") return true;
  if (me.role === "editor") return me.scope === "All" || me.scope === engineerTeam;
  return false;
}

function canEditByScope(me: Me, plan: PlanResponse, teamOrInitId: string): boolean {
  if (me.role === "admin") return true;
  if (me.role !== "editor") return false;
  if (me.scope === "All") return true;
  if (teamOrInitId.length > 12) {
    const init = plan.initiatives.find((i) => i.id === teamOrInitId);
    return init ? me.scope === init.team : false;
  }
  return me.scope === teamOrInitId;
}

export function Capacity({ plan, me, onReload, editMode }: Props) {
  const { derived } = plan;
  const canEdit = editMode && (me.role === "admin" || me.role === "editor") && !plan.quarter.locked;

  async function handleRemoveAssignment(assignmentId: string) {
    try { await api.assignments.delete(assignmentId); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleAddAssignment(rosId: string, initiativeId: string, pct: number) {
    try {
      await api.assignments.upsert({ quarterId: plan.quarter.id, rosId, initiativeId, pct });
      onReload();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  const availableInitiatives = plan.initiatives.filter(
    (i) => i.status === "committed" &&
      (me.role === "admin" || me.scope === "All" || me.scope === i.team),
  );

  return (
    <div>
      {/* ── Team capacity summary ── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="ph">
          <h3>Team Capacity</h3>
          <span className="tagi">auto</span>
        </div>
        <div className="tablescroll">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th className="num">Home HC</th>
                <th className="num">Lent out</th>
                <th className="num">Borrowed</th>
                <th className="num">Effective HC</th>
                <th className="num">Allocated HC</th>
                <th className="num">Gap</th>
                <th>Load</th>
              </tr>
            </thead>
            <tbody>
              {derived.teams.map((t) => {
                const pct  = t.effectiveHC > 0 ? Math.min(t.allocatedHC / t.effectiveHC, 2) * 100 : 0;
                const over = t.allocatedHC > t.effectiveHC + 0.01;
                const gap  = t.effectiveHC - t.allocatedHC;
                return (
                  <tr key={t.team} className="rrow">
                    <td><TeamBadge team={t.team} /></td>
                    <td className="num">{t.homeHC.toFixed(1)}</td>
                    <td className="num">
                      {t.lentOut > 0
                        ? <span style={{ color: "var(--amber)" }}>−{t.lentOut.toFixed(1)}</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="num">
                      {t.borrowedIn > 0
                        ? <span style={{ color: "var(--green)" }}>+{t.borrowedIn.toFixed(1)}</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="num">{t.effectiveHC.toFixed(1)}</td>
                    <td className="num">{t.allocatedHC.toFixed(1)}</td>
                    <td className={`num gapcell${gap < -0.05 ? " hl" : ""}`}>
                      <span className={`gap ${gap < -0.05 ? "neg" : gap > 0.05 ? "pos" : "zero"}`}>
                        {gap >= 0 ? "+" : ""}{gap.toFixed(1)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="minibar" style={{ width: 90 }}>
                          <i className={over ? "over" : ""} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: over ? "var(--red)" : "var(--muted)" }}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Per-engineer allocation ── */}
      <div className="panel">
        <div className="ph">
          <h3>Engineer Allocation</h3>
          <span className="tagi">auto</span>
        </div>
        <div className="tablescroll">
          <table>
            <thead>
              <tr>
                <th className="num" style={{ width: 32 }}>#</th>
                <th>Engineer</th>
                <th>Team</th>
                <th>Projects</th>
                <th>Load</th>
                <th className="th-act" />
              </tr>
            </thead>
            <tbody>
              {derived.engineers.map((eng, idx) => {
                const over    = eng.balance === "over";
                const under   = eng.balance === "under";
                const visible = canSeeEngineers(me, eng.homeTeam);
                return (
                  <tr key={eng.rosId} className="rrow">
                    <td className="num" style={{ color: "var(--muted)", fontSize: 11 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>
                      {visible
                        ? <><span className={`dot ${eng.balance === "balanced" ? "bal" : eng.balance === "over" ? "over" : "under"}`} />{eng.name}</>
                        : <span style={{ color: "var(--muted-2)", letterSpacing: 2 }}>••••</span>}
                    </td>
                    <td>{eng.homeTeam}</td>
                    <td>
                      {visible ? (
                        <>
                          {eng.projects.map((p) => (
                            <span key={p.initiativeId} className="pchip">
                              {p.name}
                              <span style={{ color: "var(--muted)", marginLeft: 2 }}>{(p.pct * 100).toFixed(0)}%</span>
                              {canEdit && canEditByScope(me, plan, p.initiativeId) && (
                                <button
                                  className="rm"
                                  title="Remove"
                                  onClick={async () => {
                                    const a = plan.assignments.find(
                                      (a) => a.rosId === eng.rosId && a.initiativeId === p.initiativeId,
                                    );
                                    if (a) await handleRemoveAssignment(a.id);
                                  }}
                                >×</button>
                              )}
                            </span>
                          ))}
                          {eng.projects.length === 0 && (
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>Unassigned</span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: "var(--muted)", fontSize: 12 }}>
                          {eng.projects.length > 0 ? `${eng.projects.length} project${eng.projects.length > 1 ? "s" : ""}` : "Unassigned"}
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <MiniBar allocated={eng.allocated} availability={eng.availability} />
                        <span style={{ fontSize: 11, color: over ? "var(--red)" : under ? "var(--amber)" : "var(--green)", fontWeight: 600 }}>
                          {(eng.allocated * 100).toFixed(0)}%
                          {over && <span> over</span>}
                          {under && <span> avail</span>}
                        </span>
                      </div>
                    </td>
                    <td className="actcell">
                      {canEdit && visible && canEditByScope(me, plan, eng.homeTeam) && (
                        <AddInline
                          rosId={eng.rosId}
                          initiatives={availableInitiatives}
                          onAdd={handleAddAssignment}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
              {derived.engineers.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                    No engineers with availability &gt; 0
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

function AddInline({
  rosId,
  initiatives,
  onAdd,
}: {
  rosId: string;
  initiatives: PlanResponse["initiatives"];
  onAdd: (rosId: string, initiativeId: string, pct: number) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [sel, setSel]     = useState("");
  const [pct, setPct]     = useState("1.0");

  if (!open) {
    return (
      <div className="engadd">
        <button onClick={() => setOpen(true)}>+ Assign</button>
      </div>
    );
  }

  return (
    <div className="engadd">
      <select value={sel} onChange={(e) => setSel(e.target.value)}>
        <option value="">— initiative —</option>
        {initiatives.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      <input type="number" value={pct} min="0.05" max="1" step="0.05"
        onChange={(e) => setPct(e.target.value)} />
      <button disabled={!sel} onClick={() => { onAdd(rosId, sel, parseFloat(pct)); setOpen(false); }}>
        OK
      </button>
      <button style={{ background: "transparent", color: "var(--muted)" }} onClick={() => setOpen(false)}>×</button>
    </div>
  );
}
