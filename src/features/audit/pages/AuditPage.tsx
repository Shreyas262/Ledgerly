import { useState } from "react";
import { Alert, Pagination, Stack, Typography } from "@mui/material";

import { useGetAuditEventsQuery } from "../api/auditApi";
import { AuditFilters } from "../components/AuditFilters";
import { AuditTable } from "../components/AuditTable";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import type { AuditAction, AuditEntityType } from "../types/audit";

function AuditPage() {
  const [action, setAction] = useState<AuditAction | "">("");
  const [entityType, setEntityType] = useState<AuditEntityType | "">("");
  const [page, setPage] = useState(1);

  // Every business mutation appends audit events, so the log is refreshed
  // whenever the page is opened rather than served from a stale cache.
  const { data: auditResult, isLoading, isError, error, refetch } = useGetAuditEventsQuery(
    {
      page,
      pageSize: 50,
      filter: {
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
      },
    },
    { refetchOnMountOrArgChange: true },
  );

  const auditEvents = auditResult?.data ?? [];



  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Audit Log</Typography>
        <Typography color="text.secondary">
          Append-only history of authorized business and authentication operations.
        </Typography>
      </div>

      <AuditFilters
        action={action}
        entityType={entityType}
        onActionChange={(nextAction) => { setAction(nextAction); setPage(1); }}
        onEntityTypeChange={(nextEntityType) => { setEntityType(nextEntityType); setPage(1); }}
        onReset={() => {
          setAction("");
          setEntityType("");
          setPage(1);
        }}
      />

      {auditEvents.length === 0 ? (
        <Alert severity="info">No audit activity matches the selected filters.</Alert>
      ) : (
        <AuditTable auditEvents={auditEvents} />
      )}

      {auditResult && auditResult.total > auditResult.pageSize && (
        <Stack sx={{ alignItems: "center" }}>
          <Pagination
            page={auditResult.page}
            count={Math.ceil(auditResult.total / auditResult.pageSize)}
            onChange={(_event, nextPage) => setPage(nextPage)}
            color="primary"
          />
        </Stack>
      )}
    </Stack>
  );
}

export default AuditPage;
