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

interface AuditTableProps {
  auditEvents: AuditEvent[];
}

export function AuditTable({ auditEvents }: AuditTableProps) {
  const navigate = useNavigate();

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Action</TableCell>
            <TableCell>Entity</TableCell>
            <TableCell>Actor ID</TableCell>
            <TableCell>State</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Timestamp</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {auditEvents.map((event) => (
            <TableRow key={event.id}>
              <TableCell><Chip label={event.action} size="small" /></TableCell>
              <TableCell>
                <Typography variant="body2">{event.entityType}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {event.entityId}
                </Typography>
              </TableCell>
              <TableCell>{event.actorId}</TableCell>
              <TableCell>
                {event.previousState || event.newState ? (
                  <Typography variant="body2">
                    {event.previousState ?? "—"} → {event.newState ?? "—"}
                  </Typography>
                ) : "—"}
              </TableCell>
              <TableCell>{event.description ?? "—"}</TableCell>
              <TableCell>
                {new Date(event.timestamp).toLocaleString("en-IN")}
              </TableCell>
              <TableCell>
                <Button size="small" onClick={() => navigate(`/audit/${event.id}`)}>
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
