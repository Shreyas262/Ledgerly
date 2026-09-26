import { useConfirm } from "../../../components/common/ConfirmProvider";
import { useEffect, useState } from "react";
import { Button, Card, CardContent, Stack, TextField } from "@mui/material";

import type { AuthUser } from "../../auth/types/auth";

interface ProfileFormProps {
  user: AuthUser;
  onSubmit: (name: string, email: string) => void;
  isSubmitting?: boolean;
}

export function UserProfileForm({
  user,
  onSubmit,
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

    if (!(await confirm({ title: "Save profile", message: "Save changes to your profile?", confirmLabel: "Save" }))) {
      return;
    }

    onSubmit(name.trim(), email.trim());
  };

  return (
    <Card>
      <CardContent>
        <Stack component="form" onSubmit={handleSubmit} spacing={3}>
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

          <Button type="submit" variant="contained" loading={isSubmitting}>
            Save Changes
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
