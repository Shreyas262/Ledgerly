import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  LockOutlined,
  MailOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useState, type SyntheticEvent } from "react";
import { useLocation, useNavigate, type Location } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLoginMutation } from "../api/authApi";
import AuthLayout from "../../../layouts/AuthLayout/AuthLayout";
import { getApiErrorMessage } from "../../../services/api/apiErrors";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    // Without a page to return to, "/" opens the user's chosen start page.
    (location.state as { from?: Location } | null)?.from?.pathname ??
    "/";

  const [login, { isLoading, isError, error }] = useLoginMutation();
  const { refetchUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await login({
        email,
        password,
      }).unwrap();

      await refetchUser().unwrap();

      navigate(redirectTo, { replace: true });
    } catch {
      // Error state is rendered below.
    }
  };

  return (
    <AuthLayout>
      <Stack component="form" onSubmit={handleSubmit} spacing={3} noValidate>
        <Stack spacing={0.75}>
          <Typography variant="h4" component="h1">
            Welcome back
          </Typography>

          <Typography color="text.secondary">
            Sign in to your Ledgerly account.
          </Typography>
        </Stack>

        {isError && (
          <Alert severity="error">
            {getApiErrorMessage(error, "Invalid email or password.")}
          </Alert>
        )}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          fullWidth
          autoComplete="email"
          autoFocus
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <MailOutlined fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <TextField
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          fullWidth
          autoComplete="current-password"
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    edge="end"
                    size="small"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <VisibilityOffOutlined fontSize="small" /> : <VisibilityOutlined fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        <Button
          type="submit"
          variant="contained"
          size="large"
          loading={isLoading}
          fullWidth
        >
          Sign in
        </Button>
      </Stack>
    </AuthLayout>
  );
}
