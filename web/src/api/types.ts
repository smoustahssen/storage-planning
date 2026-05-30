export type Theme = "KTLO" | "Reliability" | "Security" | "Cust Exp" | "Efficiency";
export type InitiativeStatus = "committed" | "backlog";
export type Readiness = "ready" | "scope" | "parked" | "watch";
export type UserRole = "admin" | "editor" | "viewer";

export interface Quarter {
  id: string;
  label: string;
  state: "previous" | "current" | "draft";
  locked: boolean;
}

export interface Initiative {
  id: string;
  quarterId: string;
  status: InitiativeStatus;
  team: string;
  name: string;
  theme: Theme;
  pri?: string;
  deliverables?: string;
  metrics?: string;
  readiness?: Readiness;
  problemValue?: string;
  successMetric?: string;
  effort?: string;
  earliest?: string;
  requestorDri?: string;
  nextAction?: string;
  hc: number;
}

export interface Assignment {
  id: string;
  quarterId: string;
  rosId: string;
  initiativeId: string;
  pct: number;
  personName: string;
  homeTeam: string;
}

export interface Person {
  rosId: string;
  name: string;
  email: string;
  role: "IC" | "Manager";
  homeTeam: string;
  managerRosId: string | null;
  active: boolean;
  availability: number;
}

export interface TeamSummary {
  team: string;
  homeHC: number;
  effectiveHC: number;
  allocatedHC: number;
  lentOut: number;
  borrowedIn: number;
  gap: number;
  themeAllocation: Record<string, { pct: number; hc: number }>;
  committedInitiatives: Array<{ id: string; pri: string | null; name: string; hc: number }>;
}

export interface EngineerAllocation {
  rosId: string;
  name: string;
  homeTeam: string;
  role: string;
  availability: number;
  allocated: number;
  balance: "balanced" | "over" | "under";
  delta: number;
  projects: Array<{ initiativeId: string; name: string; pct: number }>;
}

export interface LoanRow {
  assignmentId: string;
  rosId: string;
  personName: string;
  homeTeam: string;
  initiativeId: string;
  initiativeName: string;
  borrowingTeam: string;
  pct: number;
}

export interface QoQRow {
  theme: string;
  current: number;
  previous: number;
  shift: number;
}

export interface PlanDerived {
  orgAllocatedHC: number;
  orgCapacity: number;
  unallocatedHC: number;
  committedCount: number;
  p0Count: number;
  p1Count: number;
  deferredCount: number;
  teams: TeamSummary[];
  themes: Record<string, number>;
  qoq: QoQRow[] | null;
  engineers: EngineerAllocation[];
  loans: LoanRow[];
}

export interface PlanResponse {
  quarter: Quarter;
  initiatives: Initiative[];
  assignments: Assignment[];
  priorities: Array<{ rank: number; heading: string; body: string }>;
  derived: PlanDerived;
}

export interface AccessGrant {
  rosId: string;
  role: UserRole;
  scope: string;
  name: string;
  email: string;
}

export interface AuditEntry {
  id: string;
  ts: string;
  actorRosId: string;
  actorName: string;
  action: string;
  entity: string;
  detail: string;
}

export interface Me {
  rosId: string;
  name: string;
  email: string;
  role: UserRole;
  scope: string;
}
