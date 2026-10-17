// The limits the organization and personal document endpoints enforce.
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

/** Receipts that can be attached while creating an expense. */
export const MAX_RECEIPTS = 5;

export const RECEIPT_ACCEPT = ACCEPTED_TYPES.join(",");

/** Returns why a file cannot be attached, or null when it can. */
export function validateReceiptFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return `${file.name}: only JPG, PNG and PDF files are supported.`;
  if (file.size > MAX_FILE_SIZE) return `${file.name}: files can be at most 5 MB.`;
  return null;
}
