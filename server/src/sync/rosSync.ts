/**
 * Nightly ROS sync: reads org under Yawei Li and upserts into the person table.
 * Marks people not returned by ROS as inactive (active=0).
 *
 * Availability overrides are NOT touched — they live in the tool's DB.
 * Sen Li's 0.5 override must be seeded once and survives every sync.
 */

import { db } from "../db/client.js";
import type { OrgDirectory } from "../ros/types.js";
import { YAWEI_LI_ROS_ID } from "../ros/fixture.js";
import { mapTeam } from "../ros/teamMapping.js";
import { sql } from "drizzle-orm";

export async function syncROS(directory: OrgDirectory): Promise<void> {
  console.log("[rosSync] Starting ROS sync…");

  const people = await directory.listReports(YAWEI_LI_ROS_ID);
  console.log(`[rosSync] Got ${people.length} people from ROS`);

  const activeIds = new Set<string>();

  for (const p of people) {
    activeIds.add(p.rosId);
    const mappedTeam = mapTeam(p.homeTeam);

    db.run(sql.raw(`
      INSERT INTO person(ros_id, name, email, role, home_team, manager_ros_id, active)
      VALUES (
        '${p.rosId}',
        '${p.name.replace(/'/g, "''")}',
        '${p.email.replace(/'/g, "''")}',
        '${p.role}',
        '${mappedTeam}',
        ${p.managerRosId ? `'${p.managerRosId}'` : "NULL"},
        1
      )
      ON CONFLICT(ros_id) DO UPDATE SET
        name           = excluded.name,
        email          = excluded.email,
        role           = excluded.role,
        home_team      = excluded.home_team,
        manager_ros_id = excluded.manager_ros_id,
        active         = 1
    `));
  }

  // Mark anyone no longer returned as inactive
  const allPeople = db.all<{ ros_id: string }>(
    sql.raw("SELECT ros_id FROM person WHERE active = 1"),
  );
  for (const { ros_id } of allPeople) {
    if (!activeIds.has(ros_id)) {
      db.run(sql.raw(`UPDATE person SET active = 0 WHERE ros_id = '${ros_id}'`));
      console.log(`[rosSync] Marked ${ros_id} inactive`);
    }
  }

  console.log("[rosSync] Done.");
}

// Entry point for cron / manual invocation
if (import.meta.url === `file://${process.argv[1]}`) {
  const useFixture = process.env.USE_FIXTURE_ROS !== "false";
  if (useFixture) {
    const { FixtureOrgDirectory } = await import("../ros/fixture.js");
    await syncROS(new FixtureOrgDirectory());
  } else {
    // TODO: import real ROS adapter once contract confirmed
    throw new Error("Real ROS adapter not yet implemented. Set USE_FIXTURE_ROS=true.");
  }
}
