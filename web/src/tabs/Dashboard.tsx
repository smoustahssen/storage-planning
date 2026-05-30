import { useState } from "react";
import type { PlanResponse, Me } from "../api/types.js";
import { Donut } from "../components/Donut.js";
import { CapacityMeter } from "../components/CapacityMeter.js";
import { THEME_COLORS, TeamBadge } from "../components/ThemeChip.js";
import { api } from "../api/client.js";

interface Props {
  plan: PlanResponse;
  me: Me;
  onReload: () => void;
}

export function Dashboard({ plan, me, onReload }: Props) {
  const { derived, priorities } = plan;
  const [editingPriorities, setEditingPriorities] = useState(false);
  const [draftPriorities, setDraftPriorities] = useState(priorities);

  async function savePriorities() {
    try {
      await api.quarters.setPriorities(plan.quarter.id, draftPriorities);
      setEditingPriorities(false);
      onReload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to save");
    }
  }

  return (
    <div>
      {/* ── Capacity meter ── */}
      <CapacityMeter
        allocated={derived.orgAllocatedHC}
        capacity={derived.orgCapacity}
        meta={`${derived.committedCount} initiatives · P0: ${derived.p0Count} · P1: ${derived.p1Count}`}
      />

      {/* ── Stat cards ── */}
      <div className="statgrid">
        <div className="stat-c">
          <div className="k">Allocated HC <span className="auto">auto</span></div>
          <div className="v serif">{derived.orgAllocatedHC.toFixed(1)}<small> HC</small></div>
          <div className="d">of {derived.orgCapacity.toFixed(1)} capacity</div>
        </div>
        <div className="stat-c">
          <div className="k">Committed Initiatives <span className="auto">auto</span></div>
          <div className="v serif">{derived.committedCount}</div>
          <div className="d">
            <span style={{ color: "var(--red)", fontWeight: 700 }}>P0 {derived.p0Count}</span>
            {" · "}
            <span style={{ color: "var(--amber)", fontWeight: 700 }}>P1 {derived.p1Count}</span>
          </div>
        </div>
        <div className="stat-c">
          <div className="k">Available HC <span className="auto">auto</span></div>
          <div className="v serif" style={{ color: derived.unallocatedHC < 0 ? "var(--red)" : "var(--green)" }}>
            {derived.unallocatedHC >= 0 ? "+" : ""}{derived.unallocatedHC.toFixed(1)}<small> HC</small>
          </div>
          <div className="d">vs org capacity</div>
        </div>
        <div className="stat-c">
          <div className="k">Backlog (Ready) <span className="auto">auto</span></div>
          <div className="v serif">{derived.deferredCount}</div>
          <div className="d">items ready to fund</div>
        </div>
      </div>

      {/* ── Two-column: donut + QoQ ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="panel">
          <div className="ph">
            <h3>Allocation by Theme</h3>
            <span className="tagi">auto</span>
          </div>
          <Donut data={derived.themes} total={derived.orgAllocatedHC} />
        </div>

        {derived.qoq ? (
          <div className="panel">
            <div className="ph">
              <h3>Quarter over Quarter Theme Shift</h3>
            </div>
            <div className="qoq">
              <div className="qoqhead">
                <span className="nm">Theme</span>
                <span className="pr">Prev</span>
                <span className="ar" />
                <span className="cu">Curr</span>
                <span className="dl">Shift</span>
              </div>
              {derived.qoq.map((row) => (
                <div key={row.theme} className="qoqrow">
                  <span className="nm">
                    <span className="sw" style={{ background: THEME_COLORS[row.theme] ?? "#9a9384" }} />
                    {row.theme}
                  </span>
                  <span className="pr">{row.previous.toFixed(1)}</span>
                  <span className="ar">→</span>
                  <span className="cu">{row.current.toFixed(1)}</span>
                  <span className={`dl ${row.shift > 0 ? "up" : row.shift < 0 ? "down" : "flat"}`}>
                    {row.shift > 0 ? "+" : ""}{row.shift.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="ph"><h3>Quarter over Quarter</h3></div>
            <div style={{ padding: "24px 18px", color: "var(--muted)", fontSize: 12 }}>
              No previous quarter to compare
            </div>
          </div>
        )}
      </div>

      {/* ── Priorities ── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="ph">
          <h3>Top Priorities</h3>
          {me.role === "admin" && !plan.quarter.locked && !editingPriorities && (
            <button
              className="addbtn"
              onClick={() => { setDraftPriorities([...priorities]); setEditingPriorities(true); }}
            >
              Edit
            </button>
          )}
          {editingPriorities && (
            <>
              <button className="addbtn" onClick={savePriorities}>Save</button>
              <button className="addbtn" style={{ marginLeft: 6 }} onClick={() => setEditingPriorities(false)}>Cancel</button>
            </>
          )}
        </div>
        {editingPriorities ? (
          <div style={{ padding: "14px 18px" }}>
            {draftPriorities.map((p, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--muted-2)", marginBottom: 4 }}>
                  #{p.rank} Heading
                </div>
                <input
                  className="fin"
                  type="text"
                  value={p.heading}
                  style={{ marginBottom: 6 }}
                  onChange={(e) => {
                    const next = [...draftPriorities];
                    next[i] = { ...next[i], heading: e.target.value };
                    setDraftPriorities(next);
                  }}
                />
                <textarea
                  className="fin"
                  value={p.body}
                  onChange={(e) => {
                    const next = [...draftPriorities];
                    next[i] = { ...next[i], body: e.target.value };
                    setDraftPriorities(next);
                  }}
                />
              </div>
            ))}
            <button
              className="addbtn"
              onClick={() => setDraftPriorities([...draftPriorities, { rank: draftPriorities.length + 1, heading: "", body: "" }])}
            >
              + Add priority
            </button>
          </div>
        ) : priorities.length === 0 ? (
          <div className="prio" style={{ color: "var(--muted)", fontSize: 12 }}>No priorities set</div>
        ) : (
          <div className="prio">
            {priorities.map((p) => (
              <div key={p.rank} className="pl">
                <div className="n serif">{p.rank}</div>
                <div className="body">
                  <b>{p.heading}</b>
                  <div>{p.body}</div>
                </div>
                <button className="rm iconbtn" title="Remove">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Initiatives by team ── */}
      <div className="panel">
        <div className="ph">
          <h3>Initiatives by Team</h3>
          <span className="tagi">auto</span>
        </div>
        <div className="tablescroll">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th className="num">Home HC</th>
                <th className="num">Effective HC</th>
                <th className="num">Allocated HC</th>
                <th className="num">Gap</th>
                <th>Committed Initiatives</th>
                <th>Focus Areas</th>
              </tr>
            </thead>
            <tbody>
              {derived.teams.map((t) => {
                const gap = t.effectiveHC - t.allocatedHC;
                return (
                  <tr key={t.team} className="rrow">
                    <td><TeamBadge team={t.team} /></td>
                    <td className="num">{t.homeHC.toFixed(1)}</td>
                    <td className="num">{t.effectiveHC.toFixed(1)}</td>
                    <td className="num">{t.allocatedHC.toFixed(1)}</td>
                    <td className={`num gapcell${gap < -0.05 ? " hl" : ""}`}>
                      <span className={`gap ${gap < -0.05 ? "neg" : gap > 0.05 ? "pos" : "zero"}`}>
                        {gap >= 0 ? "+" : ""}{gap.toFixed(1)}
                      </span>
                    </td>
                    <td>
                      <div className="commit-list">
                        {t.committedInitiatives.map((i) => (
                          <div key={i.id}>
                            {i.pri && <span className={`pri ${i.pri}`}>{i.pri}</span>}{" "}
                            <b>{i.name}</b>
                          </div>
                        ))}
                        {t.committedInitiatives.length === 0 && <span>—</span>}
                      </div>
                    </td>
                    <td>
                      <div className="focusmini">
                        {Object.entries(t.themeAllocation)
                          .filter(([, v]) => v.hc > 0)
                          .map(([theme, val]) => (
                            <div key={theme}>
                              <span className="dot" style={{ background: THEME_COLORS[theme] ?? "#9a9384" }} />
                              <span>{theme} {val.pct}%</span>
                            </div>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
