import {
  AccountBalanceOutlined,
  AssessmentOutlined,
  DashboardOutlined,
  PeopleOutlined,
  PolicyOutlined,
  ReceiptLongOutlined,
  RequestQuoteOutlined,
  SecurityOutlined,
  SettingsOutlined,
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
} from "@mui/material";
import { NavLink } from "react-router-dom";
import type { Permission } from "../../../types/auth";
import { useAuth } from "../../../features/auth/context/AuthContext";
import { hasPermission } from "../../../features/auth/utils/permissions";

interface SidebarProps {
  isMobile: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: Permission;
}

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: <DashboardOutlined />,
  },
  {
    label: "Expenses",
    path: "/expenses",
    icon: <ReceiptLongOutlined />,
    permission: "expenses.read",
  },
  {
    label: "Approvals",
    path: "/approvals",
    icon: <RequestQuoteOutlined />,
    permission: "expenses.approve",
  },
  {
    label: "Budgets",
    path: "/budgets",
    icon: <AccountBalanceOutlined />,
    permission: "budgets.read",
  },
  {
    label: "Analytics",
    path: "/analytics",
    icon: <AssessmentOutlined />,
    permission: "analytics.read",
  },
  {
    label: "Users",
    path: "/users",
    icon: <PeopleOutlined />,
    permission: "users.read",
  },
  {
    label: "Roles & Permissions",
    path: "/roles",
    icon: <SecurityOutlined />,
    permission: "roles.read",
  },
  {
    label: "Policies",
    path: "/policies",
    icon: <PolicyOutlined />,
    permission: "policies.read",
  },
  {
    label: "Settings",
    path: "/settings",
    icon: <SettingsOutlined />,
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {

  const { user } = useAuth();

  const visibleNavigationItems = navigationItems.filter((item) => {
    if (!item.permission) {
      return true;
    }

    return hasPermission(user, item.permission);
  });

  return (
    <Box sx={{ width: 260 }}>
      <Box sx={{ px: 3, py: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }} >
          Ledgerly
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Expense Management
        </Typography>
      </Box>

      <Divider />

      <Box component="nav" aria-label="Main navigation">
        <List sx={{ px: 1.5, py: 2 }}>
          {visibleNavigationItems.map((item) => (
            <ListItemButton
              key={item.path}
              component={NavLink}
              to={item.path}
              onClick={onNavigate}
              sx={{
                mb: 0.5,
                borderRadius: 1.5,
                "&.active": {
                  backgroundColor: "action.selected",
                  color: "primary.main",
                },
                "&.active .MuiListItemIcon-root": {
                  color: "primary.main",
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>

              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Box>
  );
}

export function Sidebar({
  isMobile,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{
          keepMounted: true,
        }}
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
        width: 260,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 260,
          boxSizing: "border-box",
          borderRight: 1,
          borderColor: "divider",
        },
      }}
    >
      <SidebarContent />
    </Drawer>
  );
}