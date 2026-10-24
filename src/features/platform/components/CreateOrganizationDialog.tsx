import { useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { getApiErrorDetails } from "../../../services/api/apiErrors";
import { useCreateOrganizationMutation } from "../api/platformApi";

const MIN_PASSWORD_LENGTH = 8;

interface Errors {
  name?: string;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
}

interface CreateOrganizationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (message: string) => void;
}

export function CreateOrganizationDialog(props: CreateOrganizationDialogProps) {
  // Remount per open so the form always starts empty.
  return props.open ? <OrganizationForm {...props} /> : null;
}

function OrganizationForm({ onClose, onCreated }: CreateOrganizationDialogProps) {
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [createOrganization, { isLoading, error }] = useCreateOrganizationMutation();
  const confirm = useConfirm();
  const serverErrors = getApiErrorDetails(error).fieldErrors ?? {};
  const fieldError = (field: keyof Errors) => errors[field] ?? serverErrors[field]?.toString();

  const validate = (): Errors => {
    const next: Errors = {};
    if (!name.trim()) next.name = "Organization name is required.";
    if (!adminName.trim()) next.adminName = "Admin name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) next.adminEmail = "Enter a valid email address.";
    if (adminPassword.length < MIN_PASSWORD_LENGTH) next.adminPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    return next;
  };

  const clear = (field: keyof Errors) => setErrors((current) => ({ ...current, [field]: undefined }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!(await confirm({
      title: "Create Organization",
      message: `Create "${name.trim()}" with ${adminName.trim()} (${adminEmail.trim()}) as its Admin?`,
      confirmLabel: "Create",
    }))) return;

    try {
      const organization = await createOrganization({
        name: name.trim(),
        admin: { name: adminName.trim(), email: adminEmail.trim(), password: adminPassword },
      }).unwrap();
      onCreated(`${organization.name} has been created. ${adminName.trim()} can now sign in as its Admin.`);
    } catch {
      // The reason is shown in the dialog.
    }
  };

  return (
    <Dialog open onClose={isLoading ? undefined : onClose} maxWidth="sm" fullWidth>
      <Stack component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>Create Organization</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && !Object.keys(serverErrors).length && <ApiFeedback error={error} />}
            <TextField
              label="Organization name"
              value={name}
              onChange={(event) => { setName(event.target.value); clear("name"); }}
              error={Boolean(fieldError("name"))}
              helperText={fieldError("name")}
              required
              fullWidth
              autoFocus
            />
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">First Admin</Typography>
              <Typography variant="body2" color="text.secondary">
                The Admin signs in with Organization Login, sets up departments, teams and users, and can change this password.
              </Typography>
            </Stack>
            <TextField
              label="Admin name"
              value={adminName}
              onChange={(event) => { setAdminName(event.target.value); clear("adminName"); }}
              error={Boolean(fieldError("adminName"))}
              helperText={fieldError("adminName")}
              required
              fullWidth
            />
            <TextField
              type="email"
              label="Admin email"
              value={adminEmail}
              onChange={(event) => { setAdminEmail(event.target.value); clear("adminEmail"); }}
              error={Boolean(fieldError("adminEmail"))}
              helperText={fieldError("adminEmail")}
              required
              fullWidth
            />
            <TextField
              type="password"
              label="Initial password"
              value={adminPassword}
              onChange={(event) => { setAdminPassword(event.target.value); clear("adminPassword"); }}
              error={Boolean(fieldError("adminPassword"))}
              helperText={fieldError("adminPassword") ?? `At least ${MIN_PASSWORD_LENGTH} characters.`}
              required
              fullWidth
              autoComplete="new-password"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="submit" variant="contained" loading={isLoading}>Create</Button>
        </DialogActions>
      </Stack>
    </Dialog>
  );
}
