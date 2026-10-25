import { useState } from "react";
import { Alert, Card, CardContent, Stack, Typography } from "@mui/material";

import { BackLink } from "../../../components/navigation/BackLink";
import { PageHeader } from "../../../components/common/PageHeader";
import { LoadingState } from "../../../components/common/LoadingState";
import { ErrorState } from "../../../components/common/ErrorState";
import { EmptyState } from "../../../components/common/EmptyState";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import {
  useCancelDelegationMutation,
  useGetDelegationCandidatesQuery,
  useGetDelegationsQuery,
} from "../api/delegationApi";
import { DelegationForm } from "../components/DelegationForm";
import { DelegationList } from "../components/DelegationList";
import type { DelegationView } from "../types/delegation";

/**
 * Account → Review Delegation (§22.12): delegate one's reviews for a period,
 * see and cancel one's delegations, and see delegations received.
 */
export function ReviewDelegationPage() {
  const { data, isLoading, isError, error, refetch } = useGetDelegationsQuery();
  const canDelegate = data ? data.delegateRestriction === null : false;
  const { data: candidates = [], isLoading: loadingCandidates } = useGetDelegationCandidatesQuery(undefined, { skip: !canDelegate });
  const [cancelDelegation, { error: cancelError }] = useCancelDelegationMutation();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState error={error} onRetry={refetch} />;

  const handleCancel = async (delegation: DelegationView) => {
    setNotice("");
    setCancellingId(delegation.id);
    try {
      await cancelDelegation(delegation.id).unwrap();
      setNotice(`The delegation to ${delegation.delegateName} has been cancelled.`);
    } catch {
      // The reason is shown above the list.
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Stack spacing={3}>
      <BackLink to="/account" label="Account" />
      <PageHeader
        title="Review Delegation"
        description="While you are away, another reviewer can review the expenses that wait for you. They act on your behalf, every review records it, and you can still review as usual."
      />

      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Delegate your reviews</Typography>
            {data.delegateRestriction ? (
              <Alert severity="info">{data.delegateRestriction}</Alert>
            ) : loadingCandidates ? (
              <LoadingState />
            ) : candidates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nobody is available to review on your behalf. Reviews can be delegated to another manager or Finance user who reviews expenses.
              </Typography>
            ) : (
              <DelegationForm candidates={candidates} onDelegated={setNotice} />
            )}
          </Stack>
        </CardContent>
      </Card>

      {!data.delegateRestriction && (
        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Your delegations</Typography>
              {cancelError && <ApiFeedback error={cancelError} />}
              {data.given.length === 0 ? (
                <EmptyState title="No delegations" message="You have not delegated your reviews." />
              ) : (
                <DelegationList delegations={data.given} variant="given" onCancel={handleCancel} cancellingId={cancellingId} />
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h6">Delegated to you</Typography>
            {data.received.length === 0 ? (
              <EmptyState title="No delegations" message="Nobody has delegated their reviews to you." />
            ) : (
              <DelegationList delegations={data.received} variant="received" />
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
