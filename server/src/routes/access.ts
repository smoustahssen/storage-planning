import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { audit, canManageAccess } from "../access/middleware.js";

export async function accessRoutes(app: FastifyInstance) {
  // GET /api/access — list all elevated grants
  app.get("/api/access", async (_req, _reply) => {
    const grants = db.all(sql.raw(`
      SELECT email, role, scope
      FROM email_access
      ORDER BY role DESC, email
    `));
    return { grants };
  });

  // PUT /api/access/:email — grant or update (admin only)
  app.put<{
    Params: { email: string };
    Body: { role: "admin" | "editor"; scope: string };
  }>("/api/access/:email", async (req, reply) => {
    const email = decodeURIComponent(req.params.email);
    const { role, scope } = req.body;
    const user = req.user;

    if (!canManageAccess(user)) {
      return reply.status(403).send({ error: "Admin only" });
    }
    if (!email.endsWith("@roblox.com")) {
      return reply.status(400).send({ error: "Must be a @roblox.com email" });
    }
    if (!["admin", "editor"].includes(role)) {
      return reply.status(400).send({ error: "Invalid role" });
    }

    db.run(sql.raw(`
      INSERT INTO email_access(email, role, scope) VALUES ('${email}', '${role}', '${scope}')
      ON CONFLICT(email) DO UPDATE SET role = excluded.role, scope = excluded.scope
    `));

    audit(user.rosId, "access.grant.set", email, { role, scope });
    return { ok: true };
  });

  // DELETE /api/access/:email — revoke back to viewer (admin only)
  app.delete<{ Params: { email: string } }>(
    "/api/access/:email",
    async (req, reply) => {
      const email = decodeURIComponent(req.params.email);
      const user = req.user;

      if (!canManageAccess(user)) {
        return reply.status(403).send({ error: "Admin only" });
      }
      if (email === user.email) {
        return reply.status(400).send({ error: "Cannot revoke your own admin access" });
      }

      db.run(sql.raw(`DELETE FROM email_access WHERE email = '${email}'`));
      audit(user.rosId, "access.grant.revoke", email, {});
      return { ok: true };
    },
  );

  // POST /api/access/revoke-all — revoke all editors (admin only)
  app.post("/api/access/revoke-all", async (req, reply) => {
    const user = req.user;

    if (!canManageAccess(user)) {
      return reply.status(403).send({ error: "Admin only" });
    }

    db.run(sql.raw(`DELETE FROM email_access WHERE role != 'admin'`));
    audit(user.rosId, "access.revoke-all", "all", {});
    return { ok: true };
  });

  // GET /api/access/me — current user identity and role
  app.get("/api/access/me", async (req, _reply) => {
    return {
      rosId: req.user.rosId,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      scope: req.user.scope,
    };
  });

  // GET /api/people/search?q= — for the access tab people picker
  app.get<{ Querystring: { q?: string } }>(
    "/api/people/search",
    async (req, _reply) => {
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
