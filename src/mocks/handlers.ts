import { roleHandlers } from "./handler/roleHandlers";
import { organizationHandlers } from "./handler/organizationHandlers";
import { expensesHandlers } from "./handler/expenseHandlers";
import { authHandlers } from "./handler/authHandlers";
import { usersHandlers } from "./handler/usersHandlers";
import { budgetsHandlers } from "./handler/budgetsHandlers";
import { policiesHandlers } from "./handler/policiesHandlers";
import { auditHandlers } from "./handler/auditHandlers";
import { authGuardHandler } from "./handler/authGuard";
import { workflowHandlers } from "./handler/workflowHandlers";
import { documentHandlers } from "./handler/documentHandlers";
import { expenseCommentHandlers } from "./handler/expenseCommentHandlers";
import { dashboardHandlers } from "./handler/dashboardHandlers";
import { analyticsHandlers } from "./handler/analyticsHandlers";
import { teamHandlers } from "./handler/teamHandlers";
import { notificationHandlers } from "./handler/notificationHandlers";
import { personalHandlers } from "./handler/personalHandlers";
import { platformHandlers } from "./handler/platformHandlers";
import { exchangeRateHandlers } from "./handler/exchangeRateHandlers";
import { delegationHandlers } from "./handler/delegationHandlers";

export const handlers = [
  authGuardHandler,
  ...authHandlers,
  ...expensesHandlers,
  ...workflowHandlers,
  ...delegationHandlers,
  ...documentHandlers,
  ...expenseCommentHandlers,
  ...dashboardHandlers,
  ...analyticsHandlers,
  ...roleHandlers,
  ...organizationHandlers,
  ...usersHandlers,
  ...budgetsHandlers,
  ...policiesHandlers,
  ...auditHandlers,
  ...teamHandlers,
  ...notificationHandlers,
  ...personalHandlers,
  ...platformHandlers,
  ...exchangeRateHandlers,
];