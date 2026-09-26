import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowForwardOutlined, ExpandMoreOutlined } from "@mui/icons-material";

import { useGetAuditEventByIdQuery } from "../api/auditApi";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { PageHeader } from "../../../components/common/PageHeader";
import { BackLink } from "../../../components/navigation/BackLink";
import { Amount } from "../../../components/common/Amount";
import { formatDateTime, humanize } from "../../../utils/format";

interface FieldChange {
  field: string;
  previousValue: unknown;
  newValue: unknown;
}

const isFieldChangeList = (value: unknown): value is FieldChange[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((item) => item !== null && typeof item === "object" && "field" in item);

/** `previousAmount` -> "Previous amount". */
const labelFor = (key: string) => humanize(key.replace(/([a-z0-9])([A-Z])/g, "$1_$2"));

/** Identifier keys stay in Technical details rather than the readable view. */
const isIdentifierKey = (key: string) => /(^id|Id|Ids)$/.test(key);

function formatValue(key: string, value: unknown): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && /amount/i.test(key)) return <Amount value={value} />;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value) && value.every((item) => typeof item !== "object")) return value.join(", ");
  return JSON.stringify(value);
}

function AuditDetailsPage() {
  const { id } = useParams();
  const { data: event, isLoading, isError, error, refetch } = useGetAuditEventByIdQuery(id ?? "", {
    skip: !id,
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!event) return <Alert severity="warning">Audit event not found.</Alert>;

  const metadataEntries = Object.entries(event.metadata ?? {}).filter(([key]) => !isIdentifierKey(key));
  const hasStateChange = Boolean(event.previousState || event.newState);

  return (
    <Stack spacing={3}>
      <BackLink to="/audit" label="Audit Log" />
      <PageHeader
        title="Audit Details"
        description="Audit records are read-only and cannot be edited or deleted."
      />

      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
            >
              <Chip label={humanize(event.action)} sx={{ alignSelf: "flex-start" }} />
              <Typography variant="body2" color="text.secondary">
                {formatDateTime(event.timestamp)}
              </Typography>
            </Stack>

            <Typography variant="subtitle1">{event.description || "No description recorded."}</Typography>

            <Divider />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Field label="Performed by" value={event.actorName ?? "Unknown user"} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Field label="Area" value={humanize(event.entityType)} />
              </Grid>
              {hasStateChange && (
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Field
                    label="Status change"
                    value={
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Chip size="small" label={humanize(event.previousState)} />
                        <ArrowForwardOutlined fontSize="small" color="action" />
                        <Chip size="small" label={humanize(event.newState)} />
                      </Stack>
                    }
                  />
                </Grid>
              )}
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {metadataEntries.length > 0 && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Details</Typography>
              <Stack divider={<Divider />} spacing={1.5}>
                {metadataEntries.map(([key, value]) =>
                  isFieldChangeList(value) ? (
                    value.map((change) => (
                      <DetailRow
                        key={`${key}-${change.field}`}
                        label={labelFor(change.field)}
                        value={
                          <>
                            {formatValue(change.field, change.previousValue)}
                            {" → "}
                            {formatValue(change.field, change.newValue)}
                          </>
                        }
                      />
                    ))
                  ) : (
                    <DetailRow key={key} label={labelFor(key)} value={formatValue(key, value)} />
                  ),
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Accordion disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreOutlined />}>
          <Typography variant="subtitle2">Technical details</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Grid container spacing={2}>
              {[
                ["Event ID", event.id],
                ["Record ID", event.entityId],
                ["Actor ID", event.actorId],
                ["Organization ID", event.organizationId],
              ].map(([label, value]) => (
                <Grid key={label} size={{ xs: 12, sm: 6 }}>
                  <Field
                    label={label}
                    value={
                      <Typography variant="body2" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                        {value || "—"}
                      </Typography>
                    }
                  />
                </Grid>
              ))}
            </Grid>

            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">Raw metadata</Typography>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: "action.hover",
                    fontFamily: "monospace",
                    fontSize: "0.8125rem",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {JSON.stringify(event.metadata, null, 2)}
                </Box>
              </Stack>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {typeof value === "string" ? <Typography>{value}</Typography> : value}
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.25, sm: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: { sm: 200 }, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Stack>
  );
}

export default AuditDetailsPage;
