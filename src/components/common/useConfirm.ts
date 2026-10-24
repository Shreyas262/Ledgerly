import { useContext } from "react";

import { ConfirmContext, type Confirm } from "./confirmContext";

/** The confirmation dialog of the nearest ConfirmProvider: `if (await confirm({...}))`. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return confirm;
}
