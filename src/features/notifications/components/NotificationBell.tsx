import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import NotificationsNoneOutlined from "@mui/icons-material/NotificationsNoneOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineOutlined from "@mui/icons-material/ErrorOutlineOutlined";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import WarningAmberOutlined from "@mui/icons-material/WarningAmberOutlined";
import { useGetNotificationsQuery } from "../api/notificationsApi";
import { useSettings } from "../../settings/hooks/useSettings";
import type { AppNotification } from "../types/notification";
import { formatDateTime } from "../../../utils/format";

const ICONS: Record<AppNotification["severity"], React.ReactNode> = {
  success: <CheckCircleOutlined color="success" fontSize="small" />,
  error: <ErrorOutlineOutlined color="error" fontSize="small" />,
  warning: <WarningAmberOutlined color="warning" fontSize="small" />,
  info: <InfoOutlined color="info" fontSize="small" />,
};

/** Top-bar notifications: unread count, list and "mark all as read" (§24.4). */
export function NotificationBell() {
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { data = [], refetch } = useGetNotificationsQuery(undefined, {
    pollingInterval: 60_000,
    refetchOnFocus: true,
  });

  const visible = data.filter((notification) => settings.notifications[notification.category]);
  const readAt = settings.notificationsReadAt ?? "";
  const isUnread = (notification: AppNotification) => notification.timestamp > readAt;
  const unread = visible.filter(isUnread).length;

  const open = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    void refetch();
  };
  const markAllRead = () => update({ notificationsReadAt: new Date().toISOString() });
  const go = (link: string) => {
    setAnchorEl(null);
    navigate(link);
  };

  return (
    <>
      <IconButton aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} onClick={open}>
        <Badge badgeContent={unread} color="error" max={9}>
          <NotificationsNoneOutlined />
        </Badge>
      </IconButton>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { width: 380, maxWidth: "calc(100vw - 32px)" } } }}
      >
        <Stack direction="row" sx={{ px: 2, py: 1.5, alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle1">Notifications</Typography>
          <Button size="small" onClick={markAllRead} disabled={!unread}>Mark All as Read</Button>
        </Stack>
        <Divider />
        {visible.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 3, textAlign: "center" }}>
            You have no notifications.
          </Typography>
        ) : (
          <List dense disablePadding sx={{ maxHeight: 420, overflowY: "auto" }}>
            {visible.map((notification) => (
              <ListItemButton
                key={notification.id}
                onClick={() => go(notification.link)}
                sx={{ alignItems: "flex-start", bgcolor: isUnread(notification) ? "action.hover" : undefined }}
              >
                <ListItemIcon sx={{ minWidth: 32, mt: 0.5 }}>{ICONS[notification.severity]}</ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Typography variant="subtitle2">{notification.title}</Typography>
                      {isUnread(notification) && <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />}
                    </Stack>
                  }
                  secondary={
                    <>
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block" }}>
                        {notification.message}
                      </Typography>
                      <Typography component="span" variant="caption" color="text.secondary">
                        {formatDateTime(notification.timestamp)}
                      </Typography>
                    </>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
        <Divider />
        <Box sx={{ px: 2, py: 1 }}>
          <Button size="small" onClick={() => go("/settings")}>Notification Settings</Button>
        </Box>
      </Popover>
    </>
  );
}
