import type { ReceiptDetails } from "./parseReceiptText";

/** Where each detail read from a receipt goes in a form, and how the field is named to the user. */
export type ReceiptFieldMap<Form> = Record<ReceiptDetailKey, { field: keyof Form; label: string }>;

type ReceiptDetailKey = Exclude<keyof ReceiptDetails, "amountUncertain">;

export interface ReceiptFill<Form> {
  form: Form;
  /** Labels of the fields that were filled. */
  filled: string[];
  /** Labels of the fields the receipt did not reveal and the user has not filled. */
  missing: string[];
  /** The amount filled in may have been misread. */
  checkAmount: boolean;
}

const DETAILS: ReceiptDetailKey[] = ["amount", "currency", "date", "merchant"];

// Most receipts do not name their currency; the form then keeps the one
// chosen, so it is not reported as missing.
const OPTIONAL_DETAILS = new Set<ReceiptDetailKey>(["currency"]);

/**
 * Fills a form from a receipt. Fields the user has typed in keep their value;
 * every other field takes what the receipt shows.
 */
export function applyReceiptDetails<Form extends object>(
  form: Form,
  details: ReceiptDetails,
  fields: ReceiptFieldMap<Form>,
  edited: ReadonlySet<keyof Form>,
): ReceiptFill<Form> {
  const next = { ...form };
  const filled: string[] = [];
  const missing: string[] = [];

  for (const detail of DETAILS) {
    const { field, label } = fields[detail];
    if (edited.has(field)) continue;
    const value = details[detail];
    if (value === undefined) {
      if (!OPTIONAL_DETAILS.has(detail)) missing.push(label);
      continue;
    }
    next[field] = String(value) as Form[keyof Form];
    filled.push(label);
  }

  const amountFilled = !edited.has(fields.amount.field) && details.amount !== undefined;
  return { form: next, filled, missing, checkAmount: amountFilled && details.amountUncertain === true };
}

const joinLabels = (labels: string[]) =>
  labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];

/** Explains what a receipt filled in, for the notice above the form. */
export function describeReceiptFill(fileName: string, { filled, missing, checkAmount = false }: Pick<ReceiptFill<unknown>, "filled" | "missing"> & { checkAmount?: boolean }): string {
  if (!filled.length) {
    return missing.length
      ? `No details could be read from ${fileName}. Fill in the fields yourself.`
      : `${fileName} has been attached. The details you entered have been kept.`;
  }
  const notFound = missing.length ? ` The ${joinLabels(missing)} could not be read.` : "";
  const amountWarning = checkAmount
    ? " The amount was read without a decimal point and may be too large, so check it against the receipt."
    : "";
  return `Filled from ${fileName}: ${joinLabels(filled)}. Check them before saving.${notFound}${amountWarning}`;
}
