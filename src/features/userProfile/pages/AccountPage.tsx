import {
  HistoryOutlined,
  PersonOutlined,
  SettingsOutlined,
} from "@mui/icons-material";

import { SectionHub } from "../../../components/navigation/SectionHub";

export function AccountPage() {
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
