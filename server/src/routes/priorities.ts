import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { audit, bumpQuarterVersion } from "../access/middleware.js";

export async function priorityRoutes(app: FastifyInstance) {
  // PUT /api/quarters/:q/priorities  — admin only, replaces all priorities
  app.put<{
    Params: { q: string };
    Body: { priorities: Array<{ rank: number; heading: string; body: string }> };
  }>("/api/quarters/:q/priorities", async (req, reply) => {
    const { q } = req.params;
    const user = req.user;

    if (user.role !== "admin") {
      return reply.status(403).send({ error: "Admin only" });
    }

    const quarter = db.get(sql.raw(`SELECT id, locked FROM quarter WHERE id = '${q}'`)) as any;
    if (!quarter) return reply.status(404).send({ error: "Quarter not found" });
    if (quarter.locked) {
      return reply.status(403).send({ error: "Quarter is locked" });
    }

    const { priorities } = req.body;
    db.run(sql.raw(`DELETE FROM priority WHERE quarter_id = '${q}'`));
    for (const p of priorities) {
      db.run(sql.raw(`
        INSERT INTO priority(quarter_id, rank, heading, body)
        VALUES (
          '${q}',
          ${p.rank},
          '${p.heading.replace(/'/g, "''")}',
          '${p.body.replace(/'/g, "''")}'
        )
      `));
    }

    audit(user.rosId, "priorities.set", q, { count: priorities.length });
    bumpQuarterVersion(q);
    return { ok: true };
  });
}
