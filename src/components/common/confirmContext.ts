import { createContext } from "react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions (delete, cancel, reject) get a red confirm button. */
  destructive?: boolean;
}

export type Confirm = (options: ConfirmOptions) => Promise<boolean>;

/** Shared by ConfirmProvider, which supplies it, and useConfirm, which reads it. */
export const ConfirmContext = createContext<Confirm | null>(null);
