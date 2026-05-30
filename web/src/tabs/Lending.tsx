import { useState, useEffect } from "react";
import type { PlanResponse, Me, Person } from "../api/types.js";
import { TeamBadge } from "../components/ThemeChip.js";
import { api } from "../api/client.js";

interface Props {
  plan: PlanResponse;
  me: Me;
  onReload: () => void;
}

function canSeeEngineers(me: Me, engineerTeam: string): boolean {
  if (me.role === "admin") return true;
  if (me.role === "editor") return me.scope === "All" || me.scope === engineerTeam;
  return false;
}

export function Lending({ plan, me, onReload }: Props) {
  const { derived, quarter } = plan;
  const [people, setPeople] = useState<Person[]>([]);
  const [lendRosId, setLendRosId] = useState("");
  const [lendTeam, setLendTeam]   = useState("");
  const [lendInitId, setLendInitId] = useState("");
  const [lendPct, setLendPct]     = useState("0.5");
  const [lendError, setLendError] = useState<string | null>(null);

  const canEdit = (me.role === "admin" || me.role === "editor") && !quarter.locked;

  useEffect(() => {
    api.people.list().then(({ people }) => setPeople(people)).catch(console.error);
  }, []);

  const chosenPerson = people.find((p) => p.rosId === lendRosId);

  // All committed cross-team initiatives (team != engineer's home team)
  const crossTeamInitiatives = plan.initiatives.filter(
    (i) => i.status === "committed" && i.team !== "All" && i.team !== chosenPerson?.homeTeam,
  );

  // Distinct teams that have cross-team initiatives
  const availableTeams = [...new Set(crossTeamInitiatives.map((i) => i.team))].sort();

  // Initiatives for the selected destination team
  const teamInitiatives = crossTeamInitiatives.filter((i) => i.team === lendTeam);

  function handleEngineerChange(rosId: string) {
    setLendRosId(rosId);
    setLendTeam("");
    setLendInitId("");
  }

  function handleTeamChange(team: string) {
    setLendTeam(team);
    setLendInitId("");
  }

  async function handleAddLoan() {
    setLendError(null);
    if (!lendRosId || !lendInitId) { setLendError("Select a person and initiative"); return; }
    try {
      await api.assignments.upsert({ quarterId: quarter.id, rosId: lendRosId, initiativeId: lendInitId, pct: parseFloat(lendPct) });
      setLendRosId(""); setLendTeam(""); setLendInitId(""); setLendPct("0.5");
      onReload();
    } catch (e) { setLendError(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleUpdateLoan(assignmentId: string, pct: number) {
    try { await api.assignments.patch(assignmentId, pct); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  async function handleRemoveLoan(assignmentId: string) {
    try { await api.assignments.delete(assignmentId); onReload(); }
    catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div>
      {/* ── Lend control ── */}
      {canEdit && (
        <div className="lendbar">
          <span className="lb">Lend</span>
          <select value={lendRosId} onChange={(e) => handleEngineerChange(e.target.value)}>
            <option value="">— engineer —</option>
            {people
              .filter((p) => p.availability > 0)
              .filter((p) => me.role === "admin" || me.scope === "All" || p.homeTeam === me.scope)
              .map((p) => (
                <option key={p.rosId} value={p.rosId}>{p.name} ({p.homeTeam})</option>
              ))}
          </select>
          <span className="flowarrow">→</span>
          <select value={lendTeam} onChange={(e) => handleTeamChange(e.target.value)} disabled={!lendRosId}>
            <option value="">— team —</option>
            {availableTeams.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <span className="flowarrow">→</span>
          <select value={lendInitId} onChange={(e) => setLendInitId(e.target.value)} disabled={!lendTeam}>
            <option value="">— initiative —</option>
            {teamInitiatives.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <input
            type="number"
            value={lendPct}
            min="0.05" max="1" step="0.05"
            onChange={(e) => setLendPct(e.target.value)}
            placeholder="% time"
          />
          <button onClick={handleAddLoan} disabled={!lendRosId || !lendInitId}>
            Add loan
          </button>
          {lendError && <span style={{ color: "var(--red)", fontSize: 11 }}>{lendError}</span>}
        </div>
      )}

      {/* ── Team net position ── */}
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="ph">
          <h3>Team Net Position</h3>
          <span className="tagi">auto</span>
        </div>
        <div className="tablescroll">
          <table>
            <thead>
              <tr>
                <th>Team</th>
                <th className="num">Home HC</th>
                <th className="num">Lent out</th>
                <th className="num">Borrowed in</th>
                <th className="num">Net</th>
                <th className="num">Effective HC</th>
              </tr>
            </thead>
            <tbody>
              {derived.teams.map((t) => {
                const net = t.borrowedIn - t.lentOut;
                return (
                  <tr key={t.team} className="rrow">
                    <td><TeamBadge team={t.team} /></td>
                    <td className="num">{t.homeHC.toFixed(1)}</td>
                    <td className="num">
                      {t.lentOut > 0
                        ? <span style={{ color: "var(--amber)" }} className="flowarrow">−{t.lentOut.toFixed(1)}</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="num">
                      {t.borrowedIn > 0
                        ? <span style={{ color: "var(--green)" }}>+{t.borrowedIn.toFixed(1)}</span>
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="num">
                      <span className={`netpos ${net > 0.05 ? "plus" : net < -0.05 ? "minus" : "zero"}`}>
                        {net >= 0 ? "+" : ""}{net.toFixed(1)}
                      </span>
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>{t.effectiveHC.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Active loans ── */}
      <div className="panel">
        <div className="ph">
          <h3>Active Cross-Team Loans</h3>
          <span className="tagi">auto</span>
        </div>
        {derived.loans.length === 0 ? (
          <div style={{ padding: "24px 18px", color: "var(--muted)", fontSize: 12 }}>
            No active cross-team loans this quarter
          </div>
        ) : (
          <div className="tablescroll">
            <table>
              <thead>
                <tr>
                  <th>Engineer</th>
                  <th>From</th>
                  <th />
                  <th>To</th>
                  <th>Initiative</th>
                  <th className="num">%</th>
                  {canEdit && <th className="th-act" />}
                </tr>
              </thead>
              <tbody>
                {derived.loans.map((loan) => {
                  const visible = canSeeEngineers(me, loan.homeTeam);
                  const canEditLoan =
                    me.role === "admin" ||
                    (me.role === "editor" && (me.scope === "All" || me.scope === loan.homeTeam));
                  return (
                    <tr key={loan.assignmentId} className="rrow">
                      <td style={{ fontWeight: 500 }}>
                        {visible ? loan.personName : <span style={{ color: "var(--muted-2)", letterSpacing: 2 }}>••••</span>}
                      </td>
                      <td><TeamBadge team={loan.homeTeam} /></td>
                      <td className="flowarrow" style={{ textAlign: "center", color: "var(--muted-2)" }}>→</td>
                      <td><TeamBadge team={loan.borrowingTeam} /></td>
                      <td><span className="small">{loan.initiativeName}</span></td>
                      <td className="num">
                        {canEdit && canEditLoan ? (
                          <input
                            className="edt num"
                            type="number"
                            defaultValue={loan.pct}
                            min="0.05" max="1" step="0.05"
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v !== loan.pct) handleUpdateLoan(loan.assignmentId, v);
                            }}
                          />
                        ) : (
                          `${(loan.pct * 100).toFixed(0)}%`
                        )}
                      </td>
                      {canEdit && (
                        <td className="actcell">
                          {canEditLoan && (
                            <button className="iconbtn" style={{ color: "var(--red)" }}
                              onClick={() => handleRemoveLoan(loan.assignmentId)}>×</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
