import type { EntityId } from "../../../types/common";

/** A colleague as shown to other members: name and role only (§9.6). */
export interface TeamMember {
  id: EntityId;
  name: string;
  role: string;
  teamId: EntityId;
  teamName: string;
  departmentName: string;
  isManager: boolean;
  isSelf: boolean;
}

export interface ExpenseReviewer {
  id: EntityId;
  name: string;
  role: string;
}

/** The caller's team (or, for Finance, authorized departments) and who reviews their expenses. */
export interface MyTeam {
  /** TEAM: the caller's team. DEPARTMENT: Finance's authorized departments. */
  scope: "TEAM" | "DEPARTMENT";
  teamName: string;
  departmentNames: string[];
  members: TeamMember[];
  reviewers: ExpenseReviewer[];
  /** How the reviewers were determined, in plain language. */
  reviewerBasis: string;
}
