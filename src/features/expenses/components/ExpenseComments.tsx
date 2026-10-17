import { useState, type FormEvent } from "react";
import { Alert, Box, Button, Chip, Divider, Paper, Stack, TextField, Typography } from "@mui/material";

import { useAddExpenseCommentMutation, useGetExpenseCommentsQuery } from "../api/expenseApi";
import { MAX_COMMENT_LENGTH } from "../types/comment";
import { useAuth } from "../../auth/context/AuthContext";
import { useConfirm } from "../../../components/common/ConfirmProvider";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { LoadingState } from "../../../components/common/LoadingState";
import { getApiErrorDetails } from "../../../services/api/apiErrors";
import { formatDateTime, humanize } from "../../../utils/format";

interface ExpenseCommentsProps {
  expenseId: string;
}

/**
 * The discussion between an expense's owner and its reviewers. Comments are
 * permanent; the API decides who may read and add to the thread.
 */
export function ExpenseComments({ expenseId }: ExpenseCommentsProps) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [body, setBody] = useState("");
  const { data: thread, isLoading, isError, error, refetch } = useGetExpenseCommentsQuery(expenseId);
  const [addComment, { isLoading: isPosting, error: postError, reset }] = useAddExpenseCommentMutation();
  const fieldError = getApiErrorDetails(postError).fieldErrors?.body?.toString();
  const trimmed = body.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed) return;
    if (!(await confirm({ title: "Post Comment", message: "Post this comment? Comments cannot be edited or removed.", confirmLabel: "Post" }))) return;
    try {
      await addComment({ id: expenseId, body: trimmed }).unwrap();
      setBody("");
    } catch {
      // The comment is kept so it can be corrected or posted again.
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">Comments</Typography>

        {isLoading && <LoadingState message="Loading comments…" />}
        {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

        {thread && (
          <>
            {thread.comments.length === 0 ? (
              <EmptyState title="No comments yet" message="Questions and answers about this expense appear here." />
            ) : (
              <Stack component="ol" spacing={2} divider={<Divider />} sx={{ listStyle: "none", m: 0, p: 0 }}>
                {thread.comments.map((comment) => (
                  <Box component="li" key={comment.id}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.5 }}>
                      <Typography variant="subtitle2">{comment.authorName}</Typography>
                      {comment.authorRole && <Typography variant="body2" color="text.secondary">{humanize(comment.authorRole)}</Typography>}
                      {comment.authorId === user?.id && <Chip size="small" label="You" />}
                      <Typography variant="body2" color="text.secondary" component="span">
                        {formatDateTime(comment.createdAt)}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {comment.body}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}

            {thread.canComment ? (
              <Stack component="form" spacing={1.5} onSubmit={handleSubmit} noValidate>
                {postError && !fieldError && <ApiFeedback error={postError} />}
                <TextField
                  label="Add a comment"
                  value={body}
                  onChange={(event) => {
                    setBody(event.target.value);
                    if (postError) reset();
                  }}
                  error={Boolean(fieldError) || body.length > MAX_COMMENT_LENGTH}
                  helperText={fieldError ?? `${trimmed.length}/${MAX_COMMENT_LENGTH}`}
                  multiline
                  minRows={2}
                  fullWidth
                />
                <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
                  <Button type="submit" variant="contained" loading={isPosting} disabled={!trimmed}>
                    Post Comment
                  </Button>
                </Stack>
              </Stack>
            ) : (
              thread.closedReason && <Alert severity="info">{thread.closedReason}</Alert>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}
