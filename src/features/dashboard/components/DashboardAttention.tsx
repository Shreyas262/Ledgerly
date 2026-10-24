import type { ReactNode } from "react";
import { Box, Button, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import {
  ArrowForwardOutlined,
  BlockOutlined,
  CheckCircleOutlineOutlined,
  EditNoteOutlined,
  ReplayOutlined,
} from "@mui/icons-material";
import { Link as RouterLink } from "react-router-dom";

import type { DashboardAttention as AttentionData } from "../types/dashboard";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

interface AttentionRowProps {
  icon: ReactNode;
  text: string;
  detail?: string;
  action?: { label: string; to: string; state?: unknown };
}

function AttentionRow({ icon, text, detail, action }: AttentionRowProps) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 1 }}>
      <Box aria-hidden="true" sx={{ display: "flex", p: 0.75, borderRadius: 1.5, bgcolor: "accentTone.bg", color: "accentTone.fg" }}>
        {icon}
      </Box>
      <Stack sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1">{text}</Typography>
        {detail && <Typography variant="body2" color="text.secondary">{detail}</Typography>}
      </Stack>
      {action && (
        <Button
          component={RouterLink}
          to={action.to}
          state={action.state}
          variant="outlined"
          size="small"
          endIcon={<ArrowForwardOutlined />}
          sx={{ flexShrink: 0 }}
        >
          {action.label}
        </Button>
      )}
    </Stack>
  );
}

/** The user's own expenses that need them to act, and anything stopping them from creating one. */
export function DashboardAttention({ attention }: { attention: AttentionData }) {
  const rows: AttentionRowProps[] = [];

  if (attention.creationBlockedReason) {
    rows.push({ icon: <BlockOutlined fontSize="small" />, text: "You cannot create expenses right now", detail: attention.creationBlockedReason });
  }
  if (attention.drafts > 0) {
    rows.push({
      icon: <EditNoteOutlined fontSize="small" />,
      text: `${plural(attention.drafts, "draft", "drafts")} not yet submitted`,
      detail: attention.draftsWithoutReceipt > 0
        ? `${plural(attention.draftsWithoutReceipt, "needs", "need")} a receipt before ${attention.draftsWithoutReceipt === 1 ? "it" : "they"} can be submitted.`
        : "Ready to submit for approval.",
      action: { label: "Review Drafts", to: "/expenses", state: { status: "draft" } },
    });
  }
  if (attention.rejected > 0) {
    rows.push({
      icon: <ReplayOutlined fontSize="small" />,
      text: `${plural(attention.rejected, "rejected expense", "rejected expenses")} to revise`,
      detail: "Restore an expense to a draft to correct and resubmit it.",
      action: { label: "Review Rejected", to: "/expenses", state: { status: "rejected" } },
    });
  }

  return (
    <Card component="section" aria-labelledby="attention-title" sx={{ height: "100%" }}>
      <CardContent>
        <Typography id="attention-title" variant="h6">Needs your attention</Typography>
        {rows.length === 0 ? (
          <AttentionRow icon={<CheckCircleOutlineOutlined fontSize="small" />} text="You are all caught up" detail="No drafts or rejected expenses are waiting for you." />
        ) : (
          rows.map((row, index) => (
            <Box key={row.text}>
              {index > 0 && <Divider />}
              <AttentionRow {...row} />
            </Box>
          ))
        )}
      </CardContent>
    </Card>
  );
}
