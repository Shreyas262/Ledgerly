import type { AuthenticatedPrincipal } from "../../features/auth/types/auth";
import {
  MAX_DELEGATION_DAYS,
  type CreateDelegationRequest,
  type Delegation,
  type DelegationCandidate,
  type DelegationList,
  type DelegationStatus,
  type DelegationView,
} from "../../features/approvals/types/delegation";
import { buildAuthenticatedPrincipal } from "./authorizationService";
import { runAuditedTransaction } from "./auditService";
import { getRecord, listRecords, listRecordsByIndex } from "./mockDataService";
import { WorkflowError, workflowForbidden } from "./workflowErrors";
import { formatDate, toDateOnly } from "../../utils/format";

/**
 * Review delegation (§22.12): a manager or Finance user lets another
 * reviewer at the same level or above review on their behalf for a period.
 * Eligibility is checked again whenever a delegation is used, so a
 * delegation whose people are no longer active or eligible grants nothing.
 */

interface DelegationUser {
  id: string;
  name: string;
  accountType?: "organization" | "personal" | "platform";
  organizationId: string;
  departmentId: string;
  teamId: string;
  roleId: string;
  role?: string;
  status?: "active" | "inactive";
  financeDepartmentIds?: string[];
}

interface Person {
  name: string;
  role: string;
  /** Null once the user is inactive, removed or deleted. */
  principal: AuthenticatedPrincipal | null;
  user?: DelegationUser;
}

/** A delegator whose review authority the principal holds today. */
export interface ActiveDelegator {
  delegation: Delegation;
  delegator: AuthenticatedPrincipal;
  name: string;
}

/** Position in the approval matrix of the roles that delegate and receive delegations. */
const REVIEW_LEVELS: Record<string, number> = { manager: 1, finance: 2 };

const STATUS_ORDER: Record<DelegationStatus, number> = { active: 0, scheduled: 1, ended: 2, cancelled: 3 };

const DAY_MS = 86_400_000;

function reviewLevel(principal: AuthenticatedPrincipal): number | undefined {
  const reviews =
    principal.effectivePermissions.includes("expenses.approve") &&
    principal.effectivePermissions.includes("expenses.reject");
  return reviews ? REVIEW_LEVELS[principal.role] : undefined;
}

/** Why the principal cannot delegate their reviews, or null when they can. */
export function getDelegatorRestriction(principal: AuthenticatedPrincipal): string | null {
  if (principal.role === "admin") {
    return "Administrators review every expense except their own, so they do not delegate reviews.";
  }
  if (reviewLevel(principal) === undefined) {
    return "Only managers and Finance users who review expenses can delegate their reviews.";
  }
  return null;
}

/** Why the delegate cannot review on the delegator's behalf, or null when they can. */
function getDelegateIneligibility(delegator: AuthenticatedPrincipal, delegate: AuthenticatedPrincipal): string | null {
  if (delegate.userId === delegator.userId) return "You cannot delegate reviews to yourself.";
  if (delegate.accountType !== "organization" || delegate.organizationId !== delegator.organizationId) {
    return "Choose an active colleague in your organization.";
  }
  const level = reviewLevel(delegate);
  if (level === undefined) return "Reviews can be delegated only to a manager or Finance user who reviews expenses.";
  if (level < (reviewLevel(delegator) ?? 0)) return "A Finance user's reviews can be delegated only to another Finance user.";
  return null;
}

async function loadPerson(userId: string): Promise<Person> {
  const user = await getRecord<DelegationUser>("users", userId);
  if (!user) return { name: "Former user", role: "", principal: null };
  const role = user.roleId ? await getRecord<{ name: string }>("roles", user.roleId) : undefined;
  return {
    name: user.name,
    role: String(role?.name ?? user.role ?? "").toLowerCase(),
    principal: await buildAuthenticatedPrincipal(user),
    user,
  };
}

/** Where a delegation stands on the given day. */
export function delegationStatus(delegation: Delegation, today: string = toDateOnly()): DelegationStatus {
  if (delegation.cancelledAt) return "cancelled";
  if (today < delegation.startDate) return "scheduled";
  if (today > delegation.endDate) return "ended";
  return "active";
}

/** Why a scheduled or active delegation grants nothing, or undefined when it holds. */
function ineffectiveReason(delegator: Person, delegate: Person): string | undefined {
  if (!delegator.principal) return `${delegator.name} is no longer active.`;
  if (getDelegatorRestriction(delegator.principal)) return `${delegator.name} can no longer delegate reviews.`;
  if (!delegate.principal) return `${delegate.name} is no longer active.`;
  if (getDelegateIneligibility(delegator.principal, delegate.principal)) {
    return `${delegate.name} can no longer review on behalf of ${delegator.name}.`;
  }
  return undefined;
}

