import { http, HttpResponse } from "msw";
import { apiError } from "../services/apiError";
import { resolveAuthenticatedPrincipal } from "../services/authorizationService";
import { listRecords } from "../services/mockDataService";
import type { ExpenseReviewer, MyTeam, TeamMember } from "../../features/userProfile/types/myTeam";

interface UserRecord {
  id: string;
  organizationId: string;
  departmentId: string;
  teamId: string;
  roleId: string;
  role?: string;
  name: string;
  status?: string;
  financeDepartmentIds?: string[];
}

interface NamedRecord {
  id: string;
  organizationId: string;
  name: string;
  departmentId?: string;
}

const byName = (first: { name: string }, second: { name: string }) => first.name.localeCompare(second.name);

export const teamHandlers = [
  // §9.6: any signed-in user may see their team (Finance: their authorized
  // departments) with names and roles only, and who reviews their expenses.
  http.get("/api/me/team", async ({ request }) => {
    const principal = await resolveAuthenticatedPrincipal(request);
    if (!principal) return apiError(401, "Please sign in to continue.");

    const [users, roles, teams, departments] = await Promise.all([
      listRecords<UserRecord>("users"),
      listRecords<{ id: string; name: string }>("roles"),
      listRecords<NamedRecord>("teams"),
      listRecords<NamedRecord>("departments"),
    ]);
    const roleName = (user: UserRecord) =>
      String(roles.find((role) => role.id === user.roleId)?.name ?? user.role ?? "").toLowerCase();
    const teamName = (id: string) => teams.find((team) => team.id === id)?.name ?? "";
    const departmentName = (id: string) => departments.find((department) => department.id === id)?.name ?? "";
    const active = users.filter((user) => user.organizationId === principal.organizationId && user.status === "active");

    const isFinance = principal.role === "finance";
    const departmentIds = isFinance ? principal.authorizedDepartmentIds : [principal.departmentId];
    const members: TeamMember[] = active
      .filter((user) => (isFinance ? departmentIds.includes(user.departmentId) : user.teamId === principal.teamId))
      .map((user) => ({
        id: user.id,
        name: user.name,
        role: roleName(user),
        teamId: user.teamId,
        teamName: teamName(user.teamId),
        departmentName: departmentName(user.departmentId),
        isManager: roleName(user) === "manager",
        isSelf: user.id === principal.userId,
      }))
      .sort((first, second) =>
        first.departmentName.localeCompare(second.departmentName) ||
        first.teamName.localeCompare(second.teamName) ||
        Number(second.isManager) - Number(first.isManager) ||
        first.name.localeCompare(second.name));

    // Reviewers follow the approval matrix (§22.2).
    const toReviewer = (user: UserRecord): ExpenseReviewer => ({ id: user.id, name: user.name, role: roleName(user) });
    const admins = active.filter((user) => roleName(user) === "admin");
    const others = (list: UserRecord[]) => list.filter((user) => user.id !== principal.userId);
    let reviewers: UserRecord[];
    let reviewerBasis: string;
    if (principal.role === "admin") {
      reviewers = admins;
      reviewerBasis = "Administrators review administrators' expenses, and may approve their own.";
    } else if (isFinance) {
      reviewers = others(admins);
      reviewerBasis = "Expenses submitted by Finance users are reviewed by an administrator.";
    } else if (principal.role === "manager") {
      const finance = others(active.filter((user) =>
        roleName(user) === "finance" &&
        (user.financeDepartmentIds?.length ? user.financeDepartmentIds : [user.departmentId]).includes(principal.departmentId)));
      reviewers = finance.length ? finance : others(admins);
      reviewerBasis = finance.length
        ? "Managers' expenses are reviewed by Finance users authorized for your department, or by an administrator."
        : "No Finance user is authorized for your department, so an administrator reviews your expenses.";
    } else {
      const managers = others(active.filter((user) => user.teamId === principal.teamId && roleName(user) === "manager"));
      reviewers = managers.length ? managers : admins;
      reviewerBasis = managers.length
        ? "Your team manager reviews your expenses, or an administrator."
        : "Your team has no manager, so an administrator reviews your expenses.";
    }

    const response: MyTeam = {
      scope: isFinance ? "DEPARTMENT" : "TEAM",
      teamName: teamName(principal.teamId),
      departmentNames: departmentIds.map(departmentName).filter(Boolean).sort(),
      members,
      reviewers: reviewers.map(toReviewer).sort(byName),
      reviewerBasis,
    };
    return HttpResponse.json(response);
  }),
];
