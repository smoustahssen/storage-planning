import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { audit } from "../access/middleware.js";

export async function peopleRoutes(app: FastifyInstance) {
  // GET /api/people  — active org under Yawei, with role and availability
  app.get("/api/people", async (req, reply) => {
    const rows = db.all(sql.raw(`
      SELECT
        p.ros_id,
        p.name,
        p.email,
        p.role,
        p.home_team,
        p.manager_ros_id,
        p.active,
        COALESCE(ao.availability, CASE p.role WHEN 'IC' THEN 1.0 ELSE 0.0 END) AS availability
      FROM person p
      LEFT JOIN availability_override ao ON ao.ros_id = p.ros_id
      WHERE p.active = 1
      ORDER BY p.home_team, p.name
    `));
    return { people: rows };
  });

  // PUT /api/people/:rosId/availability  — override per-person
  app.put<{ Params: { rosId: string }; Body: { availability: number } }>(
    "/api/people/:rosId/availability",
    async (req, reply) => {
      const { rosId } = req.params;
      const { availability } = req.body;
      const user = req.user;

      if (user.role !== "admin") {
        return reply.status(403).send({ error: "Admin only" });
      }

      if (
        typeof availability !== "number" ||
        availability < 0 ||
        availability > 1
      ) {
        return reply.status(400).send({ error: "availability must be 0–1" });
      }

      db.run(sql.raw(`
        INSERT INTO availability_override(ros_id, availability) VALUES ('${rosId}', ${availability})
        ON CONFLICT(ros_id) DO UPDATE SET availability = excluded.availability
      `));

      audit(user.rosId, "person.availability.set", rosId, { availability });
      return { ok: true };
    },
  );

  // DELETE /api/people/:rosId/availability  — revert to role default
  app.delete<{ Params: { rosId: string } }>(
    "/api/people/:rosId/availability",
    async (req, reply) => {
      const { rosId } = req.params;
      const user = req.user;

      if (user.role !== "admin") {
        return reply.status(403).send({ error: "Admin only" });
      }

      db.run(sql.raw(`DELETE FROM availability_override WHERE ros_id = '${rosId}'`));
      audit(user.rosId, "person.availability.clear", rosId, {});
      return { ok: true };
    },
  );

  // PUT /api/people/:rosId/homeTeam  — move person to a different team
  app.put<{ Params: { rosId: string }; Body: { homeTeam: string } }>(
    "/api/people/:rosId/homeTeam",
    async (req, reply) => {
      const { rosId } = req.params;
      const { homeTeam } = req.body;
      const user = req.user;

      if (user.role !== "admin") {
        return reply.status(403).send({ error: "Admin only" });
      }

      const VALID_TEAMS = ["RDB-KV", "RDB-PG", "EaaS", "RaaS", "QaaS", "R3", "SIM", "MS SQL"];
      if (!VALID_TEAMS.includes(homeTeam)) {
        return reply.status(400).send({ error: "Invalid team" });
      }

      const exists = db.get(sql.raw(`SELECT ros_id FROM person WHERE ros_id = '${rosId}'`));
      if (!exists) {
        return reply.status(404).send({ error: "Person not found" });
      }

      db.run(sql.raw(`UPDATE person SET home_team = '${homeTeam}' WHERE ros_id = '${rosId}'`));
      audit(user.rosId, "person.homeTeam.set", rosId, { homeTeam });
      return { ok: true };
    },
  );
}
