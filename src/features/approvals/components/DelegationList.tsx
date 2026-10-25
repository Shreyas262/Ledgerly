import { Button, Chip, Divider, Stack, Typography } from "@mui/material";
import type { ChipProps } from "@mui/material";

import { UserAvatar } from "../../../components/common/UserAvatar";
import { useConfirm } from "../../../components/common/useConfirm";
import { formatDate, humanize } from "../../../utils/format";
import { DELEGATION_STATUS_LABELS, type DelegationStatus, type DelegationView } from "../types/delegation";

const statusColor: Record<DelegationStatus, ChipProps["color"]> = {
  active: "success",
  scheduled: "info",
  ended: "default",
  cancelled: "default",
};

interface DelegationListProps {
  delegations: DelegationView[];
  /** Given: the delegates, with Cancel. Received: the people the user acts for. */
  variant: "given" | "received";
  onCancel?: (delegation: DelegationView) => Promise<void>;
  cancellingId?: string | null;
}

/** Delegations with their period and status, stated in words. */
export function DelegationList({ delegations, variant, onCancel, cancellingId }: DelegationListProps) {
  const confirm = useConfirm();

  const handleCancel = async (delegation: DelegationView) => {
    if (!onCancel) return;
    if (!(await confirm({
      title: "Cancel Delegation",
      message: `Cancel the delegation of your reviews to ${delegation.delegateName} (${formatDate(delegation.startDate)} to ${formatDate(delegation.endDate)})? ${delegation.delegateName} will no longer review on your behalf.`,
      confirmLabel: "Cancel Delegation",
      destructive: true,
    }))) return;
    await onCancel(delegation);
  };

  return (
    <Stack divider={<Divider flexItem />} spacing={1.5}>
      {delegations.map((delegation) => {
        const name = variant === "given" ? delegation.delegateName : delegation.delegatorName;
        const cancellable = variant === "given" && (delegation.status === "active" || delegation.status === "scheduled");
        return (
          <Stack key={delegation.id} direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
              <UserAvatar name={name} />
              <Stack sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2">
                  {variant === "given" ? `${name} · ${humanize(delegation.delegateRole)}` : `On behalf of ${name}`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(delegation.startDate)} – {formatDate(delegation.endDate)}
                </Typography>
                {delegation.notInEffectReason && (
                  <Typography variant="body2" color="warning.main">Not in effect: {delegation.notInEffectReason}</Typography>
                )}
              </Stack>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0 }}>
              <Chip size="small" label={DELEGATION_STATUS_LABELS[delegation.status]} color={statusColor[delegation.status]} variant="outlined" />
              {cancellable && (
                <Button size="small" color="error" disabled={cancellingId === delegation.id} onClick={() => handleCancel(delegation)}>
                  Cancel
                </Button>
              )}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
}
