import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";

import { useGetAuditLogByIdQuery } from "../api/auditApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";

const actionLabels = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  submit: "Submitted",
  approve: "Approved",
  reject: "Rejected",
  login: "Login",
  logout: "Logout",
} as const;

function AuditDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const {
    data: auditLog,
    isLoading,
    isError,
  } = useGetAuditLogByIdQuery(id ?? "", {
    skip: !id,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState message="Unable to load audit log." />;
  }

  if (!auditLog) {
    return <Alert severity="warning">Audit log not found.</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Typography variant="h4">Audit Details</Typography>

          <Typography color="text.secondary">
            Review the details of this activity.
          </Typography>
        </div>

        <Button variant="outlined" onClick={() => navigate("/audit")}>
          Back to Audit Log
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Action
              </Typography>

              <div>
                <Chip label={actionLabels[auditLog.action]} size="small" />
              </div>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Actor
              </Typography>

              <Typography>{auditLog.actorName}</Typography>

              <Typography variant="body2" color="text.secondary">
                Actor ID: {auditLog.actorId}
              </Typography>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Resource
              </Typography>

              <Typography>{auditLog.resource}</Typography>

              <Typography variant="body2" color="text.secondary">
                Resource ID: {auditLog.resourceId}
              </Typography>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Description
              </Typography>

              <Typography>{auditLog.description}</Typography>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Timestamp
              </Typography>

              <Typography>
                {new Date(auditLog.createdAt).toLocaleString("en-IN")}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

export default AuditDetailsPage;
