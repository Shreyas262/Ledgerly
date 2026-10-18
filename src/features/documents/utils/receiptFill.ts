import type { ReceiptDetails } from "./parseReceiptText";

/** Where each detail read from a receipt goes in a form, and how the field is named to the user. */
export type ReceiptFieldMap<Form> = Record<keyof ReceiptDetails, { field: keyof Form; label: string }>;

export interface ReceiptFill<Form> {
  form: Form;
  /** Labels of the fields that were filled. */
  filled: string[];
  /** Labels of the fields the receipt did not reveal and the user has not filled. */
  missing: string[];
}

const DETAILS: (keyof ReceiptDetails)[] = ["amount", "date", "merchant"];

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
      missing.push(label);
      continue;
    }
    next[field] = String(value) as Form[keyof Form];
    filled.push(label);
  }

  return { form: next, filled, missing };
}

const joinLabels = (labels: string[]) =>
  labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];

/** Explains what a receipt filled in, for the notice above the form. */
export function describeReceiptFill(fileName: string, { filled, missing }: Pick<ReceiptFill<unknown>, "filled" | "missing">): string {
  if (!filled.length) {
    return missing.length
      ? `No details could be read from ${fileName}. Fill in the fields yourself.`
      : `${fileName} has been attached. The details you entered have been kept.`;
  }
  const notFound = missing.length ? ` The ${joinLabels(missing)} could not be read.` : "";
  return `Filled from ${fileName}: ${joinLabels(filled)}. Check them before saving.${notFound}`;
}
