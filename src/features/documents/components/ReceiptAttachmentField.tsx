import { useRef, useState, type ChangeEvent } from "react";
import { Alert, Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { AttachFileOutlined } from "@mui/icons-material";

import { extractReceiptText } from "../utils/extractReceiptText";
import { parseReceiptText, type ReceiptDetails } from "../utils/parseReceiptText";
import { MAX_RECEIPTS, RECEIPT_ACCEPT, validateReceiptFile } from "../utils/receiptFiles";

interface ReceiptAttachmentFieldProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Called with what was read from each newly attached receipt. */
  onRead: (details: ReceiptDetails, file: File) => void;
  disabled?: boolean;
}

/**
 * Attaches receipts to an expense that is being created and reads each one,
 * in the browser, so the form can be filled from it. Reading never blocks the
 * form: a receipt that cannot be read stays attached.
 */
export function ReceiptAttachmentField({ files, onFilesChange, onRead, disabled }: ReceiptAttachmentFieldProps) {
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState<{ name: string; progress: number } | null>(null);
  const [unreadable, setUnreadable] = useState<string[]>([]);
  // Files removed before they have been read are skipped.
  const removed = useRef(new WeakSet<File>());

  const readReceipts = async (added: File[]) => {
    for (const file of added) {
      if (removed.current.has(file)) continue;
      setReading({ name: file.name, progress: 0 });
      try {
        const text = await extractReceiptText(file, (progress) => setReading({ name: file.name, progress }));
        if (!removed.current.has(file)) onRead(parseReceiptText(text), file);
      } catch {
        setUnreadable((current) => [...current, file.name]);
      }
    }
    setReading(null);
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    setFileInputKey((current) => current + 1);
    const invalid = selected.map(validateReceiptFile).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }
    const added = selected.filter((file) => !files.some((item) => item.name === file.name));
    if (files.length + added.length > MAX_RECEIPTS) {
      setError(`Attach at most ${MAX_RECEIPTS} files.`);
      return;
    }
    setError(null);
    onFilesChange([...files, ...added]);
    void readReceipts(added);
  };

  const removeFile = (file: File) => {
    removed.current.add(file);
    onFilesChange(files.filter((item) => item !== file));
    setUnreadable((current) => current.filter((name) => name !== file.name));
  };

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.25}>
        <Typography variant="subtitle2">Receipts</Typography>
        <Typography variant="body2" color="text.secondary">
          JPG, PNG or PDF up to 5 MB each. The amount, date and merchant are read from each receipt and filled in for
          you. You can also add receipts later.
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Button component="label" variant="outlined" startIcon={<AttachFileOutlined />} disabled={disabled}>
          Attach Receipts
          <input key={fileInputKey} hidden type="file" multiple accept={RECEIPT_ACCEPT} onChange={handleFiles} />
        </Button>
        {files.map((file) => (
          <Chip
            key={file.name}
            label={file.name}
            onDelete={disabled ? undefined : () => removeFile(file)}
            sx={{ maxWidth: 260 }}
          />
        ))}
      </Stack>
      <div role="status">
        {reading && (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <CircularProgress size={16} aria-hidden />
            <Typography variant="body2" color="text.secondary">
              Reading {reading.name}… {Math.round(reading.progress * 100)}%
            </Typography>
          </Stack>
        )}
      </div>
      {unreadable.length > 0 && (
        <Alert severity="info" onClose={() => setUnreadable([])}>
          {unreadable.join(", ")} could not be read, but {unreadable.length === 1 ? "remains" : "remain"} attached. Fill in the
          fields yourself.
        </Alert>
      )}
      {error && <Alert severity="warning">{error}</Alert>}
    </Stack>
  );
}
