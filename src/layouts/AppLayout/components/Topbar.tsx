import {
  MenuOutlined,
  NotificationsNoneOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
} from "@mui/material";
import type { MouseEvent } from "react";

import { useState } from "react";
import { useNavigate, useMatches } from "react-router-dom";
import { useAppDispatch } from "../../../store/hooks";

import { useLogoutMutation } from "../../../features/auth/api/authApi";
import { useAuth } from "../../../features/auth/context/AuthContext";
import { baseApi } from "../../../services/api/baseApi";

interface RouteHandle {
  title?: string;
}

interface TopbarProps {
  isMobile: boolean;
  mobileSidebaropen: boolean;
  onMobileMenuClick: () => void;
}

export function Topbar({
  isMobile,
  mobileSidebaropen,
  onMobileMenuClick,
}: TopbarProps) {

  const matches = useMatches();
  const currentMatch = [...matches]
    .reverse()
    .find((match) => {
      const handle = match.handle as
        | RouteHandle
        | undefined;

      return Boolean(handle?.title);
    });
  const handle = currentMatch?.handle as
    | RouteHandle
    | undefined;
  
  const pageTitle = handle?.title ?? "Ledgerly";
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const { user } = useAuth();

  const [logout, { isLoading }] = useLogoutMutation();

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const menuOpen = Boolean(anchorEl);

  const handleAccountClick = (
    event: MouseEvent<HTMLElement>,
  ) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } finally {
      dispatch(baseApi.util.resetApiState());
      navigate("/login", { replace: true });
    }
  };

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {isMobile && (
            <IconButton
              edge="start"
              aria-label="Open navigation menu"
              aria-expanded={mobileSidebaropen}
              onClick={onMobileMenuClick}
            >
              <MenuOutlined />
            </IconButton>
          )}

          <Typography variant="h6" component="h1" sx={{fontWeight:600}}>
            {pageTitle}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>

          <IconButton aria-label="Notifications">
            <NotificationsNoneOutlined />
          </IconButton>

          <IconButton
            onClick={handleAccountClick}
            aria-label="Open account menu"
            aria-controls={menuOpen ? "account-menu" : undefined}
            aria-haspopup="true"
            aria-expanded={menuOpen ? "true" : undefined}
          >
            <Avatar>
              {user?.name?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            id="account-menu"
            anchorEl={anchorEl}
            open={menuOpen}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              Profile
            </MenuItem>

            <MenuItem
              onClick={handleLogout}
              disabled={isLoading}
            >
              {isLoading ? "Signing out..." : "Sign out"}
            </MenuItem>
          </Menu>

        </Box>
      </Toolbar>
    </AppBar>
  );
}