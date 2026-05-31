/**
 * Every headcount number in the product comes from these queries.
 * Nothing is stored. Everything is aggregated from the assignment table.
 */

import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

export const TEAMS = [
  "RDB-KV",
  "RDB-PG",
  "EaaS",
  "RaaS",
  "QaaS",
  "R3",
  "SIM",
  "MS SQL",
] as const;
export type Team = (typeof TEAMS)[number];

export const THEMES = [
  "KTLO",
  "Reliability",
  "Security",
  "Cust Exp",
  "Efficiency",
] as const;
export type Theme = (typeof THEMES)[number];

// Effective availability for a person: override if present, else role default
const AVAILABILITY_SQL = `
  COALESCE(ao.availability, CASE p.role WHEN 'IC' THEN 1.0 ELSE 0.0 END)
`;

// ─── Per-person availability ─────────────────────────────────────────────────

export function getPersonAvailability(rosId: string): number {
  const row = db.get<{ avail: number }>(sql.raw(`
    SELECT ${AVAILABILITY_SQL} AS avail
    FROM person p
    LEFT JOIN availability_override ao ON ao.ros_id = p.ros_id
    WHERE p.ros_id = '${rosId}'
  `));
  return row?.avail ?? 0;
}

// ─── Home HC for a team: count of active ICs on that team ───────────────────

export function homeHC(quarterId: string): Record<string, number> {
  const rows = db.all<{ team: string; hc: number }>(sql.raw(`
    SELECT p.home_team AS team, COUNT(*) AS hc
    FROM person p
    WHERE p.active = 1 AND p.role = 'IC'
    GROUP BY p.home_team
  `));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.team] = r.hc;
  return out;
}

// ─── Org capacity: count of all active ICs ───────────────────────────────────

export function orgCapacity(): number {
  const row = db.get<{ cap: number }>(sql.raw(`
    SELECT COUNT(*) AS cap
    FROM person p
    WHERE p.active = 1 AND p.role = 'IC'
  `));
  return row?.cap ?? 0;
}

// ─── Initiative HC: sum of pct for all assignments on that initiative ────────

export function initiativeHC(quarterId: string): Record<string, number> {
  const rows = db.all<{ initiative_id: string; hc: number }>(sql.raw(`
    SELECT initiative_id, SUM(pct) AS hc
    FROM assignment
    WHERE quarter_id = '${quarterId}'
    GROUP BY initiative_id
  `));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.initiative_id] = Number(r.hc.toFixed(2));
  return out;
}

// ─── Team allocated HC ───────────────────────────────────────────────────────
// An assignment is attributed to its initiative's team.
// Exception: initiative.team = 'All' → attributed to assignee's home_team.

export function teamAllocatedHC(quarterId: string): Record<string, number> {
  const rows = db.all<{ team: string; hc: number }>(sql.raw(`
    SELECT
      CASE WHEN i.team = 'All' THEN p.home_team ELSE i.team END AS team,
      SUM(a.pct) AS hc
    FROM assignment a
    JOIN initiative i ON i.id = a.initiative_id
    JOIN person p ON p.ros_id = a.ros_id
    WHERE a.quarter_id = '${quarterId}'
    GROUP BY 1
  `));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.team] = Number(r.hc.toFixed(2));
  return out;
}

// ─── Lent out per team ───────────────────────────────────────────────────────
// pct where person's home_team is T but initiative.team is a different specific team

export function teamLentOut(quarterId: string): Record<string, number> {
  const rows = db.all<{ team: string; hc: number }>(sql.raw(`
    SELECT p.home_team AS team, SUM(a.pct) AS hc
    FROM assignment a
    JOIN initiative i ON i.id = a.initiative_id
    JOIN person p ON p.ros_id = a.ros_id
    WHERE a.quarter_id = '${quarterId}'
      AND i.team != 'All'
      AND i.team != p.home_team
    GROUP BY p.home_team
  `));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.team] = Number(r.hc.toFixed(2));
  return out;
}

// ─── Borrowed in per team ────────────────────────────────────────────────────
// pct where initiative.team is T but person's home_team is different

