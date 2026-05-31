/**
 * One-time seed: loads Q2/Q3/Q4 2026 from real mock data.
 * Run once after migration. Idempotent via INSERT OR IGNORE.
 */

import { db } from "./client.js";
import { runMigrations } from "./migrate.js";
import { syncROS } from "../sync/rosSync.js";
import { FixtureOrgDirectory } from "../ros/fixture.js";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// ─── Name → rosId lookup ─────────────────────────────────────────────────────

const NAME_TO_ROS_ID: Record<string, string> = {
  "Zhixin Wen":        "ros_zhixin_wen",
  "Trung Dinh":        "ros_trung_dinh",
  "Stephen Ma":        "ros_stephen_ma",
  "Meng Xu":           "ros_meng_xu",
  "Michael Krishnan":  "ros_michael_krishnan",
  "Haocheng Zuo":      "ros_haocheng_zuo",
  "Yingjie He":        "ros_yingjie_he",
  "Bing Yang":         "ros_bing_yang",
  "Shichao Jin":       "ros_shichao_jin",
  "Steven Wang":       "ros_steven_wang",
  "Austen Schunk":     "ros_austen_schunk",
  "Cory Zhao":         "ros_cory_zhao",
  "Nathan Zhang":      "ros_nathan_zhang",
  "Zhengyin Qian":     "ros_zhengyin_qian",
  "Shiming Song":      "ros_shiming_song",
  "Jin Wang":          "ros_jin_wang",
  "Zijian Xie":        "ros_zijian_xie",
  "Sen Li":            "ros_sen_li",
  "Anders Persson":    "ros_anders_persson",
  "Vineesha Kasireddy":"ros_vineesha_k",
  "Utkarsh Singh":     "ros_utkarsh_singh",
  "Pranish Pantha":    "ros_pranish_pantha",
  "Peter Yao":         "ros_peter_yao",
  "Julian Kudszus":    "ros_julian_kudszus",
  "Huizhi Lu":         "ros_huizhi_lu",
  "Weiji Hu":          "ros_weiji_hu",
  "Leon Gao":          "ros_leon_gao",
  "Leo Luo":           "ros_leo_luo",
  "Ankur Kulshrestha": "ros_ankur_k",
  "Derek Pham":        "ros_derek_pham",
  "Julien Mo":         "ros_julien_mo",
  "Yue Luo":           "ros_yue_luo",
  "Will Hodges":       "ros_will_hodges",
  "Shenglin Du":       "ros_shenglin_du",
  "Fred Liu":          "ros_fred_liu",
  "Gavin Wang":        "ros_gavin_wang",
  "Hieu Pham":         "ros_hieu_pham",
  "George Li":         "ros_george_li",
  "Jose Manjarrez":    "ros_jose_manjarrez",
  "Manav Kapoor":      "ros_manav_kapoor",
  "Qinghua Chen":      "ros_qinghua_chen",
  "Rahul Yadav":       "ros_rahul_yadav",
  "Danny Avhad":       "ros_danny_avhad",
  "Ravi Gullapalli":   "ros_ravi_gullapalli",
  "Gopal Anand":       "ros_gopal_anand",
  "Vikash Singh":      "ros_vikash_singh",
  "Danny Yuan":        "ros_danny_yuan",
};

function resolveRosId(name: string): string {
  const id = NAME_TO_ROS_ID[name];
  if (!id) throw new Error(`[seed] Cannot resolve name to rosId: "${name}". Fix NAME_TO_ROS_ID.`);
  return id;
}

