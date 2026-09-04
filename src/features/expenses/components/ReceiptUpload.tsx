import {
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  AttachFileOutlined,
} from "@mui/icons-material";
import DeleteIcon from "@mui/icons-material/Delete";
import { type ChangeEvent, useEffect, useState } from "react";

interface ReceiptUploadProps {
  value?: File | null;
  onChange: (file: File | null) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];

export function ReceiptUpload({
  value,
  onChange,
}: ReceiptUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<
    string | null
  >(null);

  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!value || !value.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(value);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [value]);

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    event.target.value = "";

    if (!file) {
      return;
    }

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setError(
        "Only JPG, PNG, and PDF files are supported.",
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Receipt must be smaller than 5 MB.");
      return;
    }

    setError(null);
    onChange(file);
  };

  const handleRemove = () => {
    setError(null);
    onChange(null);
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="subtitle1">
          Receipt
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
        >
          Upload a JPG, PNG, or PDF receipt up to 5 MB.
        </Typography>
      </Stack>

      <Button
        component="label"
        variant="outlined"
        startIcon={<AttachFileOutlined />}
        sx={{maxWidth: "30vw"}}
      >
        {value ? "Replace Receipt" : "Upload Receipt"}

        <input
          hidden
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          onChange={handleFileChange}
        />
      </Button>

      {error && (
        <Typography
          variant="body2"
          color="error"
        >
          {error}
        </Typography>
      )}

      {value && (
        <Paper
          variant="outlined"
          sx={{
            p: 2,
          }}
        >
          <Stack spacing={2}>
            {previewUrl && (
              <Stack
                component="img"
                src={previewUrl}
                alt="Receipt preview"
                sx={{
                  width: "100%",
                  maxHeight: 300,
                  objectFit: "contain",
                  borderRadius: 1,
                }}
              />
            )}

            {!previewUrl && (
              <Typography variant="body2">
                {value.name}
              </Typography>
            )}

            <Stack
              direction="row"
              sx={{
                justifyContent: "space-between",
                alignItems: "center",
                gap: 2,
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {value.name}
              </Typography>

              <Button
                color="error"
                size="small"
                startIcon={<DeleteIcon />}
                onClick={handleRemove}
              >
                Remove
              </Button>
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}