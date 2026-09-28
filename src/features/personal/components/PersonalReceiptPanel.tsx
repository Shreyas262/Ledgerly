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

import { useConfirm } from "../../../components/common/ConfirmProvider";
import { getApiErrorMessage } from "../../../services/api/apiErrors";
import { formatDate } from "../../../utils/format";
import {
  useFetchPersonalDocumentContentMutation,
  useGetPersonalDocumentsQuery,
  useRemovePersonalDocumentMutation,
  useUploadPersonalDocumentMutation,
} from "../api/personalApi";
import { RECEIPT_ACCEPT, validateReceiptFile } from "../utils/receiptFiles";

interface PersonalReceiptPanelProps {
  expenseId: string;
}

/** Receipts and documents attached to a personal expense. */
export function PersonalReceiptPanel({ expenseId }: PersonalReceiptPanelProps) {
  const { data: documents = [], isLoading, isError, refetch } = useGetPersonalDocumentsQuery(expenseId);
  const [uploadDocument, { isLoading: isUploading }] = useUploadPersonalDocumentMutation();
  const [removeDocument, { isLoading: isRemoving }] = useRemovePersonalDocumentMutation();
  const [fetchContent, { isLoading: isOpening }] = useFetchPersonalDocumentContentMutation();
  const confirm = useConfirm();
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const openDocument = async (documentId: string) => {
    setActionError(null);
    // Open the tab synchronously so it is not treated as a blocked popup.
    const previewWindow = window.open("", "_blank");
    if (previewWindow) previewWindow.opener = null;
    try {
      const objectUrl = await fetchContent(documentId).unwrap();
      if (previewWindow) previewWindow.location.href = objectUrl;
      else window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (caught) {
      previewWindow?.close();
      setActionError(getApiErrorMessage(caught, "The document could not be opened."));
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setFileInputKey((current) => current + 1);
    if (files.length === 0) return;
    setActionError(null);
    setNotice(null);

    const invalid = files.map(validateReceiptFile).find(Boolean);
    if (invalid) {
      setActionError(invalid);
      return;
    }
    if (!(await confirm({ title: "Attach Receipts", message: `Attach ${files.map((file) => file.name).join(", ")}?`, confirmLabel: "Attach" }))) return;

    const failed: string[] = [];
    let lastError: unknown = null;
    for (const file of files) {
      try {
        await uploadDocument({ expenseId, file }).unwrap();
      } catch (caught) {
        failed.push(file.name);
        lastError = caught;
      }
    }
    if (failed.length) {
      setActionError(`${failed.join(", ")} could not be attached. ${getApiErrorMessage(lastError, "")}`.trim());
    } else {
      setNotice(files.length === 1 ? `${files[0].name} attached.` : `${files.length} files attached.`);
    }
  };

  const handleRemove = async (documentId: string, fileName: string) => {
    if (!(await confirm({ title: "Remove Receipt", message: `Remove ${fileName} from this expense?`, confirmLabel: "Remove", destructive: true }))) return;
    setActionError(null);
    setNotice(null);
    try {
      await removeDocument({ id: documentId, expenseId }).unwrap();
      setNotice(`${fileName} removed.`);
    } catch (caught) {
      setActionError(getApiErrorMessage(caught, "The document could not be removed."));
    }
  };

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Stack spacing={0.25}>
            <Typography variant="h6">Receipts & Documents</Typography>
            <Typography variant="body2" color="text.secondary">Optional. JPG, PNG or PDF up to 5 MB.</Typography>
          </Stack>
          <Button component="label" variant="outlined" startIcon={<AttachFileOutlinedIcon />} disabled={isUploading || isRemoving} sx={{ flexShrink: 0 }}>
            {isUploading ? "Attaching…" : "Attach"}
            <input key={fileInputKey} hidden type="file" multiple accept={RECEIPT_ACCEPT} onChange={handleUpload} />
          </Button>
        </Stack>

        {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}
        {notice && <Alert severity="success" onClose={() => setNotice(null)}>{notice}</Alert>}
        {isError && (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => refetch()}>Retry</Button>}>
            Documents could not be loaded.
          </Alert>
        )}
        {isLoading && <Typography color="text.secondary">Loading documents…</Typography>}
        {!isLoading && !isError && documents.length === 0 && (
          <Typography color="text.secondary">No receipts attached.</Typography>
        )}

        {documents.map((document, index) => (
          <Stack key={document.id} spacing={1}>
            {index > 0 && <Divider />}
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                <AttachFileOutlinedIcon fontSize="small" color="action" />
                <Stack sx={{ minWidth: 0 }}>
                  <Typography noWrap>{document.fileName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {Math.ceil(document.size / 1024)} KB · added {formatDate(document.createdAt)}
                  </Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                <Button size="small" startIcon={<OpenInNewIcon />} disabled={isOpening} onClick={() => openDocument(document.id)}>
                  Open
                </Button>
                <Button size="small" color="error" disabled={isRemoving} onClick={() => handleRemove(document.id, document.fileName)}>
                  Remove
                </Button>
              </Stack>
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}