async function toView(delegation: Delegation, today: string): Promise<DelegationView> {
  const [delegator, delegate] = await Promise.all([loadPerson(delegation.delegatorId), loadPerson(delegation.delegateId)]);
  const status = delegationStatus(delegation, today);
  const reason = status === "active" || status === "scheduled" ? ineffectiveReason(delegator, delegate) : undefined;
  return {
    ...delegation,
    delegatorName: delegator.name,
    delegateName: delegate.name,
    delegateRole: delegate.role,
    status,
    inEffect: status === "active" && !reason,
    ...(reason ? { notInEffectReason: reason } : {}),
  };
}

function byStatusThenNewest(first: DelegationView, second: DelegationView): number {
  return STATUS_ORDER[first.status] - STATUS_ORDER[second.status] || second.startDate.localeCompare(first.startDate);
}

/** The principal's delegations: those they gave and those they received. */
export async function listDelegations(principal: AuthenticatedPrincipal): Promise<DelegationList> {
  const today = toDateOnly();
  const ofOrganization = (delegations: Delegation[]) =>
    delegations.filter((delegation) => delegation.organizationId === principal.organizationId);
  const [given, received] = await Promise.all([
    listRecordsByIndex<Delegation>("delegations", "delegatorId", principal.userId),
    listRecordsByIndex<Delegation>("delegations", "delegateId", principal.userId),
  ]);
  return {
    delegateRestriction: getDelegatorRestriction(principal),
    given: (await Promise.all(ofOrganization(given).map((delegation) => toView(delegation, today)))).sort(byStatusThenNewest),
    received: (await Promise.all(ofOrganization(received).map((delegation) => toView(delegation, today)))).sort(byStatusThenNewest),
  };
}

/** Active colleagues the principal may choose as their delegate, by name. */
export async function getDelegationCandidates(principal: AuthenticatedPrincipal): Promise<DelegationCandidate[]> {
  const [users, teams, departments] = await Promise.all([
    listRecordsByIndex<DelegationUser>("users", "organizationId", principal.organizationId),
    listRecords<{ id: string; name: string }>("teams"),
    listRecords<{ id: string; name: string }>("departments"),
  ]);
  const nameOf = (items: Array<{ id: string; name: string }>, id: string) => items.find((item) => item.id === id)?.name ?? "";

  const candidates: DelegationCandidate[] = [];
  for (const user of users) {
    if (user.id === principal.userId) continue;
    const delegate = await buildAuthenticatedPrincipal(user);
    if (!delegate || getDelegateIneligibility(principal, delegate)) continue;
    candidates.push({
      id: user.id,
      name: user.name,
      role: delegate.role,
      teamName: nameOf(teams, user.teamId),
      departmentName: nameOf(departments, user.departmentId),
    });
  }
  return candidates.sort((first, second) => first.name.localeCompare(second.name));
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Days from the first date to the second, both included. */
function daysIncluding(startDate: string, endDate: string): number {
  return Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS) + 1;
}

/**
 * Creates a delegation from the principal to a colleague. The period starts
 * today or later and lasts at most MAX_DELEGATION_DAYS; a delegator has one
 * delegation at a time.
 */
export async function createDelegation(
  principal: AuthenticatedPrincipal,
  request: Partial<CreateDelegationRequest>,
): Promise<DelegationView> {
  const restriction = getDelegatorRestriction(principal);
  if (restriction) throw workflowForbidden(restriction);

  const today = toDateOnly();
  const fieldErrors: Record<string, string> = {};
  const { delegateId, startDate, endDate } = request;

  let delegate: Person | undefined;
  if (typeof delegateId !== "string" || !delegateId) {
    fieldErrors.delegateId = "Choose who will review on your behalf.";
  } else {
    delegate = await loadPerson(delegateId);
    const ineligibility = delegate.principal
      ? getDelegateIneligibility(principal, delegate.principal)
      : "Choose an active colleague in your organization.";
    if (ineligibility) fieldErrors.delegateId = ineligibility;
  }

  if (!isDateOnly(startDate)) fieldErrors.startDate = "Enter a valid start date.";
  else if (startDate < today) fieldErrors.startDate = "The start date cannot be in the past.";
  if (!isDateOnly(endDate)) fieldErrors.endDate = "Enter a valid end date.";
  else if (isDateOnly(startDate) && endDate < startDate) fieldErrors.endDate = "The end date must be on or after the start date.";
  else if (isDateOnly(startDate) && daysIncluding(startDate, endDate) > MAX_DELEGATION_DAYS) {
    fieldErrors.endDate = `A delegation can last at most ${MAX_DELEGATION_DAYS} days.`;
  }

  if (Object.keys(fieldErrors).length) {
    throw new WorkflowError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", { fieldErrors });
  }

  // One delegation at a time, so it is always clear who acts for the delegator.
  const overlapping = (await listRecordsByIndex<Delegation>("delegations", "delegatorId", principal.userId)).find(
    (existing) => !existing.cancelledAt && existing.startDate <= endDate! && startDate! <= existing.endDate,
  );
  if (overlapping) {
    const overlappingDelegate = await loadPerson(overlapping.delegateId);
    throw new WorkflowError(
      409,
      "DELEGATION_OVERLAP",
      `You already delegate your reviews to ${overlappingDelegate.name} from ${formatDate(overlapping.startDate)} to ${formatDate(overlapping.endDate)}. Cancel that delegation or choose dates outside it.`,
    );
  }

  const now = new Date().toISOString();
  const delegation: Delegation = {
    id: crypto.randomUUID(),
    organizationId: principal.organizationId,
    delegatorId: principal.userId,
    delegateId: delegateId!,
    startDate: startDate!,
    endDate: endDate!,
    createdAt: now,
    updatedAt: now,
  };

  await runAuditedTransaction(["delegations"], {
    organizationId: delegation.organizationId,
    actorId: principal.userId,
    action: "DELEGATION_CREATED",
    entityType: "DELEGATION",
    entityId: delegation.id,
    newState: delegationStatus(delegation, today),
    metadata: { delegateId: delegation.delegateId, startDate: delegation.startDate, endDate: delegation.endDate },
    description: `Delegated expense reviews to ${delegate!.name} from ${formatDate(delegation.startDate)} to ${formatDate(delegation.endDate)}.`,
  }, (transaction) => transaction.objectStore("delegations").put(delegation));

  return toView(delegation, today);
}

