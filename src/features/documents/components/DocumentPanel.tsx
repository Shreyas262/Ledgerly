import { useState, type ChangeEvent } from "react";
import {
  Alert,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AttachFileOutlinedIcon from "@mui/icons-material/AttachFileOutlined";
import { ApiFeedback } from "../../../components/common/ApiFeedback";
import {
  useFetchDocumentContentMutation,
  useGetExpenseDocumentsQuery,
  useRemoveDocumentMutation,
  useUploadDocumentMutation,
} from "../api/documentApi";

interface DocumentPanelProps {
  expenseId: string;
  canManage: boolean;
}

export function DocumentPanel({ expenseId, canManage }: DocumentPanelProps) {
  const {
    data: documents = [],
    isLoading,
    isError,
  } = useGetExpenseDocumentsQuery(expenseId);
  const [removeDocument, { isLoading: isRemoving }] =
    useRemoveDocumentMutation();
  const [uploadDocument, { isLoading: isUploading, error: uploadError }] =
    useUploadDocumentMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadStates, setUploadStates] = useState<
    Record<string, "pending" | "success" | "error">
  >({});
  const [fileInputKey, setFileInputKey] = useState(0);
  const [fetchDocumentContent, { isLoading: isOpening }] =
    useFetchDocumentContentMutation();

  const openDocument = async (documentId: string) => {
    setActionError(null);
    // Open the tab synchronously so it is not treated as a blocked popup,
    // then point it at the authorized content once it has been retrieved.
    const previewWindow = window.open("", "_blank");
    if (previewWindow) previewWindow.opener = null;

    try {
      const objectUrl = await fetchDocumentContent(documentId).unwrap();
      if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      previewWindow?.close();
      setActionError("The document could not be opened.");
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setActionError(null);
    let hasFailure = false;
    // Each file has its own upload state; one failure does not stop the rest.
    for (const file of files) {
      setUploadStates((current) => ({ ...current, [file.name]: "pending" }));
      try {
        await uploadDocument({ expenseId, file }).unwrap();
        setUploadStates((current) => ({
          ...current,
          [file.name]: "success",
        }));
      } catch {
        hasFailure = true;
        setUploadStates((current) => ({ ...current, [file.name]: "error" }));
      }
    }
    setFileInputKey((current) => current + 1);
    if (hasFailure) {
      setActionError(
        "One or more documents could not be uploaded. Only JPG, PNG, and PDF files up to 5 MB are supported.",
      );
    }
  };

  const handleRemove = async (documentId: string) => {
    setActionError(null);
    try {
      await removeDocument({ id: documentId, expenseId }).unwrap();
    } catch {
      setActionError("The document could not be removed.");
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack
          sx={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h6">Documents & Receipts</Typography>
          {canManage && (
            <Button
              component="label"
              variant="outlined"
              disabled={isUploading || isRemoving}
            >
              Add documents
              <input
                key={fileInputKey}
                hidden
                type="file"
                multiple
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleUpload}
              />
            </Button>
          )}
        </Stack>
        {actionError && <Alert severity="error">{actionError}</Alert>}
        {uploadError && <ApiFeedback error={uploadError} />}
        {isError && (
          <Alert severity="error">Documents could not be loaded.</Alert>
        )}
        {isLoading && (
          <Typography color="text.secondary">Loading documents…</Typography>
        )}
        {Object.entries(uploadStates).map(([name, state]) => (
          <Alert
            key={name}
            severity={
              state === "error"
                ? "error"
                : state === "success"
                  ? "success"
                  : "info"
            }
          >
            {state === "pending"
              ? `Uploading ${name}…`
              : state === "success"
                ? `${name} uploaded.`
                : `${name} could not be uploaded.`}
          </Alert>
        ))}
        {!isLoading && documents.length === 0 && (
          <Typography color="text.secondary">No documents attached.</Typography>
        )}
        {documents.map((document, index) => (
          <Stack key={document.id} spacing={1}>
            {index > 0 && <Divider />}
            <Stack
              sx={{
                display: "flex",
                flexDirection: "row",
                gap: 2,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Stack
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  gap: 1.5,
                  alignItems: "center",
                  minWidth: 0,
                }}
              >
                <AttachFileOutlinedIcon fontSize="small" />
                <Stack sx={{ minWidth: 0 }}>
                  <Typography noWrap>{document.fileName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {Math.ceil(document.size / 1024)} KB · {document.mimeType}
                  </Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  startIcon={<OpenInNewIcon />}
                  disabled={isOpening}
                  onClick={() => openDocument(document.id)}
                >
                  Open
                </Button>
                {canManage && (
                  <Button
                    size="small"
                    color="error"
                    disabled={isRemoving}
                    onClick={() => handleRemove(document.id)}
                  >
                    Remove
                  </Button>
                )}
              </Stack>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
