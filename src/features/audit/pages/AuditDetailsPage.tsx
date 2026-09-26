import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import { useGetAuditEventByIdQuery } from "../api/auditApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

function AuditDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: event, isLoading, isError, error, refetch } = useGetAuditEventByIdQuery(id ?? "", {
    skip: !id,
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!event) return <Alert severity="warning">Audit event not found.</Alert>;

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Typography variant="h4">Audit Details</Typography>
          <Typography color="text.secondary">
            Audit records are read-only and cannot be edited or deleted.
          </Typography>
        </div>
        <Button variant="outlined" onClick={() => navigate("/audit")}>
          Back to Audit Log
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={3}>
            {[
              ["Action", event.action],
              ["Entity", `${event.entityType} / ${event.entityId}`],
              ["Actor", event.actorId],
              ["Organization", event.organizationId],
              ["State", `${event.previousState ?? "—"} → ${event.newState ?? "—"}`],
              ["Timestamp", new Date(event.timestamp).toLocaleString("en-IN")],
              ["Description", event.description ?? "—"],
            ].map(([label, value]) => (
              <Stack spacing={1} key={label}>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography>{value}</Typography>
                <Divider />
              </Stack>
            ))}

            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">Metadata</Typography>
                <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                  {JSON.stringify(event.metadata, null, 2)}
                </Typography>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default AuditDetailsPage;
