import { roleHandlers } from "./handler/roleHandlers";
import { expensesHandlers } from "./handler/expenseHandlers";
import { authHandlers } from "./handler/authHandlers";
import { usersHandlers } from "./handler/usersHandlers";

export const handlers = [
  ...authHandlers,
  ...expensesHandlers,
  ...roleHandlers,
  ...usersHandlers,
];