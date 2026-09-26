import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loadingLabel?: string;
  loading?: boolean;
  /** When set, a non-empty reason is required and passed to onConfirm. */
  reasonLabel?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loadingLabel = "Deleting...",
  loading = false,
  reasonLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const isReasonMissing = Boolean(reasonLabel) && !reason.trim();

  const handleCancel = () => {
    setReason("");
    onCancel();
  };

  const handleConfirm = () => {
    if (isReasonMissing) return;
    onConfirm(reasonLabel ? reason.trim() : undefined);
    setReason("");
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : handleCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        {title}
      </DialogTitle>

      <DialogContent>
        <DialogContentText>
          {message}
        </DialogContentText>

        {reasonLabel && (
          <TextField
            label={reasonLabel}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            fullWidth
            multiline
            minRows={3}
            autoFocus
            disabled={loading}
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleCancel}
          disabled={loading}
        >
          {cancelLabel}
        </Button>

        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={loading || isReasonMissing}
        >
          {loading
            ? loadingLabel
            : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
