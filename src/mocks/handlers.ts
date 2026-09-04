import { roleHandlers } from "./handler/roleHandlers";
import { expensesHandlers } from "./handler/expenseHandlers";
import { authHandlers } from "./handler/authHandlers";
import { usersHandlers } from "./handler/usersHandlers";
import { budgetsHandlers } from "./handler/budgetsHandlers";
import { policiesHandlers } from "./handler/policiesHandlers";

export const handlers = [
  ...authHandlers,
  ...expensesHandlers,
  ...roleHandlers,
  ...usersHandlers,
  ...budgetsHandlers,
  ...policiesHandlers,
];