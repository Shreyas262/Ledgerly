import {
  AdminPanelSettingsOutlined,
  GroupOutlined,
  KeyOutlined,
  AccountTreeOutlined,
} from "@mui/icons-material";
import { Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export function AdminPage() {
  const sections = [
    { label: "Users", description: "Manage organization users, roles, assignments, activation, and deactivation.", path: "/users", icon: <GroupOutlined /> },
    { label: "Roles & Permissions", description: "Manage roles and controlled application permission assignments.", path: "/roles", icon: <KeyOutlined /> },
    { label: "Organization Structure", description: "Manage departments, teams, and organization configuration.", path: "/admin/organization", icon: <AccountTreeOutlined /> },
  ];

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Administration</Typography>
        <Typography color="text.secondary">
          Organization-scoped administrative controls. Domain ownership and lifecycle rules remain enforced by their respective APIs.
        </Typography>
      </Stack>

      <Stack spacing={2}>
        {sections.map((section) => (
          <Card key={section.path}>
            <CardContent>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                  {section.icon}
                  <Stack>
                    <Typography variant="h6">{section.label}</Typography>
                    <Typography variant="body2" color="text.secondary">{section.description}</Typography>
                  </Stack>
                </Stack>
                <Button component={RouterLink} to={section.path} variant="outlined">Open</Button>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <AdminPanelSettingsOutlined />
            <Typography variant="body2" color="text.secondary">
              Administrative mutations are authorized at the API boundary and produce audit events. They do not grant access to separate Personal-mode data.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
