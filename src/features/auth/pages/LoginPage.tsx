import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  Link,
  Stack,
  Tab,
  Tabs,
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
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useSearchParams,
  type Location,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLoginMutation } from "../api/authApi";
import type { AccountType } from "../types/auth";
import AuthLayout from "../../../layouts/AuthLayout/AuthLayout";
import { getApiErrorMessage } from "../../../services/api/apiErrors";

const COPY: Record<AccountType, { title: string; subtitle: string }> = {
  organization: {
    title: "Organization login",
    subtitle: "Sign in to your organization's Ledgerly workspace.",
  },
  personal: {
    title: "Personal login",
    subtitle: "Sign in to manage your personal expenses and budgets.",
  },
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const accountType: AccountType = searchParams.get("type") === "personal" ? "personal" : "organization";
  const redirectTo =
    // Without a page to return to, the user's chosen start page opens.
    (location.state as { from?: Location } | null)?.from?.pathname ??
    "/start";

  const [login, { isLoading, isError, error, reset }] = useLoginMutation();
  const { refetchUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleAccountTypeChange = (_event: SyntheticEvent, value: AccountType) => {
    reset();
    // Replace, so switching tabs does not fill the browser history.
    setSearchParams(value === "personal" ? { type: "personal" } : {}, { replace: true, state: location.state });
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await login({
        email,
        password,
        accountType,
      }).unwrap();

      await refetchUser().unwrap();

      navigate(redirectTo, { replace: true });
    } catch {
      // Error state is rendered below.
    }
  };

  return (
    <AuthLayout variant={accountType}>
      <Stack component="form" onSubmit={handleSubmit} spacing={3} noValidate>
        <Tabs
          value={accountType}
          onChange={handleAccountTypeChange}
          variant="fullWidth"
          aria-label="Account type"
        >
          <Tab value="organization" label="Organization" />
          <Tab value="personal" label="Personal" />
        </Tabs>

        <Stack spacing={0.75}>
          <Typography variant="h4" component="h1">
            {COPY[accountType].title}
          </Typography>

          <Typography color="text.secondary">
            {COPY[accountType].subtitle}
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

        {accountType === "personal" ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            New to Ledgerly?{" "}
            <Link component={RouterLink} to="/auth/register">
              Create a personal account
            </Link>
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            Organization accounts are created by your administrator.
          </Typography>
        )}
      </Stack>
    </AuthLayout>
  );
}
