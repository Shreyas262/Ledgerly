import {
  GroupsOutlined,
  HistoryOutlined,
  PersonOutlined,
  SettingsOutlined,
} from "@mui/icons-material";

import { SectionHub } from "../../../components/navigation/SectionHub";
import { useAuth } from "../../auth/context/AuthContext";

export function AccountPage() {
  const { user } = useAuth();
  const isFinance = user?.role === "finance";

  return (
    <SectionHub
      title="Account"
      description="Your personal profile, account activity and application preferences."
      items={[
        {
          label: "Profile",
          description: "View and update your name and email.",
          path: "/profile",
          icon: <PersonOutlined />,
        },
        {
          label: isFinance ? "My Department" : "My Team",
          description: isFinance
            ? "Members of your authorized departments and who reviews your expenses."
            : "Your team members and who reviews your expenses.",
          path: "/account/team",
          icon: <GroupsOutlined />,
        },
        {
          label: "Activity",
          description: "Your sign-ins and recent actions.",
          path: "/activity",
          icon: <HistoryOutlined />,
        },
        {
          label: "Settings",
          description: "Theme and notification preferences.",
          path: "/settings",
          icon: <SettingsOutlined />,
        },
      ]}
    />
  );
}
