import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  audit,
  bumpQuarterVersion,
  canWriteTeam,
  canWriteTheme,
  canMoveInitiativePriority,
  isQuarterWritable,
} from "../access/middleware.js";

const VALID_THEMES = ["KTLO", "Reliability", "Security", "Cust Exp", "Efficiency"];
const VALID_STATUS = ["committed", "backlog"];
const VALID_PRI = ["P0", "P1", "P2"];
const VALID_READINESS = ["ready", "scope", "parked", "watch"];

function getQuarter(id: string) {
  return db.get<{ id: string; locked: number }>(
    sql.raw(`SELECT id, locked FROM quarter WHERE id = '${id}'`),
  );
}

export async function initiativeRoutes(app: FastifyInstance) {
  // POST /api/quarters/:q/initiatives
  app.post<{
    Params: { q: string };
    Body: Record<string, unknown>;
  }>("/api/quarters/:q/initiatives", async (req, reply) => {
    const { q } = req.params;
    const user = req.user;
    const body = req.body;

    const quarter = getQuarter(q);
    if (!quarter) return reply.status(404).send({ error: "Quarter not found" });
    if (!isQuarterWritable(user, !!quarter.locked, false)) {
      return reply.status(403).send({ error: "Quarter is locked" });
    }

    const team = String(body.team ?? "");
    if (!canWriteTeam(user, team)) {
      return reply.status(403).send({ error: "Outside your team scope" });
    }

    const theme = String(body.theme ?? "");
    if (!VALID_THEMES.includes(theme)) {
      return reply.status(400).send({ error: "Invalid theme" });
    }

    const status = String(body.status ?? "committed");
    if (!VALID_STATUS.includes(status)) {
      return reply.status(400).send({ error: "Invalid status" });
    }

    const id = uuidv4();
    const readiness = body.readiness ? String(body.readiness) : null;

    db.run(sql.raw(`
      INSERT INTO initiative(
        id, quarter_id, status, team, name, theme,
        pri, deliverables, metrics,
        readiness, problem_value, success_metric, effort,
        earliest, requestor_dri, next_action
      ) VALUES (
        '${id}', '${q}',
        '${status}',
        '${team}',
        '${String(body.name ?? "").replace(/'/g, "''")}',
        '${theme}',
        ${body.pri && VALID_PRI.includes(String(body.pri)) ? `'${body.pri}'` : "NULL"},
        ${body.deliverables ? `'${String(body.deliverables).replace(/'/g, "''")}'` : "NULL"},
        ${body.metrics ? `'${String(body.metrics).replace(/'/g, "''")}'` : "NULL"},
        ${readiness && VALID_READINESS.includes(readiness) ? `'${readiness}'` : "NULL"},
        ${body.problem_value ? `'${String(body.problem_value).replace(/'/g, "''")}'` : "NULL"},
        ${body.success_metric ? `'${String(body.success_metric).replace(/'/g, "''")}'` : "NULL"},
        ${body.effort ? `'${String(body.effort).replace(/'/g, "''")}'` : "NULL"},
        ${body.earliest ? `'${String(body.earliest).replace(/'/g, "''")}'` : "NULL"},
        ${body.requestor_dri ? `'${String(body.requestor_dri).replace(/'/g, "''")}'` : "NULL"},
        ${body.next_action ? `'${String(body.next_action).replace(/'/g, "''")}'` : "NULL"}
      )
    `));

    audit(user.rosId, "initiative.create", id, { quarterId: q, ...body });
    bumpQuarterVersion(q);
    return { id };
  });

  // PATCH /api/initiatives/:id
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/api/initiatives/:id",
    async (req, reply) => {
      const { id } = req.params;
      const user = req.user;
      const body = req.body;

      const existing = db.get<{ quarter_id: string; team: string; theme: string; status: string; name: string }>(
        sql.raw(`SELECT quarter_id, team, theme, status, name FROM initiative WHERE id = '${id}'`),
      );
      if (!existing) return reply.status(404).send({ error: "Initiative not found" });

      const quarter = getQuarter(existing.quarter_id);
      if (!quarter) return reply.status(404).send({ error: "Quarter not found" });
      if (!isQuarterWritable(user, !!quarter.locked, false)) {
        return reply.status(403).send({ error: "Quarter is locked" });
      }

      if (!canWriteTeam(user, existing.team)) {
        return reply.status(403).send({ error: "Outside your team scope" });
      }

      // Theme is admin-only
      if (body.theme !== undefined && !canWriteTheme(user)) {
        return reply.status(403).send({ error: "Theme classification is admin-only" });
      }

      // Status (commit/defer) is delegated to scoped editors
      if (body.status !== undefined && !canMoveInitiativePriority(user, existing.team)) {
        return reply.status(403).send({ error: "Cannot change initiative status" });
      }

      const sets: string[] = [];
      const allowed = [
        "name", "team", "theme", "status", "pri", "deliverables", "metrics",
        "readiness", "problem_value", "success_metric", "effort",
        "earliest", "requestor_dri", "next_action",
      ];
      for (const key of allowed) {
        if (!(key in body)) continue;
        const val = body[key];
        if (val === null || val === undefined) {
          sets.push(`${key} = NULL`);
        } else {
          sets.push(`${key} = '${String(val).replace(/'/g, "''")}'`);
        }
      }

      if (!sets.length) return reply.status(400).send({ error: "Nothing to update" });

      db.run(sql.raw(`UPDATE initiative SET ${sets.join(", ")} WHERE id = '${id}'`));
      audit(user.rosId, "initiative.patch", id, { _name: existing.name, _team: existing.team, ...body });
      bumpQuarterVersion(existing.quarter_id);
      return { ok: true };
    },
  );

  // DELETE /api/initiatives/:id
  app.delete<{ Params: { id: string } }>(
    "/api/initiatives/:id",
    async (req, reply) => {
      const { id } = req.params;
      const user = req.user;

      const existing = db.get<{ quarter_id: string; team: string; name: string }>(
        sql.raw(`SELECT quarter_id, team, name FROM initiative WHERE id = '${id}'`),
      );
      if (!existing) return reply.status(404).send({ error: "Not found" });

      const quarter = getQuarter(existing.quarter_id);
      if (!quarter) return reply.status(404).send({ error: "Quarter not found" });
      if (!isQuarterWritable(user, !!quarter.locked, false)) {
        return reply.status(403).send({ error: "Quarter is locked" });
      }

      if (!canWriteTeam(user, existing.team)) {
        return reply.status(403).send({ error: "Outside your team scope" });
      }

      // CASCADE deletes assignments
      db.run(sql.raw(`DELETE FROM initiative WHERE id = '${id}'`));
      audit(user.rosId, "initiative.delete", id, { quarterId: existing.quarter_id, name: existing.name, team: existing.team });
      bumpQuarterVersion(existing.quarter_id);
      return { ok: true };
    },
  );
}
