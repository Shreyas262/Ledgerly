import {
  AccountTreeOutlined,
  AssignmentTurnedInOutlined,
  GroupOutlined,
  KeyOutlined,
  PolicyOutlined,
} from "@mui/icons-material";

import {
  SectionHub,
  type SectionHubItem,
} from "../../../components/navigation/SectionHub";
import { usePermissions } from "../../auth/hooks/usePermissions";
import type { Permission } from "../../roles/types/role";

const sections: Array<SectionHubItem & { permission: Permission }> = [
  {
    label: "Users",
    description:
      "Create users, assign roles, activate, deactivate or remove them.",
    path: "/users",
    icon: <GroupOutlined />,
    permission: "users.read",
  },
  {
    label: "Roles & Permissions",
    description: "Manage roles and the permissions each role grants.",
    path: "/roles",
    icon: <KeyOutlined />,
    permission: "roles.read",
  },
  {
    label: "Organization Structure",
    description: "Departments, teams, team members and Finance assignments.",
    path: "/admin/organization",
    icon: <AccountTreeOutlined />,
    permission: "organization.manage",
  },
  {
    label: "Policies",
    description: "Expense policies, limits and receipt requirements.",
    path: "/policies",
    icon: <PolicyOutlined />,
    permission: "policies.read",
  },
  {
    label: "Audit Log",
    description: "Append-only history of business and authentication events.",
    path: "/audit",
    icon: <AssignmentTurnedInOutlined />,
    permission: "audit.read",
  },
];

export function AdminPage() {
  const { can } = usePermissions();

  return (
    <SectionHub
      title="Administration"
      description="Organization-wide administrative controls."
      items={sections.filter((section) => can(section.permission))}
    />
  );
}
