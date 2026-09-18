import { Alert, Button, Stack, TextField, Typography } from "@mui/material";
import { useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLoginMutation } from "../api/authApi";
import AuthLayout from "../../../layouts/AuthLayout/AuthLayout";

export function LoginPage() {
  const navigate = useNavigate();

  const [login, { isLoading, isError }] = useLoginMutation();
  const { refetchUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await login({
        email,
        password,
      }).unwrap();

      await refetchUser().unwrap();

      navigate("/dashboard", { replace: true });
    } catch {
      // Error state is rendered below.
    }
  };

  return (
    <AuthLayout>
      <Stack component="form" onSubmit={handleSubmit} spacing={3} noValidate>
        <Stack spacing={0.5}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
            Sign in
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Enter your credentials to access your account.
          </Typography>
        </Stack>

        {isError && <Alert severity="error">Invalid email or password.</Alert>}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          fullWidth
          autoComplete="email"
          autoFocus
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          fullWidth
          autoComplete="current-password"
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={isLoading}
          fullWidth
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </Stack>
    </AuthLayout>
  );
}
