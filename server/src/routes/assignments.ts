import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  audit,
  bumpQuarterVersion,
  canWriteTeam,
  isQuarterWritable,
} from "../access/middleware.js";
import { getPersonAvailability } from "../queries/derived.js";

function getQuarter(id: string) {
  return db.get<{ id: string; locked: number }>(
    sql.raw(`SELECT id, locked FROM quarter WHERE id = '${id}'`),
  );
}

export async function assignmentRoutes(app: FastifyInstance) {
  // POST /api/assignments  — upserts on (quarter, person, initiative)
  app.post<{
    Body: { quarterId: string; rosId: string; initiativeId: string; pct: number };
  }>("/api/assignments", async (req, reply) => {
    const { quarterId, rosId, initiativeId, pct } = req.body;
    const user = req.user;

    if (typeof pct !== "number" || pct <= 0 || pct > 1) {
      return reply.status(400).send({ error: "pct must be > 0 and <= 1" });
    }

    const quarter = getQuarter(quarterId);
    if (!quarter) return reply.status(404).send({ error: "Quarter not found" });
    if (!isQuarterWritable(user, !!quarter.locked, false)) {
      return reply.status(403).send({ error: "Quarter is locked" });
    }

    const initiative = db.get<{ team: string }>(
      sql.raw(`SELECT team FROM initiative WHERE id = '${initiativeId}'`),
    );
    if (!initiative) return reply.status(404).send({ error: "Initiative not found" });

    if (!canWriteTeam(user, initiative.team)) {
      return reply.status(403).send({ error: "Outside your team scope" });
    }

    // Verify person has availability > 0
    const avail = getPersonAvailability(rosId);
    if (avail <= 0) {
      return reply.status(400).send({
        error: "Person has availability 0 — cannot be assigned to initiatives",
      });
    }

    // Upsert on the unique (quarter, person, initiative) key
    const existing = db.get<{ id: string }>(
      sql.raw(
        `SELECT id FROM assignment WHERE quarter_id = '${quarterId}' AND ros_id = '${rosId}' AND initiative_id = '${initiativeId}'`,
      ),
    );

    let assignmentId: string;
    if (existing) {
      assignmentId = existing.id;
      db.run(
        sql.raw(`UPDATE assignment SET pct = ${pct} WHERE id = '${existing.id}'`),
      );
      audit(user.rosId, "assignment.update", existing.id, {
        quarterId, rosId, initiativeId, pct,
      });
    } else {
      assignmentId = uuidv4();
      db.run(sql.raw(`
        INSERT INTO assignment(id, quarter_id, ros_id, initiative_id, pct)
        VALUES ('${assignmentId}', '${quarterId}', '${rosId}', '${initiativeId}', ${pct})
      `));
      audit(user.rosId, "assignment.create", assignmentId, {
        quarterId, rosId, initiativeId, pct,
      });
    }

    bumpQuarterVersion(quarterId);
    return { id: assignmentId };
  });

  // PATCH /api/assignments/:id
  app.patch<{ Params: { id: string }; Body: { pct: number } }>(
    "/api/assignments/:id",
    async (req, reply) => {
      const { id } = req.params;
      const { pct } = req.body;
      const user = req.user;

      if (typeof pct !== "number" || pct <= 0 || pct > 1) {
        return reply.status(400).send({ error: "pct must be > 0 and <= 1" });
      }

      const existing = db.get<{
        quarter_id: string;
        ros_id: string;
        initiative_id: string;
      }>(sql.raw(`SELECT quarter_id, ros_id, initiative_id FROM assignment WHERE id = '${id}'`));
      if (!existing) return reply.status(404).send({ error: "Assignment not found" });

      const quarter = getQuarter(existing.quarter_id);
      if (!quarter) return reply.status(404).send({ error: "Quarter not found" });
      if (!isQuarterWritable(user, !!quarter.locked, false)) {
        return reply.status(403).send({ error: "Quarter is locked" });
      }

      const initiative = db.get<{ team: string }>(
        sql.raw(`SELECT team FROM initiative WHERE id = '${existing.initiative_id}'`),
      );
      if (!canWriteTeam(user, initiative?.team ?? "")) {
        return reply.status(403).send({ error: "Outside your team scope" });
      }

      db.run(sql.raw(`UPDATE assignment SET pct = ${pct} WHERE id = '${id}'`));
      audit(user.rosId, "assignment.update", id, { pct });
      bumpQuarterVersion(existing.quarter_id);
      return { ok: true };
    },
  );

  // DELETE /api/assignments/:id
  app.delete<{ Params: { id: string } }>(
    "/api/assignments/:id",
    async (req, reply) => {
      const { id } = req.params;
      const user = req.user;

      const existing = db.get<{
        quarter_id: string;
        initiative_id: string;
      }>(sql.raw(`SELECT quarter_id, initiative_id FROM assignment WHERE id = '${id}'`));
      if (!existing) return reply.status(404).send({ error: "Assignment not found" });

      const quarter = getQuarter(existing.quarter_id);
      if (!quarter) return reply.status(404).send({ error: "Quarter not found" });
      if (!isQuarterWritable(user, !!quarter.locked, false)) {
        return reply.status(403).send({ error: "Quarter is locked" });
      }

      const initiative = db.get<{ team: string }>(
        sql.raw(`SELECT team FROM initiative WHERE id = '${existing.initiative_id}'`),
      );
      if (!canWriteTeam(user, initiative?.team ?? "")) {
        return reply.status(403).send({ error: "Outside your team scope" });
      }

      db.run(sql.raw(`DELETE FROM assignment WHERE id = '${id}'`));
      audit(user.rosId, "assignment.delete", id, { quarterId: existing.quarter_id });
      bumpQuarterVersion(existing.quarter_id);
      return { ok: true };
    },
  );
}
