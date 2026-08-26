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
} from "@mui/material";

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

          <Typography variant="h6" sx={{fontWeight:600}}>
            Dashboard
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton aria-label="Notifications">
            <NotificationsNoneOutlined />
          </IconButton>

          <Avatar
            sx={{
              width: 36,
              height: 36,
            }}
          >
            U
          </Avatar>
        </Box>
      </Toolbar>
    </AppBar>
  );
}