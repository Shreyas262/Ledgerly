import {
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import type { AuditEvent } from "../types/audit";
import { formatDateTime, humanize } from "../../../utils/format";

interface AuditTableProps {
  auditEvents: AuditEvent[];
}

export function AuditTable({ auditEvents }: AuditTableProps) {
  const navigate = useNavigate();

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 960 }}>
        <TableHead>
          <TableRow>
            <TableCell>Action</TableCell>
            <TableCell>Record</TableCell>
            <TableCell>Performed by</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Date and time</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {auditEvents.map((event) => (
            <TableRow key={event.id} hover>
              <TableCell>
                <Chip label={humanize(event.action)} size="small" />
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {humanize(event.entityType)}
                </Typography>
              </TableCell>
              <TableCell>{event.actorName ?? "Unknown user"}</TableCell>
              <TableCell>
                {/* A single status when the record was created or did not change. */}
                {event.previousState && event.newState && event.previousState !== event.newState ? (
                  <Typography variant="body2">
                    {humanize(event.previousState)} → {humanize(event.newState)}
                  </Typography>
                ) : event.newState || event.previousState ? (
                  <Typography variant="body2">{humanize(event.newState ?? event.previousState)}</Typography>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>{event.description ?? "—"}</TableCell>
              <TableCell sx={{ whiteSpace: "nowrap" }}>
                {formatDateTime(event.timestamp)}
              </TableCell>
              <TableCell align="right">
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate(`/audit/${event.id}`)}
                >
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
