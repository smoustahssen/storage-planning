# Working agreement

This repo is the Storage planner, an internal quarterly planning tool. Before any
change, reread design-reference/storage_planner_mock.html for layout and behavior,
and the build specification for data, access, and correctness rules.

Cardinal rule: headcount is never stored. One assignment table. Every HC number is
an aggregation over it. Do not add a stored or cached total as a writable field.

Other hard rules:
- Read ROS, never write it. Identity is SSO on every route.
- Access is enforced on the server: viewers cannot write, editors are scoped to a
  team, locked quarters reject writes except an admin changing state.
- Upsert assignments on (quarter, person, initiative). Never double-count.
- Theme classification is admin-only. Default everyone to view, no grant needed.
- If the ROS contract is unconfirmed, build against the adapter fixture and flag it.
  Do not invent endpoints.

When unsure, stop and ask rather than guess. Match the mock for appearance, follow
the spec for data and access, and raise any conflict between them.

## Stack
- Backend: TypeScript + Fastify (Node 20+)
- DB: Drizzle ORM → Postgres in prod, SQLite (better-sqlite3) in local/test
- Frontend: React 18 + TypeScript + Vite
- Auth: Roblox SSO (mocked in dev via DEV_USER env var)
- ROS: OrgDirectory adapter; fixture used until real contract confirmed

## Running locally
```
npm install           # root installs all workspaces
npm run db:migrate    # apply migrations to local SQLite
npm run db:seed       # load Q2/Q3/Q4 plan from seed data
npm run dev           # starts server on :3001 and Vite on :5173 concurrently
```

Set `DEV_USER=<rosId>` to simulate a specific user. Omit to default to Sara M (admin).
Set `USE_FIXTURE_ROS=true` (default in dev) to use the fixture org directory.