/** The delegator ends a scheduled or active delegation at once. */
export async function cancelDelegation(
  principal: AuthenticatedPrincipal,
  delegation: Delegation,
): Promise<DelegationView> {
  if (delegation.delegatorId !== principal.userId) {
    throw workflowForbidden("Only the person who delegated their reviews can cancel the delegation.");
  }
  const today = toDateOnly();
  const status = delegationStatus(delegation, today);
  if (status === "cancelled") throw new WorkflowError(409, "CONFLICT", "This delegation has already been cancelled.");
  if (status === "ended") throw new WorkflowError(409, "CONFLICT", "This delegation has already ended.");

  const now = new Date().toISOString();
  const cancelled: Delegation = { ...delegation, cancelledAt: now, updatedAt: now };
  const delegate = await loadPerson(delegation.delegateId);

  await runAuditedTransaction(["delegations"], {
    organizationId: delegation.organizationId,
    actorId: principal.userId,
    action: "DELEGATION_CANCELLED",
    entityType: "DELEGATION",
    entityId: delegation.id,
    previousState: status,
    newState: "cancelled",
    metadata: { delegateId: delegation.delegateId, startDate: delegation.startDate, endDate: delegation.endDate },
    description: `Cancelled the delegation of expense reviews to ${delegate.name}.`,
  }, (transaction) => transaction.objectStore("delegations").put(cancelled));

  return toView(cancelled, today);
}

/**
 * The people whose review authority the principal holds today through a
 * delegation in effect (§22.12). Only the delegators' own authority is
 * lent: what they hold as someone else's delegate is never passed on.
 */
export async function getActiveDelegators(principal: AuthenticatedPrincipal): Promise<ActiveDelegator[]> {
  if (principal.accountType !== "organization" || reviewLevel(principal) === undefined) return [];
  const today = toDateOnly();
  const delegations = (await listRecordsByIndex<Delegation>("delegations", "delegateId", principal.userId)).filter(
    (delegation) => delegation.organizationId === principal.organizationId && delegationStatus(delegation, today) === "active",
  );

  const delegators: ActiveDelegator[] = [];
  for (const delegation of delegations) {
    const person = await loadPerson(delegation.delegatorId);
    if (!person.principal || getDelegatorRestriction(person.principal) || getDelegateIneligibility(person.principal, principal)) continue;
    delegators.push({ delegation, delegator: person.principal, name: person.name });
  }
  return delegators;
}

/**
 * Delegations in effect today from any of the given reviewers, by delegator:
 * who is reviewing on their behalf and until when (for My Team, §9.6).
 */
export async function getDelegatesOf(
  organizationId: string,
  delegatorIds: string[],
): Promise<Array<{ delegatorId: string; delegatorName: string; delegateId: string; delegateName: string; delegateRole: string; endDate: string }>> {
  const today = toDateOnly();
  const result = [];
  for (const delegatorId of delegatorIds) {
    for (const delegation of await listRecordsByIndex<Delegation>("delegations", "delegatorId", delegatorId)) {
      if (delegation.organizationId !== organizationId || delegationStatus(delegation, today) !== "active") continue;
      const [delegator, delegate] = await Promise.all([loadPerson(delegation.delegatorId), loadPerson(delegation.delegateId)]);
      if (ineffectiveReason(delegator, delegate)) continue;
      result.push({
        delegatorId,
        delegatorName: delegator.name,
        delegateId: delegation.delegateId,
        delegateName: delegate.name,
        delegateRole: delegate.role,
        endDate: delegation.endDate,
      });
    }
  }
  return result;
}
