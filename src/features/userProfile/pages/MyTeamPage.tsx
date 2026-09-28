import {
  Avatar,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { BackLink } from "../../../components/navigation/BackLink";
import { PageHeader } from "../../../components/common/PageHeader";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { humanize } from "../../../utils/format";
import { useGetMyTeamQuery } from "../api/myTeamApi";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

/** The caller's team (Finance: authorized departments) and who reviews their expenses (§9.6). */
export function MyTeamPage() {
  const { data, isLoading, isError, error, refetch } = useGetMyTeamQuery(undefined, { refetchOnMountOrArgChange: true });

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState error={error} onRetry={refetch} />;

  const isDepartment = data.scope === "DEPARTMENT";

  return (
    <Stack spacing={3}>
      <BackLink to="/account" label="Account" />
      <PageHeader
        title={isDepartment ? "My Department" : "My Team"}
        description={isDepartment
          ? `Members of the departments you are authorized for: ${data.departmentNames.join(", ")}.`
          : `Members of the ${data.teamName} team.`}
      />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="h6">Your expenses are reviewed by</Typography>
              <Typography variant="body2" color="text.secondary">{data.reviewerBasis}</Typography>
            </Stack>
            {data.reviewers.length ? (
              <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
                {data.reviewers.map((reviewer) => (
                  <Stack key={reviewer.id} direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 200 }}>
                    <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: "primary.main", color: "primary.contrastText" }}>
                      {initials(reviewer.name)}
                    </Avatar>
                    <Stack>
                      <Typography variant="subtitle2">{reviewer.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{humanize(reviewer.role)}</Typography>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">No reviewer is currently available. Contact an administrator.</Typography>
            )}
            {/* Escalation only changes the reviewer when an administrator is not already the reviewer. */}
            {data.reviewers.some((reviewer) => reviewer.role !== "admin") && (
              <Typography variant="caption" color="text.secondary">
                Expenses above a policy approval threshold are reviewed one level higher, by Finance or an administrator.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Members ({data.members.length})</Typography>
            {!data.members.length ? (
              <EmptyState message="There are no active members to show." />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Role</TableCell>
                      {isDepartment && <TableCell>Department</TableCell>}
                      {isDepartment && <TableCell>Team</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                            <Avatar sx={{ width: 30, height: 30, fontSize: 12 }}>{initials(member.name)}</Avatar>
                            <Typography variant="body2">{member.name}</Typography>
                            {member.isSelf && <Chip label="You" size="small" color="primary" variant="outlined" />}
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <Typography variant="body2">{humanize(member.role)}</Typography>
                            {member.isManager && <Chip label="Team manager" size="small" variant="outlined" />}
                          </Stack>
                        </TableCell>
                        {isDepartment && <TableCell>{member.departmentName}</TableCell>}
                        {isDepartment && <TableCell>{member.teamName}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