export function teamBorrowedIn(quarterId: string): Record<string, number> {
  const rows = db.all<{ team: string; hc: number }>(sql.raw(`
    SELECT i.team AS team, SUM(a.pct) AS hc
    FROM assignment a
    JOIN initiative i ON i.id = a.initiative_id
    JOIN person p ON p.ros_id = a.ros_id
    WHERE a.quarter_id = '${quarterId}'
      AND i.team != 'All'
      AND i.team != p.home_team
    GROUP BY i.team
  `));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.team] = Number(r.hc.toFixed(2));
  return out;
}

// ─── Theme allocation ────────────────────────────────────────────────────────

export function themeAllocation(
  quarterId: string,
  filterTeam?: string,
): Record<string, number> {
  const teamFilter =
    filterTeam && filterTeam !== "All"
      ? `AND (i.team = '${filterTeam}' OR i.team = 'All')`
      : "";
  const rows = db.all<{ theme: string; hc: number }>(sql.raw(`
    SELECT i.theme, SUM(a.pct) AS hc
    FROM assignment a
    JOIN initiative i ON i.id = a.initiative_id
    WHERE a.quarter_id = '${quarterId}' ${teamFilter}
    GROUP BY i.theme
  `));
  const out: Record<string, number> = {};
  for (const r of rows) out[r.theme] = Number(r.hc.toFixed(2));
  return out;
}

// ─── Org allocated HC: sum of all pct ────────────────────────────────────────

export function orgAllocatedHC(quarterId: string): number {
  const row = db.get<{ hc: number }>(sql.raw(`
    SELECT SUM(pct) AS hc FROM assignment WHERE quarter_id = '${quarterId}'
  `));
  return Number((row?.hc ?? 0).toFixed(2));
}

// ─── Per-engineer allocation ─────────────────────────────────────────────────

export interface EngineerAllocation {
  rosId: string;
  name: string;
  homeTeam: string;
  role: string;
  availability: number;
  allocated: number;
  balance: "balanced" | "over" | "under";
  delta: number;
  projects: Array<{ initiativeId: string; name: string; pct: number }>;
}

export function engineerAllocations(
  quarterId: string,
): EngineerAllocation[] {
  const people = db.all<{
    ros_id: string;
    name: string;
    home_team: string;
    role: string;
    avail: number;
  }>(sql.raw(`
    SELECT p.ros_id, p.name, p.home_team, p.role,
           ${AVAILABILITY_SQL} AS avail
    FROM person p
    LEFT JOIN availability_override ao ON ao.ros_id = p.ros_id
    WHERE p.active = 1
  `));

  const projects = db.all<{
    ros_id: string;
    initiative_id: string;
    iname: string;
    pct: number;
  }>(sql.raw(`
    SELECT a.ros_id, a.initiative_id, i.name AS iname, a.pct
    FROM assignment a
    JOIN initiative i ON i.id = a.initiative_id
    WHERE a.quarter_id = '${quarterId}'
  `));

  const byPerson = new Map<
    string,
    Array<{ initiativeId: string; name: string; pct: number }>
  >();
  for (const p of projects) {
    if (!byPerson.has(p.ros_id)) byPerson.set(p.ros_id, []);
    byPerson.get(p.ros_id)!.push({
      initiativeId: p.initiative_id,
      name: p.iname,
      pct: p.pct,
    });
  }

  return people
    .filter((p) => p.avail > 0)
    .map((p) => {
      const projs = byPerson.get(p.ros_id) ?? [];
      const allocated = Number(
        projs.reduce((s, x) => s + x.pct, 0).toFixed(2),
      );
      const delta = Number((allocated - p.avail).toFixed(2));
      return {
        rosId: p.ros_id,
        name: p.name,
        homeTeam: p.home_team,
        role: p.role,
        availability: p.avail,
        allocated,
        balance: Math.abs(delta) < 0.01 ? "balanced" : delta > 0 ? "over" : "under",
        delta: Math.abs(delta),
        projects: projs,
      };
    });
}

// ─── Full team summary ───────────────────────────────────────────────────────

export interface TeamSummary {
  team: string;
  homeHC: number;
  effectiveHC: number;
  allocatedHC: number;
  lentOut: number;
  borrowedIn: number;
  gap: number;
  themeAllocation: Record<string, { pct: number; hc: number }>;
  committedInitiatives: Array<{
    id: string;
    pri: string | null;
    name: string;
    hc: number;
  }>;
}

