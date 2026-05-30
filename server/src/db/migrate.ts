import { db } from "./client.js";
import { sql } from "drizzle-orm";

const MIGRATIONS = [
  // 001 – initial schema
  `
  CREATE TABLE IF NOT EXISTS person (
    ros_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('IC','Manager')),
    home_team TEXT NOT NULL,
    manager_ros_id TEXT,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS availability_override (
    ros_id TEXT PRIMARY KEY REFERENCES person(ros_id),
    availability REAL NOT NULL CHECK (availability >= 0 AND availability <= 1)
  );

  CREATE TABLE IF NOT EXISTS quarter (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('previous','current','draft')),
    locked INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS initiative (
    id TEXT PRIMARY KEY,
    quarter_id TEXT NOT NULL REFERENCES quarter(id),
    status TEXT NOT NULL CHECK (status IN ('committed','backlog')),
    team TEXT NOT NULL,
    name TEXT NOT NULL,
    theme TEXT NOT NULL CHECK (theme IN ('KTLO','Reliability','Security','Cust Exp','Efficiency')),
    pri TEXT CHECK (pri IN ('P0','P1','P2')),
    deliverables TEXT,
    metrics TEXT,
    readiness TEXT CHECK (readiness IN ('ready','scope','parked','watch')),
    problem_value TEXT,
    success_metric TEXT,
    effort TEXT,
    earliest TEXT,
    requestor_dri TEXT,
    next_action TEXT
  );

  CREATE TABLE IF NOT EXISTS assignment (
    id TEXT PRIMARY KEY,
    quarter_id TEXT NOT NULL REFERENCES quarter(id),
    ros_id TEXT NOT NULL REFERENCES person(ros_id),
    initiative_id TEXT NOT NULL REFERENCES initiative(id) ON DELETE CASCADE,
    pct REAL NOT NULL CHECK (pct > 0 AND pct <= 1),
    UNIQUE (quarter_id, ros_id, initiative_id)
  );

  CREATE TABLE IF NOT EXISTS priority (
    quarter_id TEXT NOT NULL REFERENCES quarter(id),
    rank INTEGER NOT NULL,
    heading TEXT NOT NULL,
    body TEXT NOT NULL,
    PRIMARY KEY (quarter_id, rank)
  );

  CREATE TABLE IF NOT EXISTS access_grant (
    ros_id TEXT PRIMARY KEY REFERENCES person(ros_id),
    role TEXT NOT NULL CHECK (role IN ('admin','editor')),
    scope TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    actor_ros_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    detail TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS quarter_version (
    quarter_id TEXT PRIMARY KEY REFERENCES quarter(id),
    version INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `,

  // 002 – auth sessions
  `
  CREATE TABLE IF NOT EXISTS session (
    token      TEXT PRIMARY KEY,
    ros_id     TEXT NOT NULL REFERENCES person(ros_id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
  )
  `,
  `
  CREATE INDEX IF NOT EXISTS idx_session_ros_id ON session(ros_id)
  `,
];

export async function runMigrations() {
  // SQLite: run each migration idempotently (CREATE TABLE IF NOT EXISTS)
  for (const migration of MIGRATIONS) {
    const statements = migration
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      db.run(sql.raw(stmt));
    }
  }
  console.log("Migrations applied.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}
