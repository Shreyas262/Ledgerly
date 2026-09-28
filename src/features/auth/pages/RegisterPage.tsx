import {
  Alert,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type SyntheticEvent } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";

import AuthLayout from "../../../layouts/AuthLayout/AuthLayout";
import { useAuth } from "../context/AuthContext";
import { useLoginMutation, useRegisterPersonalMutation } from "../api/authApi";
import { getApiErrorDetails, getApiErrorMessage } from "../../../services/api/apiErrors";

const MIN_PASSWORD_LENGTH = 8;

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

/** Self-service sign-up for personal accounts (§5.15). */
export function RegisterPage() {
  const navigate = useNavigate();
  const { refetchUser } = useAuth();
  const [register, { isLoading: isRegistering, error: registerError }] = useRegisterPersonalMutation();
  const [login, { isLoading: isSigningIn, error: loginError }] = useLoginMutation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const serverErrors = getApiErrorDetails(registerError).fieldErrors ?? {};
  const fieldError = (field: keyof FormErrors) => errors[field] ?? serverErrors[field]?.toString();
  const formError = registerError && !Object.keys(serverErrors).length ? registerError : loginError;

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = "Name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address.";
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (confirmPassword !== password) next.confirmPassword = "The passwords do not match.";
    return next;
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      await register({ name: name.trim(), email: email.trim(), password }).unwrap();
      await login({ email: email.trim(), password, accountType: "personal" }).unwrap();
      await refetchUser().unwrap();
      navigate("/personal/dashboard", { replace: true });
    } catch {
      // Errors are rendered below; the form keeps its input.
    }
  };

  return (
    <AuthLayout variant="personal">
      <Stack component="form" onSubmit={handleSubmit} spacing={3} noValidate>
        <Stack spacing={0.75}>
          <Typography variant="h4" component="h1">
            Create a personal account
          </Typography>
          <Typography color="text.secondary">
            Track your own expenses, receipts and monthly budgets. Your data stays private to you.
          </Typography>
        </Stack>

        {formError && (
          <Alert severity="error">
            {getApiErrorMessage(formError, "Your account could not be created.")}
          </Alert>
        )}

        <TextField
          label="Full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={Boolean(fieldError("name"))}
          helperText={fieldError("name")}
          autoComplete="name"
          required
          fullWidth
          autoFocus
        />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={Boolean(fieldError("email"))}
          helperText={fieldError("email")}
          autoComplete="email"
          required
          fullWidth
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={Boolean(fieldError("password"))}
          helperText={fieldError("password") ?? `At least ${MIN_PASSWORD_LENGTH} characters.`}
          autoComplete="new-password"
          required
          fullWidth
        />
        <TextField
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          error={Boolean(fieldError("confirmPassword"))}
          helperText={fieldError("confirmPassword")}
          autoComplete="new-password"
          required
          fullWidth
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          loading={isRegistering || isSigningIn}
          fullWidth
        >
          Create account
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
          Already have an account?{" "}
          <Link component={RouterLink} to="/auth/login?type=personal">
            Sign in
          </Link>
        </Typography>
      </Stack>
    </AuthLayout>
  );
}
