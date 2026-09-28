import { useConfirm } from "../../../components/common/ConfirmProvider";
import { useEffect, useState } from "react";
import { Button, Stack, TextField } from "@mui/material";

import type { AuthUser } from "../../auth/types/auth";

interface ProfileFormProps {
  user: AuthUser;
  onSubmit: (name: string, email: string) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function UserProfileForm({
  user,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ProfileFormProps) {
  const confirm = useConfirm();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  const [errors, setErrors] = useState({
    name: "",
    email: "",
  });

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  const validate = () => {
    const nextErrors = {
      name: "",
      email: "",
    };

    if (!name.trim()) {
      nextErrors.name = "Name is required.";
    }

    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    setErrors(nextErrors);

    return !nextErrors.name && !nextErrors.email;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    if (!(await confirm({ title: "Save Profile", message: "Save changes to your profile?", confirmLabel: "Save" }))) {
      return;
    }

    onSubmit(name.trim(), email.trim());
  };

  return (
    <Stack component="form" onSubmit={handleSubmit} spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={Boolean(errors.name)}
          helperText={errors.name}
          fullWidth
          required
        />

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={Boolean(errors.email)}
          helperText={errors.email}
          fullWidth
          required
        />
      </Stack>

      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Button variant="outlined" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" loading={isSubmitting}>
          Save Changes
        </Button>
      </Stack>
    </Stack>
  );
}
