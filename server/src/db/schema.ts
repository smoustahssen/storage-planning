import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Org (synced nightly from ROS, read-only) ───────────────────────────────

export const person = sqliteTable("person", {
  rosId: text("ros_id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["IC", "Manager"] }).notNull(),
  homeTeam: text("home_team").notNull(),
  managerRosId: text("manager_ros_id"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

// Tool-owned override; falls back to role default when absent.
export const availabilityOverride = sqliteTable("availability_override", {
  rosId: text("ros_id")
    .primaryKey()
    .references(() => person.rosId),
  availability: real("availability").notNull(),
});

// ─── Quarters ───────────────────────────────────────────────────────────────

export const quarter = sqliteTable("quarter", {
  id: text("id").primaryKey(),       // e.g. '2026Q3'
  label: text("label").notNull(),    // 'Q3 2026'
  state: text("state", { enum: ["previous", "current", "draft"] }).notNull(),
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
});

// ─── Initiatives ────────────────────────────────────────────────────────────

export const initiative = sqliteTable("initiative", {
  id: text("id").primaryKey(),              // UUID
  quarterId: text("quarter_id")
    .notNull()
    .references(() => quarter.id),
  status: text("status", { enum: ["committed", "backlog"] }).notNull(),
  team: text("team").notNull(),             // one of the eight teams, or 'All'
  name: text("name").notNull(),
  theme: text("theme", {
    enum: ["KTLO", "Reliability", "Security", "Cust Exp", "Efficiency"],
  }).notNull(),
  // committed fields
  pri: text("pri", { enum: ["P0", "P1", "P2"] }),
  deliverables: text("deliverables"),
  metrics: text("metrics"),
  // backlog fields
  readiness: text("readiness", {
    enum: ["ready", "scope", "parked", "watch"],
  }),
  problemValue: text("problem_value"),
  successMetric: text("success_metric"),
  effort: text("effort"),
  earliest: text("earliest"),
  requestorDri: text("requestor_dri"),
  nextAction: text("next_action"),
});

// ─── Assignments — the only place HC comes from ─────────────────────────────

export const assignment = sqliteTable(
  "assignment",
  {
    id: text("id").primaryKey(),             // UUID
    quarterId: text("quarter_id")
      .notNull()
      .references(() => quarter.id),
    rosId: text("ros_id")
      .notNull()
      .references(() => person.rosId),
    initiativeId: text("initiative_id")
      .notNull()
      .references(() => initiative.id, { onDelete: "cascade" }),
    pct: real("pct").notNull(),              // 0 < pct <= 1
  },
  (t) => ({
    // prevents double-counting; upsert on this key
    uniq: uniqueIndex("assignment_quarter_person_initiative_uniq").on(
      t.quarterId,
      t.rosId,
      t.initiativeId,
    ),
  }),
);

// ─── Top Priorities ─────────────────────────────────────────────────────────

export const priority = sqliteTable(
  "priority",
  {
    quarterId: text("quarter_id")
      .notNull()
      .references(() => quarter.id),
    rank: integer("rank").notNull(),
    heading: text("heading").notNull(),
    body: text("body").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.quarterId, t.rank] }),
  }),
);

// ─── Access grants ──────────────────────────────────────────────────────────

export const accessGrant = sqliteTable("access_grant", {
  rosId: text("ros_id")
    .primaryKey()
    .references(() => person.rosId),
  role: text("role", { enum: ["admin", "editor"] }).notNull(),
  scope: text("scope").notNull(), // team name or 'All'
});

// ─── Audit log ──────────────────────────────────────────────────────────────

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),                // UUID
  ts: text("ts")
    .notNull()
    .default(sql`(datetime('now'))`),
  actorRosId: text("actor_ros_id").notNull(),
  action: text("action").notNull(),           // e.g. 'assignment.update'
  entity: text("entity").notNull(),
  detail: text("detail").notNull(),           // JSON string (SQLite has no jsonb)
});

// ─── Quarter version (for polling) ──────────────────────────────────────────
// Incremented on every mutation to that quarter. Clients poll this to detect changes.

export const quarterVersion = sqliteTable("quarter_version", {
  quarterId: text("quarter_id")
    .primaryKey()
    .references(() => quarter.id),
  version: integer("version").notNull().default(0),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
