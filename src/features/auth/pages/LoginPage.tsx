import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import { useLoginMutation } from "../api/authApi";

export function LoginPage() {
  const navigate = useNavigate();

  const [login, { isLoading, isError }] = useLoginMutation();
  const { refetchUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (
    event: SyntheticEvent<HTMLFormElement>,
  ) => {
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
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: "100%",
          maxWidth: 420,
        }}
      >
        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography variant="h4" component="h1" sx={{fontWeight: 700}}>
              Sign in
            </Typography>

            <Typography color="text.secondary">
              Sign in to continue to Ledgerly.
            </Typography>
          </Stack>

          {isError && (
            <Alert severity="error">
              Invalid email or password.
            </Alert>
          )}

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            fullWidth
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
      </Box>
    </Box>
  );
}