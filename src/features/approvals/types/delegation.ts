import type { EntityId, ISODateString } from "../../../types/common";

/** Longest a review delegation may run, in days, both ends included (§22.12). */
export const MAX_DELEGATION_DAYS = 90;

/**
 * A reviewer lets another reviewer review on their behalf for a period
 * (§22.12). Review only: never reimbursement or cancellation.
 */
export interface Delegation {
  id: EntityId;
  organizationId: EntityId;
  /** Whose review authority is lent. */
  delegatorId: EntityId;
  /** Who reviews on the delegator's behalf. */
  delegateId: EntityId;
  /** First and last day, both included (YYYY-MM-DD). */
  startDate: string;
  endDate: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  cancelledAt?: ISODateString;
}

export type DelegationStatus = "scheduled" | "active" | "ended" | "cancelled";

export const DELEGATION_STATUS_LABELS: Record<DelegationStatus, string> = {
  scheduled: "Scheduled",
  active: "Active",
  ended: "Ended",
  cancelled: "Cancelled",
};

/** A delegation with names and its current status, resolved by the API. */
export interface DelegationView extends Delegation {
  delegatorName: string;
  delegateName: string;
  delegateRole: string;
  status: DelegationStatus;
  /** Whether the delegate may review on the delegator's behalf today. */
  inEffect: boolean;
  /** Why a scheduled or active delegation grants nothing: someone is no longer eligible. */
  notInEffectReason?: string;
}

/** The signed-in reviewer's delegations, given and received. */
export interface DelegationList {
  /** Why the user cannot delegate their reviews, or null when they can. */
  delegateRestriction: string | null;
  given: DelegationView[];
  received: DelegationView[];
}

/** Someone the user may choose as their delegate: name and role only. */
export interface DelegationCandidate {
  id: EntityId;
  name: string;
  role: string;
  teamName: string;
  departmentName: string;
}

export interface CreateDelegationRequest {
  delegateId: EntityId;
  startDate: string;
  endDate: string;
}
