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
import type { AuditAction, AuditLog } from "../../../types/audit";

interface AuditTableProps {
  auditLogs: AuditLog[];
}

const actionLabels: Record<AuditAction, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  submit: "Submitted",
  approve: "Approved",
  reject: "Rejected",
  login: "Login",
  logout: "Logout",
};

export function AuditTable({ auditLogs }: AuditTableProps) {
  const navigate = useNavigate();

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Actor</TableCell>
            <TableCell>Action</TableCell>
            <TableCell>Resource</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Timestamp</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {auditLogs.map((auditLog) => (
            <TableRow key={auditLog.id}>
              <TableCell>
                <Typography variant="body2">{auditLog.actorName}</Typography>
              </TableCell>

              <TableCell>
                <Chip label={actionLabels[auditLog.action]} size="small" />
              </TableCell>

              <TableCell>{auditLog.resource}</TableCell>

              <TableCell>{auditLog.description}</TableCell>

              <TableCell>
                {new Date(auditLog.createdAt).toLocaleString("en-IN")}
              </TableCell>

              <TableCell>
                <Button
                  size="small"
                  onClick={() => navigate(`/audit/${auditLog.id}`)}
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
