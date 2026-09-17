import { useMemo, useState } from "react";
import { Alert, Stack, Typography } from "@mui/material";

import { useGetAuditLogsQuery } from "../api/auditApi";
import { AuditFilters } from "../components/AuditFilters";
import { AuditTable } from "../components/AuditTable";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import type { AuditAction, AuditResource } from "../../../types/audit";

function AuditPage() {
  const { data: auditLogs = [], isLoading, isError } = useGetAuditLogsQuery();

  const [action, setAction] = useState<AuditAction | "">("");

  const [resource, setResource] = useState<AuditResource | "">("");

  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((auditLog) => {
      const matchesAction = !action || auditLog.action === action;

      const matchesResource = !resource || auditLog.resource === resource;

      return matchesAction && matchesResource;
    });
  }, [auditLogs, action, resource]);

  const handleReset = () => {
    setAction("");
    setResource("");
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState message="Unable to load audit logs." />;
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Audit Log</Typography>

        <Typography color="text.secondary">
          Review important activity across your organization.
        </Typography>
      </div>

      <AuditFilters
        action={action}
        resource={resource}
        onActionChange={setAction}
        onResourceChange={setResource}
        onReset={handleReset}
      />

      {filteredAuditLogs.length === 0 ? (
        <Alert severity="info">
          No audit activity matches the selected filters.
        </Alert>
      ) : (
        <AuditTable auditLogs={filteredAuditLogs} />
      )}
    </Stack>
  );
}

export default AuditPage;
