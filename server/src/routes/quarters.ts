import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  orgAllocatedHC,
  orgCapacity,
  teamSummaries,
  themeAllocation,
  qoqThemeShift,
  initiativeHC,
  engineerAllocations,
  activeLoans,
  THEMES,
} from "../queries/derived.js";
import {
  audit,
  bumpQuarterVersion,
  canLockQuarter,
  isQuarterWritable,
} from "../access/middleware.js";

export async function quarterRoutes(app: FastifyInstance) {
  // GET /api/quarters
  app.get("/api/quarters", async (req, reply) => {
    const quarters = db.all(
      sql.raw("SELECT id, label, state, locked FROM quarter ORDER BY id DESC"),
    );
    return { quarters };
  });

  // GET /api/quarters/:q/plan
  app.get<{ Params: { q: string } }>(
    "/api/quarters/:q/plan",
    async (req, reply) => {
      const { q } = req.params;

      const quarter = db.get<{ id: string; label: string; state: string; locked: number }>(
        sql.raw(`SELECT * FROM quarter WHERE id = '${q}'`),
      );
      if (!quarter) return reply.status(404).send({ error: "Quarter not found" });

      const initiatives = db.all<Record<string, unknown>>(
        sql.raw(`SELECT * FROM initiative WHERE quarter_id = '${q}' ORDER BY status, pri NULLS LAST, name`),
      );

      const assignments = db.all<Record<string, unknown>>(
        sql.raw(`SELECT a.*, p.name as person_name, p.home_team FROM assignment a JOIN person p ON p.ros_id = a.ros_id WHERE a.quarter_id = '${q}'`),
      );

      const priorities = db.all(
        sql.raw(`SELECT rank, heading, body FROM priority WHERE quarter_id = '${q}' ORDER BY rank`),
      );

      // Derived totals — all computed from assignments
      const orgAlloc = orgAllocatedHC(q);
      const orgCap = orgCapacity();
      const teams = teamSummaries(q);
      const themes = themeAllocation(q);
      const ihc = initiativeHC(q);
      const engineers = engineerAllocations(q);
      const loans = activeLoans(q);

      // QoQ shift
      const prevQuarter = db.get<{ id: string }>(
        sql.raw(`SELECT id FROM quarter WHERE state = 'previous' LIMIT 1`),
      );
      const qoq = prevQuarter ? qoqThemeShift(q, prevQuarter.id) : null;

      // Stat card derived counts
      const committed = initiatives.filter((i) => i.status === "committed");
      const p0Count = committed.filter((i) => i.pri === "P0").length;
      const p1Count = committed.filter((i) => i.pri === "P1").length;
      const deferredCount = initiatives.filter(
        (i) => i.status === "backlog" && i.readiness === "ready",
      ).length;
      const unallocatedHC = Number((orgCap - orgAlloc).toFixed(2));

      // Add HC to each initiative
      const initiativesWithHC = initiatives.map((i) => ({
        ...i,
        hc: ihc[i.id as string] ?? 0,
      }));

      return {
        quarter,
        initiatives: initiativesWithHC,
        assignments,
        priorities,
        derived: {
          orgAllocatedHC: orgAlloc,
          orgCapacity: orgCap,
          unallocatedHC,
          committedCount: committed.length,
          p0Count,
          p1Count,
          deferredCount,
          teams,
          themes,
          qoq,
          engineers,
          loans,
        },
      };
    },
  );

  // GET /api/quarters/:q/version  (for polling)
  app.get<{ Params: { q: string } }>(
    "/api/quarters/:q/version",
    async (req, reply) => {
      const { q } = req.params;
      const row = db.get<{ version: number; updated_at: string }>(
        sql.raw(`SELECT version, updated_at FROM quarter_version WHERE quarter_id = '${q}'`),
      ) ?? { version: 0, updated_at: new Date().toISOString() };
      return row;
    },
  );

  // PATCH /api/quarters/:q  (state + lock, admin only)
  app.patch<{ Params: { q: string }; Body: { state?: string; locked?: boolean } }>(
    "/api/quarters/:q",
    async (req, reply) => {
      const { q } = req.params;
      const user = req.user;

      if (!canLockQuarter(user)) {
        return reply.status(403).send({ error: "Admin only" });
      }

      const body = req.body;
      const sets: string[] = [];
      if (body.state !== undefined) {
        const valid = ["previous", "current", "draft"];
        if (!valid.includes(body.state))
          return reply.status(400).send({ error: "Invalid state" });
        sets.push(`state = '${body.state}'`);
      }
      if (body.locked !== undefined) {
        sets.push(`locked = ${body.locked ? 1 : 0}`);
      }
      if (!sets.length) return reply.status(400).send({ error: "Nothing to update" });

      db.run(sql.raw(`UPDATE quarter SET ${sets.join(", ")} WHERE id = '${q}'`));
      audit(user.rosId, "quarter.patch", q, body);
      bumpQuarterVersion(q);
      return { ok: true };
    },
  );

  // POST /api/quarters/:q/copy  (admin: copy committed initiatives to another quarter)
  app.post<{
    Params: { q: string };
    Body: { targetQuarterId: string };
  }>("/api/quarters/:q/copy", async (req, reply) => {
    const { q } = req.params;
    const { targetQuarterId } = req.body;
    const user = req.user;

    if (!canLockQuarter(user)) {
      return reply.status(403).send({ error: "Admin only" });
    }

    const target = db.get(sql.raw(`SELECT id FROM quarter WHERE id = '${targetQuarterId}'`));
    if (!target) return reply.status(404).send({ error: "Target quarter not found" });

    const committed = db.all<Record<string, unknown>>(
      sql.raw(`SELECT * FROM initiative WHERE quarter_id = '${q}' AND status = 'committed'`),
    );

    for (const init of committed) {
      const newId = uuidv4();
      db.run(sql.raw(`
        INSERT INTO initiative(id, quarter_id, status, team, name, theme, pri, deliverables, metrics)
        VALUES (
          '${newId}',
          '${targetQuarterId}',
          'committed',
          '${init.team}',
          '${(init.name as string).replace(/'/g, "''")}',
          '${init.theme}',
          ${init.pri ? `'${init.pri}'` : "NULL"},
          ${init.deliverables ? `'${(init.deliverables as string).replace(/'/g, "''")}'` : "NULL"},
          ${init.metrics ? `'${(init.metrics as string).replace(/'/g, "''")}'` : "NULL"}
        )
      `));
    }

    audit(user.rosId, "quarter.copy", targetQuarterId, {
      fromQuarter: q,
      count: committed.length,
    });
    bumpQuarterVersion(targetQuarterId);
    return { ok: true, copied: committed.length };
  });

  // GET /api/quarters/:q/audit
  app.get<{ Params: { q: string } }>(
    "/api/quarters/:q/audit",
    async (req, reply) => {
      // Filter by entity references to this quarter
      const rows = db.all(
        sql.raw(`
          SELECT al.*, p.name as actor_name
          FROM audit_log al
          LEFT JOIN person p ON p.ros_id = al.actor_ros_id
          WHERE al.entity LIKE '%${req.params.q}%' OR al.detail LIKE '%${req.params.q}%'
          ORDER BY al.ts DESC
          LIMIT 500
        `),
      );
      return { entries: rows };
    },
  );
}
