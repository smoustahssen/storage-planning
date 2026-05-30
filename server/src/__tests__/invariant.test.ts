/**
 * Proves the central invariant: allocated HC reads identically on the roadmap
 * meter, the dashboard stat card, and the sum of the team table's allocated
 * column — in every quarter — because all three derive from the same rows.
 */

import { describe, it, expect, beforeAll } from "vitest";

// Use in-memory DB for tests
process.env.DATABASE_URL = ":memory:";

import { rawDb as sqlite } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import {
  orgAllocatedHC,
  teamAllocatedHC,
  teamSummaries,
  initiativeHC,
  themeAllocation,
} from "../queries/derived.js";

const Q = "2026Q3";

beforeAll(async () => {
  await runMigrations();

  sqlite.prepare(`INSERT OR IGNORE INTO quarter VALUES ('${Q}', 'Q3 2026', 'current', 0)`).run();

  const insertPerson = sqlite.prepare(
    `INSERT OR IGNORE INTO person(ros_id,name,email,role,home_team,active) VALUES (?,?,?,?,?,1)`,
  );
  for (const p of [
    { id: "p1", name: "Alice", email: "alice@roblox.com", role: "IC", team: "RDB-KV" },
    { id: "p2", name: "Bob",   email: "bob@roblox.com",   role: "IC", team: "RDB-KV" },
    { id: "p3", name: "Carol", email: "carol@roblox.com", role: "IC", team: "RaaS"  },
  ]) {
    insertPerson.run(p.id, p.name, p.email, p.role, p.team);
  }

  const insertInit = sqlite.prepare(
    `INSERT OR IGNORE INTO initiative(id,quarter_id,status,team,name,theme) VALUES (?,?,?,?,?,?)`,
  );
  for (const i of [
    { id: "i1", team: "RDB-KV", theme: "KTLO",        status: "committed" },
    { id: "i2", team: "RaaS",   theme: "Reliability",  status: "committed" },
    { id: "i3", team: "All",    theme: "Security",     status: "committed" },
  ]) {
    insertInit.run(i.id, Q, i.status, i.team, `Initiative ${i.id}`, i.theme);
  }

  // Alice: 0.5 on i1, 0.3 on i3 | Bob: 0.8 on i1 | Carol: 1.0 on i2, 0.2 on i3
  const insertAsg = sqlite.prepare(
    `INSERT OR IGNORE INTO assignment(id,quarter_id,ros_id,initiative_id,pct) VALUES (?,?,?,?,?)`,
  );
  for (const a of [
    { id: "a1", ros: "p1", init: "i1", pct: 0.5 },
    { id: "a2", ros: "p1", init: "i3", pct: 0.3 },
    { id: "a3", ros: "p2", init: "i1", pct: 0.8 },
    { id: "a4", ros: "p3", init: "i2", pct: 1.0 },
    { id: "a5", ros: "p3", init: "i3", pct: 0.2 },
  ]) {
    insertAsg.run(a.id, Q, a.ros, a.init, a.pct);
  }
});

describe("central invariant", () => {
  it("orgAllocatedHC equals sum of all assignment pct", () => {
    const total = orgAllocatedHC(Q);
    expect(total).toBeCloseTo(0.5 + 0.3 + 0.8 + 1.0 + 0.2, 5);
  });

  it("sum of team allocated HC equals orgAllocatedHC", () => {
    const byTeam = teamAllocatedHC(Q);
    const sum = Object.values(byTeam).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(orgAllocatedHC(Q), 5);
  });

  it("team summary allocated column sums to orgAllocatedHC", () => {
    const summaries = teamSummaries(Q);
    const sum = summaries.reduce((s, t) => s + t.allocatedHC, 0);
    expect(sum).toBeCloseTo(orgAllocatedHC(Q), 5);
  });

  it("sum of initiative HC equals orgAllocatedHC", () => {
    const ihc = initiativeHC(Q);
    const sum = Object.values(ihc).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(orgAllocatedHC(Q), 5);
  });

  it("sum of theme allocation equals orgAllocatedHC", () => {
    const themes = themeAllocation(Q);
    const sum = Object.values(themes).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(orgAllocatedHC(Q), 5);
  });

  it("upsert on same (quarter,person,initiative) updates pct, not duplicates", () => {
    const before = orgAllocatedHC(Q);
    sqlite.prepare(
      `INSERT OR REPLACE INTO assignment(id,quarter_id,ros_id,initiative_id,pct)
       SELECT id,'${Q}','p1','i1',0.6 FROM assignment WHERE quarter_id='${Q}' AND ros_id='p1' AND initiative_id='i1'`,
    ).run();
    const after = orgAllocatedHC(Q);
    expect(after - before).toBeCloseTo(0.1, 5);
    sqlite.prepare(
      `UPDATE assignment SET pct=0.5 WHERE quarter_id='${Q}' AND ros_id='p1' AND initiative_id='i1'`,
    ).run();
  });

  it("deleting an initiative cascades to its assignments", () => {
    const before = orgAllocatedHC(Q);
    sqlite.prepare(
      `INSERT INTO initiative(id,quarter_id,status,team,name,theme) VALUES ('i_temp','${Q}','committed','RDB-KV','Temp','KTLO')`,
    ).run();
    sqlite.prepare(
      `INSERT INTO assignment(id,quarter_id,ros_id,initiative_id,pct) VALUES ('a_temp','${Q}','p1','i_temp',0.2)`,
    ).run();
    const mid = orgAllocatedHC(Q);
    expect(mid - before).toBeCloseTo(0.2, 5);

    sqlite.prepare(`DELETE FROM initiative WHERE id='i_temp'`).run();
    const after = orgAllocatedHC(Q);
    expect(after).toBeCloseTo(before, 5);
  });
});
