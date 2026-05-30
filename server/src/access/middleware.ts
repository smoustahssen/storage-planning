import type { FastifyRequest, FastifyReply } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { SARA_M_ROS_ID } from "../ros/fixture.js";
import type { AuthUser } from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser;
  }
}

const IS_GITHUB_AUTH = !!process.env.GITHUB_CLIENT_ID;

// ─── Middleware ──────────────────────────────────────────────────────────────

export async function ssoMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Only apply auth to API routes — static files and OAuth routes are public
  const { url } = request.raw;
  if (!url?.startsWith("/api/")) return;

  let rosId: string;

  if (IS_GITHUB_AUTH) {
    // ── Production: validate session cookie ─────────────────────────────────
    const token = request.cookies?.session;
    if (!token) {
      return reply.status(401).send({ error: "Not signed in" });
    }

    const session = db.get<{ ros_id: string }>(
      sql.raw(`
        SELECT ros_id FROM session
        WHERE token = '${token}'
          AND expires_at > datetime('now')
      `),
    );
    if (!session) {
      reply.clearCookie("session", { path: "/" });
      return reply.status(401).send({ error: "Session expired — please sign in again" });
    }
    rosId = session.ros_id;

  } else {
    // ── Dev fallback: x-as-user header or DEV_USER env var ──────────────────
    rosId = (request.headers["x-as-user"] as string | undefined)
      ?? process.env.DEV_USER
      ?? SARA_M_ROS_ID;
  }

  const person = db.get<{ ros_id: string; name: string; email: string }>(
    sql.raw(`SELECT ros_id, name, email FROM person WHERE ros_id = '${rosId}' AND active = 1`),
  );
  if (!person) {
    return reply.status(401).send({ error: "Unauthenticated or inactive user" });
  }

  const grant = db.get<{ role: string; scope: string }>(
    sql.raw(`SELECT role, scope FROM access_grant WHERE ros_id = '${person.ros_id}'`),
  );

  request.user = {
    rosId: person.ros_id,
    name: person.name,
    email: person.email,
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
