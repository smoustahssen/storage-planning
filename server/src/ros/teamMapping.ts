/**
 * Maps ROS team names to the eight canonical delivery team names.
 * If ROS team names match the canonical names exactly, the identity mapping
 * below is sufficient. Add overrides when the ROS name differs.
 *
 * ⚠  ROS contract unconfirmed. Confirm with platform/org-data team and update
 *    this mapping before production deployment.
 */
export const CANONICAL_TEAMS = [
  "RDB-KV",
  "RDB-PG",
  "EaaS",
  "RaaS",
  "QaaS",
  "R3",
  "SIM",
  "MS SQL",
] as const;

export type CanonicalTeam = (typeof CANONICAL_TEAMS)[number];

// ROS team name → canonical team name
const TEAM_MAP: Record<string, CanonicalTeam> = {
  "RDB-KV":  "RDB-KV",
  "RDB-PG":  "RDB-PG",
  "EaaS":    "EaaS",
  "RaaS":    "RaaS",
  "QaaS":    "QaaS",
  "R3":      "R3",
  "SIM":     "SIM",
  "MS SQL":  "MS SQL",
  // Add ROS-specific overrides here, e.g.:
  // "rdb-kv-team": "RDB-KV",
};

export function mapTeam(rosTeamName: string): CanonicalTeam {
  const mapped = TEAM_MAP[rosTeamName];
  if (!mapped) {
    console.warn(`[teamMapping] Unknown ROS team name: "${rosTeamName}" — falling back to original`);
    return rosTeamName as CanonicalTeam;
  }
  return mapped;
}