export function teamSummaries(quarterId: string): TeamSummary[] {
  const home = homeHC(quarterId);
  const allocated = teamAllocatedHC(quarterId);
  const lentOut = teamLentOut(quarterId);
  const borrowedIn = teamBorrowedIn(quarterId);
  const initiativeHcs = initiativeHC(quarterId);

  // Per-team theme allocation
  const themeRows = db.all<{ team: string; theme: string; hc: number }>(
    sql.raw(`
    SELECT
      CASE WHEN i.team = 'All' THEN p.home_team ELSE i.team END AS team,
      i.theme,
      SUM(a.pct) AS hc
    FROM assignment a
    JOIN initiative i ON i.id = a.initiative_id
    JOIN person p ON p.ros_id = a.ros_id
    WHERE a.quarter_id = '${quarterId}'
    GROUP BY 1, 2
  `),
  );

  const themesPerTeam: Record<string, Record<string, number>> = {};
  for (const r of themeRows) {
    if (!themesPerTeam[r.team]) themesPerTeam[r.team] = {};
    themesPerTeam[r.team][r.theme] = Number(r.hc.toFixed(2));
  }

  // Committed initiatives per team
  const initRows = db.all<{
    team: string;
    id: string;
    pri: string | null;
    name: string;
  }>(sql.raw(`
    SELECT team, id, pri, name FROM initiative
    WHERE quarter_id = '${quarterId}' AND status = 'committed'
  `));

  const initPerTeam: Record<
    string,
    Array<{ id: string; pri: string | null; name: string; hc: number }>
  > = {};
  for (const r of initRows) {
    if (!initPerTeam[r.team]) initPerTeam[r.team] = [];
    initPerTeam[r.team].push({
      id: r.id,
      pri: r.pri,
      name: r.name,
      hc: initiativeHcs[r.id] ?? 0,
    });
  }

  return TEAMS.map((team) => {
    const h = home[team] ?? 0;
    const a = allocated[team] ?? 0;
    const lo = lentOut[team] ?? 0;
    const bi = borrowedIn[team] ?? 0;
    const eff = Number((h - lo + bi).toFixed(2));
    const gap = Number((a - eff).toFixed(2));
    const teamThemes = themesPerTeam[team] ?? {};
    const totalTeamHC = Object.values(teamThemes).reduce((s, v) => s + v, 0);

    return {
      team,
      homeHC: h,
      effectiveHC: eff,
      allocatedHC: a,
      lentOut: lo,
      borrowedIn: bi,
      gap,
      themeAllocation: Object.fromEntries(
        Object.entries(teamThemes).map(([theme, hc]) => [
          theme,
          {
            hc,
            pct:
              totalTeamHC > 0
                ? Number(((hc / totalTeamHC) * 100).toFixed(0))
                : 0,
          },
        ]),
      ),
      committedInitiatives: initPerTeam[team] ?? [],
    };
  });
}

// ─── Quarter-over-quarter theme shift ────────────────────────────────────────

export function qoqThemeShift(
  currentQuarterId: string,
  previousQuarterId: string,
): Array<{
  theme: string;
  current: number;
  previous: number;
  shift: number;
}> {
  const current = themeAllocation(currentQuarterId);
  const previous = themeAllocation(previousQuarterId);
  return THEMES.map((theme) => {
    const c = current[theme] ?? 0;
    const p = previous[theme] ?? 0;
    return { theme, current: c, previous: p, shift: Number((c - p).toFixed(2)) };
  });
}

// ─── Active cross-team loans ─────────────────────────────────────────────────

export interface LoanRow {
  assignmentId: string;
  rosId: string;
  personName: string;
  homeTeam: string;
  initiativeId: string;
  initiativeName: string;
  borrowingTeam: string;
  pct: number;
}

export function activeLoans(quarterId: string): LoanRow[] {
  return db.all<LoanRow>(sql.raw(`
    SELECT
      a.id AS assignmentId,
      a.ros_id AS rosId,
      p.name AS personName,
      p.home_team AS homeTeam,
      i.id AS initiativeId,
      i.name AS initiativeName,
      i.team AS borrowingTeam,
      a.pct
    FROM assignment a
    JOIN person p ON p.ros_id = a.ros_id
    JOIN initiative i ON i.id = a.initiative_id
    WHERE a.quarter_id = '${quarterId}'
      AND i.team != 'All'
      AND i.team != p.home_team
    ORDER BY p.home_team, i.team
  `));
}
