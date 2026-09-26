import {
  AccountBalanceOutlined,
  AccountCircleOutlined,
  AdminPanelSettingsOutlined,
  AssessmentOutlined,
  DashboardOutlined,
  ReceiptLongOutlined,
  RequestQuoteOutlined,
} from "@mui/icons-material";
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  type Theme,
} from "@mui/material";
import { NavLink, useLocation } from "react-router-dom";

import type { Permission } from "../../../features/roles/types/role";
import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { administrationPermissions } from "../../../features/roles/constants/permissions";

const SIDEBAR_WIDTH = 260;

const sidebarPaperSx = {
  bgcolor: "sidebar.background",
  backgroundImage: (theme: Theme) => theme.palette.sidebar.gradient,
  color: "sidebar.text",
};

interface SidebarProps {
  isMobile: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** Visible when the user has the permission, or any permission in the list. */
  permission?: Permission | readonly Permission[];
  /** Other path prefixes that belong to this item (its section's pages). */
  matchPaths?: string[];
}

// Everyday work stays one click away.
const primaryItems: NavigationItem[] = [
  { label: "Dashboard", path: "/dashboard", icon: <DashboardOutlined /> },
  { label: "Expenses", path: "/expenses", icon: <ReceiptLongOutlined />, permission: "expenses.read" },
  { label: "Approvals", path: "/approvals", icon: <RequestQuoteOutlined />, permission: ["expenses.approve", "reimbursements.manage"] },
  { label: "Budgets", path: "/budgets", icon: <AccountBalanceOutlined />, permission: "budgets.read" },
  { label: "Analytics", path: "/analytics", icon: <AssessmentOutlined />, permission: "analytics.read" },
];

// Section hubs that group related pages.
const sectionItems: NavigationItem[] = [
  {
    label: "Account",
    path: "/account",
    icon: <AccountCircleOutlined />,
    matchPaths: ["/profile", "/activity", "/settings"],
  },
  {
    label: "Administration",
    path: "/admin",
    icon: <AdminPanelSettingsOutlined />,
    permission: administrationPermissions,
    matchPaths: ["/users", "/roles", "/policies", "/audit"],
  },
];

function isItemActive(item: NavigationItem, pathname: string): boolean {
  return [item.path, ...(item.matchPaths ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = usePermissions();
  const { pathname } = useLocation();

  const isVisible = (item: NavigationItem) =>
    !item.permission ||
    (Array.isArray(item.permission)
      ? item.permission.some((permission) => can(permission))
      : can(item.permission as Permission));

  const renderItem = (item: NavigationItem) => {
    const active = isItemActive(item, pathname);
    return (
      <ListItemButton
        key={item.path}
        component={NavLink}
        to={item.path}
        onClick={onNavigate}
        selected={active}
        aria-current={active ? "page" : undefined}
        sx={{
          mb: 0.5,
          borderRadius: 1.5,
          color: "sidebar.textMuted",
          "& .MuiListItemIcon-root": {
            color: "inherit",
          },
          "&:hover": {
            bgcolor: "sidebar.hover",
            color: "sidebar.text",
          },
          "&.Mui-selected, &.Mui-selected:hover": {
            bgcolor: "sidebar.activeBackground",
            color: "sidebar.activeText",
          },
          "&.Mui-selected .MuiListItemIcon-root": {
            color: "sidebar.activeIcon",
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
        <ListItemText primary={item.label} />
      </ListItemButton>
    );
  };

  return (
    <Box sx={{ width: SIDEBAR_WIDTH }}>
      <Box sx={{ px: 3, py: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Ledgerly
        </Typography>
        <Typography variant="body2" sx={{ color: "sidebar.textMuted" }}>
          Expense Management
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "sidebar.border" }} />

      <Box component="nav" aria-label="Main navigation">
        <List sx={{ px: 1.5, pt: 2, pb: 1 }}>
          {primaryItems.filter(isVisible).map(renderItem)}
        </List>
        <Divider sx={{ mx: 2, borderColor: "sidebar.border" }} />
        <List sx={{ px: 1.5, pt: 1, pb: 2 }}>
          {sectionItems.filter(isVisible).map(renderItem)}
        </List>
      </Box>
    </Box>
  );
}

export function Sidebar({ isMobile, mobileOpen, onMobileClose }: SidebarProps) {
  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ "& .MuiDrawer-paper": sidebarPaperSx }}
      >
        <SidebarContent onNavigate={onMobileClose} />
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      open
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: SIDEBAR_WIDTH,
          boxSizing: "border-box",
          borderRight: 1,
          borderColor: "sidebar.border",
          ...sidebarPaperSx,
        },
      }}
    >
      <SidebarContent />
    </Drawer>
  );
}
