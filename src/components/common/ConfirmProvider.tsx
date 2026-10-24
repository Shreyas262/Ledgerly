import {
  useCallback,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { ConfirmDialog } from "./ConfirmDialog";
import { ConfirmContext, type Confirm, type ConfirmOptions } from "./confirmContext";

/**
 * Provides a promise-based confirmation dialog so any action can ask
 * `if (await confirm({...}))` before it changes data.
 */
export function ConfirmProvider({ children }: PropsWithChildren) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={Boolean(options)}
        title={options?.title ?? ""}
        message={options?.message ?? ""}
        confirmLabel={options?.confirmLabel ?? "Confirm"}
        cancelLabel={options?.cancelLabel ?? "Cancel"}
        destructive={options?.destructive ?? false}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  );
}
