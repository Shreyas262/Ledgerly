import { roleHandlers } from "./handler/roleHandlers";
import { expensesHandlers } from "./handler/expenseHandlers";
import { authHandlers } from "./handler/authHandlers";
import { usersHandlers } from "./handler/usersHandlers";
import { budgetsHandlers } from "./handler/budgetsHandlers";
import { policiesHandlers } from "./handler/policiesHandlers";
import { auditHandlers } from "./handler/auditHandlers";
import { authGuardHandler } from "./handler/authGuard";

export const handlers = [
  authGuardHandler,
  ...authHandlers,
  ...expensesHandlers,
  ...roleHandlers,
  ...usersHandlers,
  ...budgetsHandlers,
  ...policiesHandlers,
  ...auditHandlers,
];