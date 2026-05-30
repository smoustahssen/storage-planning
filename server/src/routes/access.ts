import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { audit, canManageAccess } from "../access/middleware.js";
import { SARA_M_ROS_ID } from "../ros/fixture.js";

export async function accessRoutes(app: FastifyInstance) {
  // GET /api/access
  app.get("/api/access", async (req, reply) => {
    const grants = db.all(sql.raw(`
      SELECT ag.ros_id, ag.role, ag.scope, p.name, p.email
      FROM access_grant ag
      JOIN person p ON p.ros_id = ag.ros_id
      ORDER BY ag.role DESC, p.name
    `));
    return { grants };
  });

  // PUT /api/access/:rosId  — set or update a grant (admin only)
  app.put<{
    Params: { rosId: string };
    Body: { role: "admin" | "editor"; scope: string };
  }>("/api/access/:rosId", async (req, reply) => {
    const { rosId } = req.params;
    const { role, scope } = req.body;
    const user = req.user;

    if (!canManageAccess(user)) {
      return reply.status(403).send({ error: "Admin only" });
    }

    const validRoles = ["admin", "editor"];
    if (!validRoles.includes(role)) {
      return reply.status(400).send({ error: "Invalid role" });
    }

    db.run(sql.raw(`
      INSERT INTO access_grant(ros_id, role, scope) VALUES ('${rosId}', '${role}', '${scope}')
      ON CONFLICT(ros_id) DO UPDATE SET role = excluded.role, scope = excluded.scope
    `));

    audit(user.rosId, "access.grant.set", rosId, { role, scope });
    return { ok: true };
  });

  // DELETE /api/access/:rosId  — revoke to viewer (admin only)
  app.delete<{ Params: { rosId: string } }>(
    "/api/access/:rosId",
    async (req, reply) => {
      const { rosId } = req.params;
      const user = req.user;

      if (!canManageAccess(user)) {
        return reply.status(403).send({ error: "Admin only" });
      }

      // Cannot revoke the admin themselves (Sara M)
      if (rosId === SARA_M_ROS_ID) {
        return reply.status(400).send({ error: "Cannot revoke the primary admin" });
      }

      db.run(sql.raw(`DELETE FROM access_grant WHERE ros_id = '${rosId}'`));
      audit(user.rosId, "access.grant.revoke", rosId, {});
      return { ok: true };
    },
  );

  // POST /api/access/revoke-all  — revoke everyone except admin (admin only)
  app.post("/api/access/revoke-all", async (req, reply) => {
    const user = req.user;

    if (!canManageAccess(user)) {
      return reply.status(403).send({ error: "Admin only" });
    }

    db.run(sql.raw(`
      DELETE FROM access_grant WHERE role != 'admin'
    `));

    audit(user.rosId, "access.revoke-all", "all", {});
    return { ok: true };
  });

  // GET /api/access/me  — current user's identity and role
  app.get("/api/access/me", async (req, reply) => {
    return {
      rosId: req.user.rosId,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      scope: req.user.scope,
    };
  });

  // GET /api/people/search?q=  — for the access tab people picker
  app.get<{ Querystring: { q?: string } }>(
    "/api/people/search",
    async (req, reply) => {
      const q = (req.query.q ?? "").replace(/'/g, "''");
      const rows = db.all(sql.raw(`
        SELECT ros_id, name, email, home_team
        FROM person
        WHERE active = 1
          AND (LOWER(name) LIKE LOWER('%${q}%') OR LOWER(email) LIKE LOWER('%${q}%'))
        LIMIT 20
      `));
      return { people: rows };
    },
  );
}
