import { roleHandlers } from "./handler/roleHandlers";
import { expenseHandlers } from "./handler/expenseHandlers";
import { authHandlers } from "./handler/authHandlers";
import { usersHandlers } from "./handler/usersHandlers";

export const handlers = [
  ...authHandlers,
  ...expenseHandlers,
  ...roleHandlers,
  ...usersHandlers
];