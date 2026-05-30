import Fastify from "fastify";
import cors from "@fastify/cors";
import staticFiles from "@fastify/static";
import { ssoMiddleware } from "./access/middleware.js";
import { quarterRoutes } from "./routes/quarters.js";
import { initiativeRoutes } from "./routes/initiatives.js";
import { assignmentRoutes } from "./routes/assignments.js";
import { peopleRoutes } from "./routes/people.js";
import { accessRoutes } from "./routes/access.js";
import { priorityRoutes } from "./routes/priorities.js";
import { runMigrations } from "./db/migrate.js";
import { syncROS } from "./sync/rosSync.js";
import { FixtureOrgDirectory } from "./ros/fixture.js";
import { db } from "./db/client.js";
import { sql } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  credentials: true,
});

app.addHook("preHandler", ssoMiddleware);

await app.register(quarterRoutes);
await app.register(initiativeRoutes);
await app.register(assignmentRoutes);
await app.register(peopleRoutes);
await app.register(accessRoutes);
await app.register(priorityRoutes);

app.get("/healthz", { preHandler: [] }, async () => ({ ok: true }));

// Serve the built React frontend in production
const webDist = path.join(__dirname, "..", "..", "web", "dist");
if (fs.existsSync(webDist)) {
  await app.register(staticFiles, { root: webDist, prefix: "/" });
  app.setNotFoundHandler(async (_req, reply) => reply.sendFile("index.html"));
}

const PORT = Number(process.env.PORT ?? 3001);

async function start() {
  await runMigrations();

  const useFixture = process.env.USE_FIXTURE_ROS !== "false";
  if (useFixture) {
    await syncROS(new FixtureOrgDirectory());
  }

  // Seed the first admin by email
  const firstAdminEmail = process.env.FIRST_ADMIN_EMAIL;
  if (firstAdminEmail) {
    const existing = db.get(
      sql.raw(`SELECT email FROM email_access WHERE email = '${firstAdminEmail}'`),
    );
    if (!existing) {
      db.run(sql.raw(`
        INSERT OR IGNORE INTO email_access(email, role, scope)
        VALUES ('${firstAdminEmail}', 'admin', 'All')
      `));
      console.log(`[boot] Seeded ${firstAdminEmail} as admin`);
    }
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Storage planner server running on :${PORT}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
