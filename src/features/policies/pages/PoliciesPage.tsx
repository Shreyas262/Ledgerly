import { useState } from "react";
import { BackLink } from "../../../components/navigation/BackLink";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AddOutlined } from "@mui/icons-material";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import { useNavigate } from "react-router-dom";

import { useGetPoliciesQuery } from "../api/policiesApi";
import { useGetDepartmentsQuery } from "../../organizations/api/organizationApi";
import { PolicyCard } from "../components/PolicyCard";
import { PolicySimulatorDialog } from "../components/PolicySimulatorDialog";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { usePermissions } from "../../auth/hooks/usePermissions";
import { PageHeader } from "../../../components/common/PageHeader";
import { EXPENSE_TYPE_LABELS, EXPENSE_TYPES, type ExpenseType } from "../../expenses/types/expense";
import type { ExpensePolicy } from "../types/policy";

const STATUS_ORDER = { active: 0, draft: 1, inactive: 2 } as const;

export function PoliciesPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  const {
    data: policies,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetPoliciesQuery();
  const { data: departments = [] } = useGetDepartmentsQuery();

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  const departmentName = (id: string) => departments.find((department) => department.id === id)?.name ?? id;
  const active = (policies ?? []).filter((policy) => policy.status === "active");
  const organizationWide = (type: ExpenseType | undefined) =>
    active.find((policy) => policy.expenseType === type && !policy.departmentIds?.length);
  const departmentPolicies = (type: ExpenseType | undefined) =>
    active.filter((policy) => policy.expenseType === type && policy.departmentIds?.length);
  const fallback = organizationWide(undefined);
  const sorted = [...(policies ?? [])].sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name));

  const policyLink = (policy: ExpensePolicy) => (
    <Chip
      key={policy.id}
      size="small"
      label={policy.departmentIds?.length ? `${policy.departmentIds.map(departmentName).join(", ")}: ${policy.name}` : policy.name}
      onClick={() => navigate(`/policies/${policy.id}`)}
      variant={policy.departmentIds?.length ? "outlined" : "filled"}
      color="primary"
    />
  );

  return (
    <Stack spacing={3}>
      <BackLink to="/admin" label="Administration" />
      <PageHeader
        title="Policies"
        description="Spending rules checked when expenses are created and enforced when they are submitted."
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<ScienceOutlinedIcon />} onClick={() => setSimulatorOpen(true)}>
              Try a policy
            </Button>
            {can("policies.create") && (
              <Button variant="contained" startIcon={<AddOutlined />} onClick={() => navigate("/policies/new")}>
                Create Policy
              </Button>
            )}
          </Stack>
        }
      />

      {/* Coverage */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="h6">Coverage</Typography>
              <Typography variant="body2" color="text.secondary">
                The active policy for each expense type. Department policies override the organization-wide one for those departments.
              </Typography>
            </Stack>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Expense type</TableCell>
                    <TableCell>Organization-wide</TableCell>
                    <TableCell>Department overrides</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {EXPENSE_TYPES.map((type) => {
                    const typePolicy = organizationWide(type);
                    const overrides = departmentPolicies(type);
                    return (
                      <TableRow key={type}>
                        <TableCell>{EXPENSE_TYPE_LABELS[type]}</TableCell>
                        <TableCell>
                          {typePolicy
                            ? policyLink(typePolicy)
                            : fallback
                              ? <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>{policyLink(fallback)}<Typography variant="caption" color="text.secondary">all types</Typography></Stack>
                              : <Chip size="small" color="warning" variant="outlined" label="No policy" />}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                            {overrides.length ? overrides.map(policyLink) : <Typography variant="body2" color="text.secondary">—</Typography>}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </CardContent>
      </Card>

      {/* Policies */}
      <Typography variant="h6">All policies</Typography>
      {!sorted.length ? (
        <EmptyState message="No policies yet. Without a policy, only the receipt requirement is checked." />
      ) : (
        <Grid container spacing={2}>
          {sorted.map((policy) => (
            <Grid key={policy.id} size={{ xs: 12, md: 6, lg: 4 }}>
              <PolicyCard
                policy={policy}
                departmentName={departmentName}
                onView={(selectedPolicy) => navigate(`/policies/${selectedPolicy.id}`)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <PolicySimulatorDialog open={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
    </Stack>
  );
}
