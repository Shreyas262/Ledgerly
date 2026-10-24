import { MenuOutlined } from "@mui/icons-material";
import { NotificationBell } from "../../../features/notifications/components/NotificationBell";
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Tooltip,
  Menu,
  MenuItem,
} from "@mui/material";
import type { MouseEvent } from "react";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useLogoutMutation } from "../../../features/auth/api/authApi";
import { useAuth } from "../../../features/auth/context/AuthContext";
import { accountTypeOf } from "../../../features/auth/utils/accountType";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { UserAvatar } from "../../../components/common/UserAvatar";

interface TopbarProps {
  isMobile: boolean;
  mobileSidebarOpen: boolean;
  onMobileMenuClick: () => void;
}

export function Topbar({
  isMobile,
  mobileSidebarOpen,
  onMobileMenuClick,
}: TopbarProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { user } = useAuth();

  const [logout, { isLoading }] = useLogoutMutation();

  const navigate = useNavigate();
  const confirm = useConfirm();

  const menuOpen = Boolean(anchorEl);

  const handleAccountClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleProfileClick = () => {
    handleMenuClose();
    navigate("/profile");
  };

  const handleSettingsClick = () => {
    handleMenuClose();
    navigate("/settings");
  };

  const handleLogout = async () => {
    handleMenuClose();
    if (!(await confirm({ title: "Sign Out", message: "Sign out of Ledgerly?", confirmLabel: "Sign Out" }))) return;
    // Read before signing out: the user is cleared with the API state.
    const accountType = accountTypeOf(user);
    const loginPath = accountType === "organization" ? "/auth/login" : `/auth/login?type=${accountType}`;

    try {
      await logout().unwrap();
    } finally {
      // The sign-in page clears the API state once it is shown. Clearing it
      // here, while this page is still mounted, would let the page's guard
      // record it as the page to return to after the next sign-in.
      navigate(loginPath, { replace: true, state: { signedOut: true } });
    }
  };

  return (
    <AppBar position="sticky">
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isMobile && (
            <Tooltip title="Menu">
              <IconButton
                edge="start"
                aria-label="Open navigation menu"
                aria-expanded={mobileSidebarOpen}
                onClick={onMobileMenuClick}
              >
                <MenuOutlined />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {/* Notifications describe organization workflows only. */}
          {accountTypeOf(user) === "organization" && <NotificationBell />}

          <Tooltip title={user?.name ? `Account: ${user.name}` : "Account"}>
            <IconButton
              onClick={handleAccountClick}
              aria-label="Open account menu"
              aria-controls={menuOpen ? "account-menu" : undefined}
              aria-haspopup="true"
              aria-expanded={menuOpen ? "true" : undefined}
            >
              <UserAvatar name={user?.name} size="small" />
            </IconButton>
          </Tooltip>
          <Menu
            id="account-menu"
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleProfileClick}>Profile</MenuItem>
            <MenuItem onClick={handleSettingsClick}>Settings</MenuItem>

            <MenuItem onClick={handleLogout} disabled={isLoading}>
              {isLoading ? "Signing Out…" : "Sign Out"}
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
