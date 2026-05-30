import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import { ssoMiddleware } from "./access/middleware.js";
import { quarterRoutes } from "./routes/quarters.js";
import { initiativeRoutes } from "./routes/initiatives.js";
import { assignmentRoutes } from "./routes/assignments.js";
import { peopleRoutes } from "./routes/people.js";
import { accessRoutes } from "./routes/access.js";
import { priorityRoutes } from "./routes/priorities.js";
import { authRoutes } from "./routes/auth.js";
import { runMigrations } from "./db/migrate.js";
import { syncROS } from "./sync/rosSync.js";
import { FixtureOrgDirectory, SARA_M_ROS_ID } from "./ros/fixture.js";
import { db } from "./db/client.js";
import { sql } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  credentials: true,
});

await app.register(cookie);

// SSO on every API route (auth routes opt out via URL check inside ssoMiddleware)
app.addHook("preHandler", ssoMiddleware);

// Auth routes (GitHub OAuth dance — exempt from SSO)
await app.register(authRoutes);

// Register API routes
await app.register(quarterRoutes);
await app.register(initiativeRoutes);
await app.register(assignmentRoutes);
await app.register(peopleRoutes);
await app.register(accessRoutes);
await app.register(priorityRoutes);

// Healthcheck (no auth needed)
app.get("/healthz", { preHandler: [] }, async () => ({ ok: true }));

// In production, serve the built React frontend from web/dist
const webDist = path.join(__dirname, "..", "..", "web", "dist");
import fs from "fs";
if (fs.existsSync(webDist)) {
  await app.register(staticFiles, { root: webDist, prefix: "/" });
  // SPA fallback — send index.html for any non-API/non-asset route
  app.setNotFoundHandler(async (_req, reply) => {
    return reply.sendFile("index.html");
  });
}

const PORT = Number(process.env.PORT ?? 3001);

async function start() {
  await runMigrations();

  const useFixture = process.env.USE_FIXTURE_ROS !== "false";
  if (useFixture) {
    await syncROS(new FixtureOrgDirectory());
  }

  // Seed the first admin. Set FIRST_ADMIN_ROS_ID to your rosId.
  const firstAdminId = process.env.FIRST_ADMIN_ROS_ID ?? SARA_M_ROS_ID;
  const existing = db.get(
    sql.raw(`SELECT ros_id FROM access_grant WHERE ros_id = '${firstAdminId}'`),
  );
  if (!existing) {
    db.run(sql.raw(`
      INSERT OR IGNORE INTO access_grant(ros_id, role, scope)
      VALUES ('${firstAdminId}', 'admin', 'All')
    `));
    console.log(`[boot] Seeded ${firstAdminId} as admin`);
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Storage planner server running on :${PORT}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
