import {
  EventRepeatOutlined,
  GroupsOutlined,
  HistoryOutlined,
  PersonOutlineOutlined,
  SettingsOutlined,
} from "@mui/icons-material";

import { SectionHub } from "../../../components/navigation/SectionHub";
import { useAuth } from "../../auth/hooks/useAuth";
import { usePermissions } from "../../auth/hooks/usePermissions";
import { accountTypeOf } from "../../auth/utils/accountType";

const SETTINGS_DESCRIPTION = {
  organization: "Theme and notification preferences.",
  personal: "Theme and start page preferences.",
  platform: "Theme preferences.",
} as const;

export function AccountPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isFinance = user?.role === "finance";
  const accountType = accountTypeOf(user);
  // Managers and Finance users who review expenses can delegate their reviews (§22.12).
  const canDelegate = (user?.role === "manager" || isFinance) && can("expenses.approve");

  return (
    <SectionHub
      title="Account"
      description="Your personal profile, account activity and application preferences."
      items={[
        {
          label: "Profile",
          description: "View and update your name and email.",
          path: "/profile",
          icon: <PersonOutlineOutlined />,
        },
        // Only organization accounts have a team or department.
        ...(accountType !== "organization" ? [] : [{
          label: isFinance ? "My Department" : "My Team",
          description: isFinance
            ? "Members of your authorized departments and who reviews your expenses."
            : "Your team members and who reviews your expenses.",
          path: "/account/team",
          icon: <GroupsOutlined />,
        }]),
        ...(canDelegate ? [{
          label: "Review Delegation",
          description: "Let another reviewer review the expenses that wait for you while you are away.",
          path: "/account/delegation",
          icon: <EventRepeatOutlined />,
        }] : []),
        {
          label: "Activity",
          description: "Your sign-ins and recent actions.",
          path: "/activity",
          icon: <HistoryOutlined />,
        },
        {
          label: "Settings",
          description: SETTINGS_DESCRIPTION[accountType],
          path: "/settings",
          icon: <SettingsOutlined />,
        },
      ]}
    />
  );
}
