// Same limits as organization documents.
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export const RECEIPT_ACCEPT = ACCEPTED_TYPES.join(",");

/** Returns why a file cannot be attached, or null when it can. */
export function validateReceiptFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG and PDF files are supported.`;
  if (file.size > MAX_FILE_SIZE) return `${file.name}: files can be at most 5 MB.`;
  return null;
}
