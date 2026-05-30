export type OrgRole = "IC" | "Manager";

export interface OrgPerson {
  rosId: string;
  name: string;
  email: string;
  role: OrgRole;
  homeTeam: string;       // mapped to one of the eight delivery teams
  managerRosId: string | null;
  active: boolean;
}

export interface OrgDirectory {
  listReports(rootRosId: string): Promise<OrgPerson[]>;
  getPerson(rosId: string): Promise<OrgPerson | null>;
}
