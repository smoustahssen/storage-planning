import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import type { AuthUser } from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}

// ─── Middleware ──────────────────────────────────────────────────────────────

export async function ssoMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Only apply auth to API routes
  if (!request.raw.url?.startsWith("/api/")) return;

  // Identify the caller by their @roblox.com email sent from the browser
  let email: string;
  const headerEmail = request.headers["x-user-email"] as string | undefined;

  if (headerEmail) {
    if (!headerEmail.endsWith("@roblox.com")) {
      return reply.status(401).send({ error: "Must use a @roblox.com email" });
    }
    email = headerEmail;
  } else if (process.env.DEV_USER) {
    // Local dev fallback — look up the DEV_USER person's email
    const p = db.get<{ email: string }>(
      sql.raw(`SELECT email FROM person WHERE ros_id = '${process.env.DEV_USER}' AND active = 1`),
    );
    email = p?.email ?? `${process.env.DEV_USER}@roblox.com`;
  } else {
    return reply.status(401).send({ error: "Not signed in" });
  }

  // Look up person record (for rosId, name — needed for team members)
  const person = db.get<{ ros_id: string; name: string }>(
    sql.raw(`SELECT ros_id, name FROM person WHERE email = '${email}' AND active = 1`),
  );

  // Look up elevated role in email_access
  const grant = db.get<{ role: string; scope: string }>(
    sql.raw(`SELECT role, scope FROM email_access WHERE email = '${email}'`),
  );

  request.user = {
    rosId: person?.ros_id ?? email,
    name: person?.name ?? email.split("@")[0],
    email,
    role: (grant?.role ?? "viewer") as AuthUser["role"],
    scope: grant?.scope ?? "",
  };
}

// ─── Access decisions ────────────────────────────────────────────────────────

export function canWrite(user: AuthUser): boolean {
  return user.role === "admin" || user.role === "editor";
}

export function canWriteTeam(user: AuthUser, team: string): boolean {
  if (user.role === "admin") return true;
  if (user.role === "editor") {
    return user.scope === "All" || user.scope === team;
  }
  return false;
}

export function canWriteTheme(user: AuthUser): boolean {
  return user.role === "admin";
}

export function canMoveInitiativePriority(user: AuthUser, team: string): boolean {
  if (user.role === "admin") return true;
  if (user.role === "editor") {
    return user.scope === "All" || user.scope === team;
  }
  return false;
}

export function canManageAccess(user: AuthUser): boolean {
  return user.role === "admin";
}

export function canLockQuarter(user: AuthUser): boolean {
  return user.role === "admin";
}

export function isQuarterWritable(
  user: AuthUser,
  locked: boolean,
  stateChange: boolean,
): boolean {
  if (locked && !stateChange) return false;
  if (locked && stateChange) return user.role === "admin";
  return true;
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from "uuid";

export function audit(
  actorRosId: string,
  action: string,
  entity: string,
  detail: Record<string, unknown>,
) {
  db.run(sql.raw(`
    INSERT INTO audit_log(id, actor_ros_id, action, entity, detail)
    VALUES (
      '${uuidv4()}',
      '${actorRosId}',
      '${action}',
      '${entity}',
      '${JSON.stringify(detail).replace(/'/g, "''")}'
    )
  `));
}

export function bumpQuarterVersion(quarterId: string) {
  db.run(sql.raw(`
    INSERT INTO quarter_version(quarter_id, version, updated_at)
    VALUES ('${quarterId}', 1, datetime('now'))
    ON CONFLICT(quarter_id) DO UPDATE SET
      version    = version + 1,
      updated_at = datetime('now')
  `));
}
