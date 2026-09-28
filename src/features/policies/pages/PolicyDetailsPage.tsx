import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";

import {
  useGetPolicyByIdQuery,
} from "../api/policiesApi";
import { useGetDepartmentsQuery } from "../../organizations/api/organizationApi";
import { useGetAuditEventsQuery } from "../../audit/api/auditApi";
import { usePermissions } from "../../../features/auth/hooks/usePermissions";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";
import { PolicyRuleList } from "../components/PolicyRuleList";
import { EXPENSE_TYPE_LABELS } from "../../expenses/types/expense";
import { formatDateTime, humanize } from "../../../utils/format";

const STATUS_COLOR = { active: "success", draft: "warning", inactive: "default" } as const;
const FIELD_LABELS: Record<string, string> = {
  name: "name",
  description: "description",
  expenseType: "expense type",
  departmentIds: "departments",
  rules: "rules",
  status: "status",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography component="div">{children}</Typography>
    </Stack>
  );
}

export function PolicyDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();

  const {
    data: policy,
    isLoading,
    isError,
    error: policyError,
    refetch,
  } = useGetPolicyByIdQuery(id ?? "", {
    skip: !id,
  });
  const { data: departments = [] } = useGetDepartmentsQuery();
  const canReadAudit = can("audit.read");
  const { data: history } = useGetAuditEventsQuery(
    { filter: { entityId: id ?? "" }, sort: "timestamp", sortOrder: "desc", pageSize: 20 },
    { skip: !id || !canReadAudit },
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={policyError} onRetry={refetch} />;
  }

  if (!policy) {
    return <Alert severity="warning">Policy not found.</Alert>;
  }

  const canUpdate = can("policies.update");
  const departmentName = (departmentId: string) => departments.find((department) => department.id === departmentId)?.name ?? departmentId;

  return (
    <Stack spacing={3}>
      <BackLink to="/policies" label="Policies" />
      <PageHeader
        title={policy.name}
        description={policy.description || "Expense policy"}
        actions={canUpdate && (
          <Button variant="contained" onClick={() => navigate(`/policies/${policy.id}/edit`)} sx={{ minWidth: 140 }}>
            Edit Policy
          </Button>
        )}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Applies to</Typography>
                <Field label="Status">
                  <Chip size="small" label={humanize(policy.status)} color={STATUS_COLOR[policy.status]} />
                </Field>
                <Field label="Expense type">
                  {policy.expenseType ? EXPENSE_TYPE_LABELS[policy.expenseType] : "All expense types"}
                </Field>
                <Field label="Scope">
                  {policy.departmentIds?.length ? policy.departmentIds.map(departmentName).join(", ") : "Whole organization"}
                </Field>
                <Divider />
                <Field label="Created">{formatDateTime(policy.createdAt)}</Field>
                <Field label="Last updated">{formatDateTime(policy.updatedAt)}</Field>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Rules</Typography>
                <PolicyRuleList rules={policy.rules} />
                <Alert severity="info" icon={<ReceiptLongOutlinedIcon />}>
                  A receipt is always required before submission.
                </Alert>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {canReadAudit && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Change history</Typography>
              {!history?.data.length ? (
                <Typography variant="body2" color="text.secondary">No changes recorded.</Typography>
              ) : (
                <Stack divider={<Divider flexItem />} spacing={1.5}>
                  {history.data.map((event) => {
                    const changes = (event.metadata?.changes as Array<{ field: string }> | undefined) ?? [];
                    return (
                      <Stack key={event.id} direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 2 }} sx={{ justifyContent: "space-between" }}>
                        <Stack spacing={0.25}>
                          <Typography variant="body2">
                            {humanize(event.action.replace(/^POLICY_/, ""))}
                            {changes.length > 0 && ` · changed ${changes.map((change) => FIELD_LABELS[change.field] ?? change.field).join(", ")}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{event.actorName ?? event.actorId}</Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateTime(event.timestamp)}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