function insertInitiative(fields: {
  id: string; quarterId: string; status: "committed" | "backlog";
  team: string; name: string; theme: string;
  pri?: string; deliverables?: string; metrics?: string;
  readiness?: string; problemValue?: string; successMetric?: string;
  effort?: string; earliest?: string; requestorDri?: string; nextAction?: string;
}) {
  db.run(sql.raw(`
    INSERT OR IGNORE INTO initiative(
      id, quarter_id, status, team, name, theme,
      pri, deliverables, metrics,
      readiness, problem_value, success_metric, effort,
      earliest, requestor_dri, next_action
    ) VALUES (
      '${fields.id}', '${fields.quarterId}', '${fields.status}',
      '${fields.team}', '${fields.name.replace(/'/g, "''")}', '${fields.theme}',
      ${fields.pri ? `'${fields.pri}'` : "NULL"},
      ${fields.deliverables ? `'${fields.deliverables.replace(/'/g, "''")}'` : "NULL"},
      ${fields.metrics ? `'${fields.metrics.replace(/'/g, "''")}'` : "NULL"},
      ${fields.readiness ? `'${fields.readiness}'` : "NULL"},
      ${fields.problemValue ? `'${fields.problemValue.replace(/'/g, "''")}'` : "NULL"},
      ${fields.successMetric ? `'${fields.successMetric.replace(/'/g, "''")}'` : "NULL"},
      ${fields.effort ? `'${fields.effort}'` : "NULL"},
      ${fields.earliest ? `'${fields.earliest}'` : "NULL"},
      ${fields.requestorDri ? `'${fields.requestorDri.replace(/'/g, "''")}'` : "NULL"},
      ${fields.nextAction ? `'${fields.nextAction.replace(/'/g, "''")}'` : "NULL"}
    )
  `));
}

function insertAssignment(quarterId: string, personName: string, initiativeId: string, pct: number) {
  const rosId = resolveRosId(personName);
  db.run(sql.raw(`
    INSERT OR IGNORE INTO assignment(id, quarter_id, ros_id, initiative_id, pct)
    VALUES ('${uuidv4()}', '${quarterId}', '${rosId}', '${initiativeId}', ${pct})
  `));
}

async function seed() {
  await runMigrations();
  await syncROS(new FixtureOrgDirectory());

  // ── Availability overrides ─────────────────────────────────────────────
  // Sen Li: manager of RaaS who carries 0.5 IC load
  db.run(sql.raw(`INSERT OR REPLACE INTO availability_override(ros_id, availability) VALUES ('ros_sen_li', 0.5)`));
  // Zijian Xie: 0.7 availability (30% leave)
  db.run(sql.raw(`INSERT OR REPLACE INTO availability_override(ros_id, availability) VALUES ('ros_zijian_xie', 0.7)`));

  // ── Quarters ───────────────────────────────────────────────────────────
  const quarters = [
    { id: "2026Q2", label: "Q2 2026", state: "previous", locked: 1 },
    { id: "2026Q3", label: "Q3 2026", state: "current",  locked: 0 },
    { id: "2026Q4", label: "Q4 2026", state: "draft",    locked: 0 },
  ];
  for (const q of quarters) {
    db.run(sql.raw(`INSERT OR IGNORE INTO quarter(id, label, state, locked) VALUES ('${q.id}', '${q.label}', '${q.state}', ${q.locked})`));
    db.run(sql.raw(`INSERT OR IGNORE INTO quarter_version(quarter_id, version) VALUES ('${q.id}', 0)`));
  }

  // ── Admin grant ────────────────────────────────────────────────────────
  db.run(sql.raw(`INSERT OR IGNORE INTO email_access(email, role, scope) VALUES ('sara.m@roblox.com', 'admin', 'All')`));

  // ══════════════════════════════════════════════════════════════════════
  // Q2 2026  (locked, previous quarter)
  // ══════════════════════════════════════════════════════════════════════
  const Q2 = "2026Q2";

  const q2Initiatives = [
    { id: "ktlo",      team: "All",    name: "KTLO: 24×7 operations — all services",   theme: "KTLO",        pri: "P0", deliverables: "Continuous 24×7 ops across 8 services. Oncall, patching 95% ≤30d, incident response, SOX/SOC2.", metrics: "MTTR ≤6h; toil growth <15%; SOX complete" },
    { id: "creator",   team: "RDB-KV", name: "Creator DataStore + Frost P13N",          theme: "Cust Exp",   pri: "P0", deliverables: "RDB prod reads for 26 universes, auto-fallback DDB/S3. Frost 50%→100% on RDB.", metrics: "100% consistency vs DDB/S3; p99 ≤ baseline; PRR approved" },
    { id: "cell",      team: "RDB-KV", name: "Cell stability / HA + Raft foundation",   theme: "Reliability", pri: "P0", deliverables: "Continuous patching, single-cell HA validated. Raft consensus + leader failover.", metrics: "Patching <0.1% error; HA drill passing; 0 P0 correctness" },
    { id: "flow",      team: "EaaS",   name: "Flow control (phase 2)",                  theme: "Reliability", pri: "P0", deliverables: "EaaS API enforces ACC server-side. End-to-end backpressure chain. CRDB recovery 10→5 min.", metrics: "CRDB recovery ≤10 min; throttle at ~5% error" },
    { id: "staging",   team: "EaaS",   name: "Staging & safe release",                  theme: "Reliability", pri: "P0", deliverables: "Storage staging env. Canary + progressive rollout. Data-correctness E2E framework.", metrics: "3 non-DC SEVs captured; 5 economy test cases" },
    { id: "cacherust", team: "EaaS",   name: "Cache Rust client enhancement",            theme: "Reliability", pri: "P0", deliverables: "Metrics coverage, circuit breaker, jitter on reconnect. Onboard to Secret Broker.", metrics: "P0 feature parity in Rust client" },
    { id: "secrets",   team: "All",    name: "Secrets mgmt: 100% via Secret Broker",    theme: "Security",   pri: "P0", deliverables: "All services onboard to Secret Broker. 100% rotating. No long-lived manual secrets. TLS live.", metrics: "100% rotated via broker; 0 manual secrets; TLS live" },
    { id: "ssh",       team: "All",    name: "SSH lockdown + pod access audit",          theme: "Security",   pri: "P0", deliverables: "CRDB Economy 100% via SAPI. R3 fleet 100% locked. MS SQL break-glass. Pod scope-down.", metrics: "100% lockdown; InfraSec sign-off" },
    { id: "raasstd",   team: "RaaS",   name: "Client standardization + MDS API + EV1", theme: "Reliability", pri: "P0", deliverables: "Golang active-passive + Vault. 100% deploys via MDS. 25% EV1 off local cache.", metrics: "Luobu unblocked; 6k-node limit bypassed; 25% EV1 migrated" },
    { id: "crdbrel",   team: "SIM",    name: "CRDB reliability: slow query + ZBL",      theme: "Reliability", pri: "P0", deliverables: "E2E slow-query solution across EaaS/CRDB with CockroachLabs. ZBL support.", metrics: "80% out-of-SLO queries covered by EOQ" },
    { id: "pgint",     team: "RDB-PG", name: "EaaS on RDB-PG integration",              theme: "Cust Exp",   pri: "P0", deliverables: "EaaS core data path (APIs, pooling, static schemas) on PG.", metrics: "Shadow 1 EaaS use case E2E on PG, single region" },
    { id: "vsearch",   team: "RDB-PG", name: "Vector search on RDB",                    theme: "Cust Exp",   pri: "P1", deliverables: "POC validated by MLP. Dedicated RDB cluster w/ HA + backup in CHI.", metrics: "POC live; dedicated cluster HA + backup" },
    { id: "qaascreator",team: "QaaS",  name: "Onboard Creator + Safety from SQS",       theme: "Cust Exp",   pri: "P1", deliverables: "Managed QaaS Kafka Connect. Zero-loss message delivery.", metrics: "Zero-loss delivery validated; both live on QaaS" },
    { id: "r3dr",      team: "R3",     name: "Disaster recovery: cross-region",          theme: "Reliability", pri: "P1", deliverables: "Cross-region replication CHI↔ASH, RPO ≤30s for 100% DMR.", metrics: "Replication live; RPO ≤30s; DR drill passed" },
    { id: "r3ec",        team: "R3",     name: "Erasure coding EC(6,4)",                                  theme: "Reliability", pri: "P1", deliverables: "Adopt EC(6,4) across R3 fleet for 11-nines durability during patching.", metrics: "11-nines durability from 9-nines" },
    { id: "grimlock",    team: "All",    name: "Grimlock POC",                                            theme: "Security",    pri: "P1", deliverables: "POC for pod identity management. Enable SPIFFE/SPIRE-based workload identity for Storage fleet.", metrics: "Grimlock POC reviewed; workload identity design signed off by InfraSec" },
    { id: "pgfound",     team: "RDB-PG", name: "RDB-PG Engine Foundation: Logical B&R + PITR + Cell HA", theme: "Reliability", pri: "P1", deliverables: "Logical backup & restore, point-in-time recovery, and cell HA for RDB-PG.", metrics: "B&R validated; PITR RPO ≤1h; Cell HA drill passing" },
    { id: "r3features",  team: "R3",     name: "R3 Feature Support for Asset Migration",                 theme: "Cust Exp",    pri: "P1", deliverables: "R3 features required to unblock asset pipeline migration use cases.", metrics: "Asset migration unblocked on R3; ≥1 use case live" },
    { id: "evmigration", team: "MS SQL", name: "EV1 / MSSQL → EaaS Large Table Migration",              theme: "Efficiency",  pri: "P1", deliverables: "Data-path tooling to migrate large EV1 and MS SQL tables onto EaaS.", metrics: "≥1 large table migrated to EaaS; migration runbook published" },
    { id: "mssqlpatch",  team: "MS SQL", name: "MSSQL Patching Automation",                             theme: "Security",    pri: "P1", deliverables: "Automated patching pipeline for MS SQL fleet. Break-glass access documented.", metrics: "100% MS SQL servers patched via automation" },
  ];
  for (const i of q2Initiatives) insertInitiative({ ...i, quarterId: Q2, status: "committed" });

  // Q2 backlog
  const q2Backlog = [
    { id: "b-ads",    team: "RDB-KV", name: "Ads/Discovery: insertion cache",  theme: "Cust Exp",  readiness: "ready",  problemValue: "Ads hitting Redis ~4.8TB. Discovery needs 1.2TB. Redis cannot scale cost-effectively.", successMetric: "Shadow traffic; p99 ≤ Redis baseline.", effort: "L",   earliest: "Q3 2026", requestorDri: "Vincent Jiang", nextAction: "Pick P0 use-case" },
    { id: "b-milvus", team: "RDB-PG", name: "VectorDB (Milvus) full ownership", theme: "Cust Exp",  readiness: "ready",  problemValue: "20+ AI use-cases blocked. ETCD/Kafka reliability issues. No clear owner.", successMetric: "Single owner; reliability SLO set.", effort: "M",   earliest: "Q3 2026", requestorDri: "Yingjie He", nextAction: "Confirm ownership" },
    { id: "b-ceph",   team: "R3",     name: "Ceph software release v19.2.3",    theme: "Reliability",readiness: "ready",  problemValue: "No HC after Weiji/Leo loaned out. EOL Aug 2026.", successMetric: "Fleet on v19.2.3 before EOL.", effort: "M",   earliest: "Q3 2026", requestorDri: "Leon Gao", nextAction: "Reclaim 0.8 HC" },
    { id: "b-cost",   team: "All",    name: "Cost attribution: ACTS + per-team",theme: "Efficiency", readiness: "scope",  problemValue: "No HC to instrument ACTS-based attribution. High FinOps demand.", successMetric: "Per-team reports in Mosaic; ACTS >95% accurate.", effort: "M",   earliest: "Q3 2026", requestorDri: "Leadership", nextAction: "Confirm platform" },
    { id: "b-sdk",    team: "EaaS",   name: "SDK & CX: transactions + fixes",   theme: "Cust Exp",  readiness: "parked", problemValue: "SDK wraps gRPC errors. int32/64 casting issues. Zero Q2 capacity.", successMetric: "Transaction MVP; SDK pain points fixed.", effort: "XL",  earliest: "Q4 2026", requestorDri: "EaaS Eng", nextAction: "Revisit post-P0" },
    { id: "b-kvrocks",team: "RaaS",   name: "Ephemeral store (KVRocks)",         theme: "Cust Exp",  readiness: "watch",  problemValue: "SSD-based caching for latency-insensitive RaaS use cases.", successMetric: "Use cases moved to KVRocks.", effort: "TBD", earliest: "TBD",      requestorDri: "Sen Li", nextAction: "Scoping" },
  ];
  for (const b of q2Backlog) insertInitiative({ ...b, quarterId: Q2, status: "backlog" });

  // Q2 assignments  [personName, initiativeId, pct]
  const q2Asg: Array<[string, string, number]> = [
    ["Zhixin Wen","ktlo",0.2],["Trung Dinh","ktlo",0.2],["Stephen Ma","ktlo",0.2],["Meng Xu","ktlo",0.2],["Michael Krishnan","ktlo",0.2],
    ["Yingjie He","ktlo",0.1],["Bing Yang","ktlo",0.1],["Shichao Jin","ktlo",0.1],
    ["Austen Schunk","ktlo",0.2],["Cory Zhao","ktlo",0.2],["Nathan Zhang","ktlo",0.3],["Zhengyin Qian","ktlo",0.2],["Shiming Song","ktlo",0.2],["Jin Wang","ktlo",0.3],["Zijian Xie","ktlo",0.3],
    ["Sen Li","ktlo",0.5],["Anders Persson","ktlo",0.2],["Vineesha Kasireddy","ktlo",0.2],["Utkarsh Singh","ktlo",0.2],["Pranish Pantha","ktlo",0.4],
    ["Peter Yao","ktlo",0.5],["Julian Kudszus","ktlo",1.0],
    ["Weiji Hu","ktlo",0.2],["Leon Gao","ktlo",0.2],["Leo Luo","ktlo",0.2],["Ankur Kulshrestha","ktlo",0.2],["Derek Pham","ktlo",0.2],["Julien Mo","ktlo",0.2],["Yue Luo","ktlo",0.2],
    ["Will Hodges","ktlo",0.2],["Shenglin Du","ktlo",0.2],["Fred Liu","ktlo",0.2],["Gavin Wang","ktlo",0.2],["Hieu Pham","ktlo",0.2],["George Li","ktlo",0.2],["Jose Manjarrez","ktlo",0.2],
    ["Rahul Yadav","ktlo",1.0],["Ravi Gullapalli","ktlo",0.2],["Gopal Anand","ktlo",0.2],
    ["Zhixin Wen","creator",0.5],["Will Hodges","creator",0.8],["Stephen Ma","creator",0.8],["Trung Dinh","creator",0.3],
    ["Meng Xu","cell",0.8],["Michael Krishnan","cell",0.8],["Shenglin Du","cell",0.8],["Austen Schunk","cell",0.8],["Hieu Pham","cell",0.8],["Haocheng Zuo","cell",0.5],["Zhixin Wen","cell",0.3],
    ["Trung Dinh","flow",0.5],["Cory Zhao","flow",0.6],["Zhengyin Qian","flow",0.8],["Nathan Zhang","flow",0.2],
    ["Shiming Song","staging",0.6],["Jin Wang","staging",0.7],["Weiji Hu","staging",0.8],["Fred Liu","staging",0.8],
    ["Nathan Zhang","cacherust",0.5],["Cory Zhao","cacherust",0.2],
    ["Pranish Pantha","secrets",0.4],["Leo Luo","secrets",0.8],["Peter Yao","secrets",0.5],["Ravi Gullapalli","secrets",0.8],["George Li","secrets",0.8],["Qinghua Chen","secrets",0.5],
    ["Julien Mo","ssh",0.8],["Manav Kapoor","ssh",0.2],["Jose Manjarrez","ssh",0.2],
    ["Anders Persson","raasstd",0.8],["Utkarsh Singh","raasstd",0.8],["Vineesha Kasireddy","raasstd",0.8],["Pranish Pantha","raasstd",0.2],
    ["Jose Manjarrez","crdbrel",0.7],["Manav Kapoor","crdbrel",0.7],["Steven Wang","crdbrel",0.5],["Qinghua Chen","crdbrel",0.5],["Gavin Wang","crdbrel",0.8],
    ["Bing Yang","pgint",0.9],["Zijian Xie","pgint",0.5],
    ["Yingjie He","vsearch",0.9],["Shichao Jin","vsearch",0.2],
    ["Huizhi Lu","qaascreator",1.0],
    ["Ankur Kulshrestha","r3dr",0.8],
    ["Leon Gao","r3ec",0.8],
    ["Vikash Singh","pgfound",1.0],["Haocheng Zuo","pgfound",0.5],["Shichao Jin","pgfound",0.7],["Steven Wang","pgfound",0.5],
    ["Derek Pham","r3features",0.8],
    ["Danny Avhad","mssqlpatch",1.0],
  ];
  for (const [name, initId, pct] of q2Asg) insertAssignment(Q2, name, initId, pct);

  // Q2 priorities
  db.run(sql.raw(`INSERT OR IGNORE INTO priority(quarter_id, rank, heading, body) VALUES ('${Q2}', 1, 'P0 reliability & security', 'All 8 P0s must land. Cell HA, Creator SoT, flow control, secrets/SSH lockdown, and CRDB reliability take precedence over all new asks.')`));
  db.run(sql.raw(`INSERT OR IGNORE INTO priority(quarter_id, rank, heading, body) VALUES ('${Q2}', 2, 'No new surface area until P0s land', 'Backlog items and P1s are funded only if P0 scope shrinks. Escalate any scope additions to Yawei.')`));

  // ══════════════════════════════════════════════════════════════════════
  // Q3 2026  (current quarter)
  // ══════════════════════════════════════════════════════════════════════
  const Q3 = "2026Q3";

  const q3Initiatives = [
    { id: "k3ktlo",    team: "All",    name: "KTLO: 24×7 operations — all services",     theme: "KTLO",        pri: "P0", deliverables: "Continuous 24×7 ops across 8 services. Oncall, patching 95% ≤30d, SOX/SOC2.",               metrics: "MTTR ≤6h; toil growth <15%" },
    { id: "k3cell",    team: "RDB-KV", name: "Cell stability GA + multi-cell",            theme: "Reliability", pri: "P0", deliverables: "Single-cell HA GA. Begin multi-cell on RKS. Raft leader failover hardened.",                 metrics: "Multi-cell drill passing; 0 P0 correctness" },
    { id: "k3creator", team: "RDB-KV", name: "Creator DataStore GA (source of truth)",    theme: "Cust Exp",   pri: "P0", deliverables: "26 universes on RDB as source of truth. DDB decommission prep. Frost 100%.",                 metrics: "SoT live; 6-month SoT clock started" },
    { id: "k3cdc",     team: "RDB-KV", name: "CDC engine + tenant move pipeline",         theme: "Reliability", pri: "P0", deliverables: "Ordered change stream, enables PITR + tenant moves and OrderedDataStore.",                  metrics: "CDC prototype live; ordered stream + replay + checkpoint" },
    { id: "k3flow",    team: "EaaS",   name: "Flow control (phase 3) + SLO enforcement",  theme: "Reliability", pri: "P0", deliverables: "Server-side ACC everywhere. SLO enforcement and capacity signals shipped.",                  metrics: "CRDB recovery ≤5 min; SLO enforcement live" },
    { id: "k3staging", team: "EaaS",   name: "Safe release hardening",                    theme: "Reliability", pri: "P0", deliverables: "Canary + progressive rollout default. Config-as-Code across services.",                     metrics: "90% releases via canary; 0 config-drift SEVs" },
    { id: "k3secrets", team: "All",    name: "Secrets enforcement active",                 theme: "Security",   pri: "P0", deliverables: "100% MDS-managed services on SB-managed Vault paths, enforcement active.",                   metrics: "Enforcement on; 0 manual secrets; TLS everywhere" },
    { id: "k3ssh",     team: "All",    name: "SSH lockdown completion + Grimlock",         theme: "Security",   pri: "P0", deliverables: "Remaining fleet lockdown. Grimlock POC for pod identity.",                                   metrics: "100% lockdown; Grimlock POC reviewed" },
    { id: "k3crdb",    team: "SIM",    name: "CRDB reliability + slow-query GA",           theme: "Reliability", pri: "P0", deliverables: "E2E slow-query GA with CockroachLabs. ZBL hardening.",                                     metrics: "90% out-of-SLO queries covered" },
    { id: "k3pg",      team: "RDB-PG", name: "EaaS-to-PG integration tooling",            theme: "Cust Exp",   pri: "P1", deliverables: "Data-path tooling on PG. Gated on +3 PG kernel eng decision.",                             metrics: "3-5 use cases migrated, single region" },
    { id: "k3qaas",    team: "QaaS",   name: "Central Kafka proxy (Phase 1)",              theme: "Reliability", pri: "P1", deliverables: "Unified API + quota enforcement. Scale path to 40T msg/day.",                              metrics: "Proxy live; quota on 100% ingestion" },
    { id: "k3raas",    team: "RaaS",   name: "EV1 migration (50%) + MDS",                 theme: "Reliability", pri: "P1", deliverables: "50% EV1 off local cache. Continue MDS deploy standardization.",                            metrics: "50% EV1 migrated; deploys via MDS" },
  ];
  for (const i of q3Initiatives) insertInitiative({ ...i, quarterId: Q3, status: "committed" });

  // Q3 backlog
  const q3Backlog = [
    { id: "c-ads",       team: "RDB-KV", name: "Ads/Discovery: insertion cache",    theme: "Cust Exp",   readiness: "ready",  problemValue: "Ads hitting Redis ~4.8TB. Discovery needs 1.2TB. Redis cannot scale cost-effectively.", successMetric: "Shadow traffic; p99 ≤ Redis baseline.", effort: "L",   earliest: "Q4 2026",  requestorDri: "Vincent Jiang", nextAction: "Pick P0 use-case" },
    { id: "c-milvus",    team: "RDB-PG", name: "VectorDB (Milvus) full ownership",  theme: "Cust Exp",   readiness: "ready",  problemValue: "20+ AI use-cases blocked. ETCD/Kafka reliability issues.", successMetric: "Single owner; reliability SLO set.", effort: "M",   earliest: "Q4 2026",  requestorDri: "Yingjie He", nextAction: "Confirm ownership" },
    { id: "c-bloom",     team: "EaaS",   name: "Bloom filters in EaaS",             theme: "Cust Exp",   readiness: "ready",  problemValue: "40M+ evals/sec across Safety, Economy, Ads. Current owner unresourced.", successMetric: "YAML-configured; 15+ use cases migrated.", effort: "L",   earliest: "Q4 2026",  requestorDri: "Eitan Rothberg", nextAction: "Reclaim HC" },
    { id: "c-cost",      team: "All",    name: "Cost attribution: ACTS + per-team", theme: "Efficiency", readiness: "scope",  problemValue: "No storage cost visibility per team. High FinOps demand.", successMetric: "Per-team reports in Mosaic; ACTS >95% accurate.", effort: "M",   earliest: "Q4 2026",  requestorDri: "Leadership", nextAction: "Confirm platform" },
    { id: "c-ods",       team: "RDB-KV", name: "OrderedDataStore on RDB",           theme: "Cust Exp",   readiness: "scope",  problemValue: "Requires CDC engine, Materializer, list-keys + ODS indexes.", successMetric: "100% OrderedDataStore on RDB.", effort: "XL",  earliest: "H1 2027",  requestorDri: "RDB-KV Eng", nextAction: "Gate on CDC" },
    { id: "c-starrocks", team: "SIM",    name: "StarRocks + R3 logging analytics POC",theme:"Efficiency", readiness: "parked", problemValue: "Workload consolidation deferred. Need cost analysis vs ClickHouse.", successMetric: "≥40% cost saving vs ClickHouse Cloud.", effort: "XL",  earliest: "Q4 2026",  requestorDri: "Danny Yuan", nextAction: "Run analysis" },
    { id: "c-sdk",       team: "EaaS",   name: "SDK & CX: transactions + fixes",    theme: "Cust Exp",   readiness: "parked", problemValue: "SDK wraps gRPC errors. int32/64 casting issues.", successMetric: "Transaction MVP; SDK pain points fixed.", effort: "XL",  earliest: "Q4 2026",  requestorDri: "EaaS Eng", nextAction: "Revisit post-P0" },
    { id: "c-nebula",    team: "All",    name: "On-prem graph DB (NebulaGraph)",     theme: "Cust Exp",   readiness: "watch",  problemValue: "Blocked on deployment strategy and ownership (CAPI vs SSCP).", successMetric: "NebulaGraph live for ≥1 production AI use-case.", effort: "TBD", earliest: "TBD",      requestorDri: "Sara M", nextAction: "CAPI vs SSCP" },
    { id: "c-kvrocks",   team: "RaaS",   name: "Ephemeral store (KVRocks)",          theme: "Cust Exp",   readiness: "watch",  problemValue: "SSD-based caching for latency-insensitive RaaS use cases.", successMetric: "Use cases moved to KVRocks.", effort: "TBD", earliest: "TBD",      requestorDri: "Sen Li", nextAction: "Scoping" },
  ];
  for (const b of q3Backlog) insertInitiative({ ...b, quarterId: Q3, status: "backlog" });

  // Q3 assignments
  const q3Asg: Array<[string, string, number]> = [
    ["Zhixin Wen","k3ktlo",0.2],["Trung Dinh","k3ktlo",0.2],["Stephen Ma","k3ktlo",0.2],["Meng Xu","k3ktlo",0.2],
    ["Yingjie He","k3ktlo",0.1],["Bing Yang","k3ktlo",0.2],["Shichao Jin","k3ktlo",0.2],
    ["Austen Schunk","k3ktlo",0.2],["Cory Zhao","k3ktlo",0.2],["Nathan Zhang","k3ktlo",0.3],["Shiming Song","k3ktlo",0.2],["Jin Wang","k3ktlo",0.3],
    ["Sen Li","k3ktlo",0.5],["Anders Persson","k3ktlo",0.2],["Utkarsh Singh","k3ktlo",0.2],["Pranish Pantha","k3ktlo",0.4],
    ["Peter Yao","k3ktlo",0.5],["Julian Kudszus","k3ktlo",1.0],
    ["Weiji Hu","k3ktlo",0.3],["Leon Gao","k3ktlo",0.3],["Leo Luo","k3ktlo",0.3],["Ankur Kulshrestha","k3ktlo",0.3],["Derek Pham","k3ktlo",0.3],["Yue Luo","k3ktlo",0.3],
    ["Fred Liu","k3ktlo",0.3],["Gavin Wang","k3ktlo",0.2],["George Li","k3ktlo",0.2],["Jose Manjarrez","k3ktlo",0.2],["Danny Yuan","k3ktlo",0.2],
    ["Rahul Yadav","k3ktlo",1.0],["Danny Avhad","k3ktlo",0.3],["Ravi Gullapalli","k3ktlo",0.2],["Vikash Singh","k3ktlo",0.2],["Gopal Anand","k3ktlo",0.2],
    ["Meng Xu","k3cell",0.8],["Michael Krishnan","k3cell",0.8],["Shenglin Du","k3cell",0.8],["Austen Schunk","k3cell",0.6],["Haocheng Zuo","k3cell",1.0],
    ["Zhixin Wen","k3creator",0.6],["Will Hodges","k3creator",0.8],["Stephen Ma","k3creator",0.8],
    ["Trung Dinh","k3cdc",0.8],["Hieu Pham","k3cdc",0.8],["Michael Krishnan","k3cdc",0.2],
    ["Cory Zhao","k3flow",0.8],["Zhengyin Qian","k3flow",0.8],["Nathan Zhang","k3flow",0.2],
    ["Shiming Song","k3staging",0.6],["Jin Wang","k3staging",0.5],["Weiji Hu","k3staging",0.5],
    ["Pranish Pantha","k3secrets",0.4],["Leo Luo","k3secrets",0.5],["Ravi Gullapalli","k3secrets",0.5],["George Li","k3secrets",0.6],["Qinghua Chen","k3secrets",0.5],
    ["Julien Mo","k3ssh",0.6],["Manav Kapoor","k3ssh",0.3],["Danny Avhad","k3ssh",0.3],
    ["Jose Manjarrez","k3crdb",0.6],["Manav Kapoor","k3crdb",0.5],["Steven Wang","k3crdb",0.5],["Gavin Wang","k3crdb",0.6],
    ["Bing Yang","k3pg",0.7],["Zijian Xie","k3pg",0.5],["Shichao Jin","k3pg",0.4],
    ["Huizhi Lu","k3qaas",1.0],["Peter Yao","k3qaas",0.5],
    ["Anders Persson","k3raas",0.8],["Utkarsh Singh","k3raas",0.8],["Vineesha Kasireddy","k3raas",0.8],
  ];
  for (const [name, initId, pct] of q3Asg) insertAssignment(Q3, name, initId, pct);

  // Q3 priorities
  for (const p of [
    { rank: 1, heading: "Reliability first", body: "P0 initiatives on cell GA, CDC, flow control, CRDB reliability lead this quarter. Nothing ships at the cost of reliability." },
    { rank: 2, heading: "Security enforcement", body: "Secrets enforcement active and SSH lockdown complete are P0 with hard external deadlines. Unblock them before taking on new customer requests." },
    { rank: 3, heading: "Customer-facing milestones", body: "Creator SoT GA starts the 6-month decommission clock. EV1 migration and Kafka proxy unlock scale for internal customers. Treat blockers as P0." },
  ]) {
    db.run(sql.raw(`INSERT OR IGNORE INTO priority(quarter_id, rank, heading, body) VALUES ('${Q3}', ${p.rank}, '${p.heading.replace(/'/g, "''")}', '${p.body.replace(/'/g, "''")}')`));
  }

  // ══════════════════════════════════════════════════════════════════════
  // Q4 2026  (draft)
  // ══════════════════════════════════════════════════════════════════════
  const Q4 = "2026Q4";

  const q4Initiatives = [
    { id: "k4ktlo",      team: "All",    name: "KTLO: 24×7 operations — all services", theme: "KTLO",        pri: "P0", deliverables: "Draft. Carry-forward steady-state ops.", metrics: "MTTR ≤6h; toil growth <15%" },
    { id: "k4multicell", team: "RDB-KV", name: "Multi-cell production rollout",        theme: "Reliability", pri: "P0", deliverables: "Draft. Multi-cell to production traffic on RKS.", metrics: "Multi-cell at 20% production" },
    { id: "k4ddb",       team: "RDB-KV", name: "DDB decommission (post-SoT)",          theme: "Efficiency",  pri: "P1", deliverables: "Draft. Begin DDB decommission after 6-month SoT period.", metrics: "Dual-write off for migrated universes" },
  ];
  for (const i of q4Initiatives) insertInitiative({ ...i, quarterId: Q4, status: "committed" });

  const q4Backlog = [
    { id: "d-ods",  team: "RDB-KV", name: "OrderedDataStore on RDB",           theme: "Cust Exp",   readiness: "ready", problemValue: "CDC engine now exists. ODS indexes on PG ready to build.", successMetric: "100% OrderedDataStore on RDB.", effort: "XL", earliest: "H1 2027", requestorDri: "RDB-KV Eng", nextAction: "Scope build" },
    { id: "d-cost", team: "All",    name: "Cost attribution: ACTS + per-team", theme: "Efficiency", readiness: "scope", problemValue: "Carry-forward. High FinOps demand.", successMetric: "Per-team reports in Mosaic.", effort: "M",  earliest: "Q1 2027", requestorDri: "Leadership", nextAction: "Confirm platform" },
  ];
  for (const b of q4Backlog) insertInitiative({ ...b, quarterId: Q4, status: "backlog" });

  // Light Q4 assignments for draft
  const q4Asg: Array<[string, string, number]> = [
    ["Zhixin Wen","k4ktlo",1.0],["Peter Yao","k4ktlo",1.0],["Rahul Yadav","k4ktlo",1.0],["Sen Li","k4ktlo",0.5],["Weiji Hu","k4ktlo",0.5],
    ["Meng Xu","k4multicell",1.0],["Haocheng Zuo","k4multicell",1.0],["Michael Krishnan","k4multicell",0.8],
    ["Stephen Ma","k4ddb",0.8],["Trung Dinh","k4ddb",0.5],
  ];
  for (const [name, initId, pct] of q4Asg) insertAssignment(Q4, name, initId, pct);

  console.log("[seed] Done. Database seeded with Q2/Q3/Q4 2026 data.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
