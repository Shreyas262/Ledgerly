/** Expense details read from a receipt; anything that could not be read is left out. */
export interface ReceiptDetails {
  amount?: number;
  /** Calendar date as YYYY-MM-DD. */
  date?: string;
  merchant?: string;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Amounts: Indian (1,23,456.78) and international (123,456.78) grouping, or plain digits.
const AMOUNT_PATTERN = /(?:₹|\brs\.?|\binr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d,]*\d)/gi;
const CURRENCY_MARKER = /₹|\brs\.?|\binr\b/i;

// Labelled totals, most specific first. A label wins over any larger stray number.
const TOTAL_LABELS = [
  /\bgrand\s*total\b/i,
  /\b(?:net|total|bill)\s*(?:amount|amt)\b|\bamount\s*(?:payable|due|paid)\b|\btotal\s*(?:payable|due)\b|\bnet\s*payable\b/i,
  /\btotal\b/i,
];
// Lines that mention a total but do not carry the amount paid.
const NOT_A_TOTAL = /\bsub\s*-?\s*total\b|\btotal\s*(?:qty|quantity|items?|tax|gst|savings?|discount)\b/i;

// Lines whose numbers are identifiers, not money.
const IDENTIFIER_LINE = /\bgst(?:in)?\b|\bpan\b|\bfssai\b|\bcin\b|\bph(?:one)?\b|\btel\b|\bmob(?:ile)?\b|\bcontact\b|\b(?:invoice|bill|receipt|order|txn|transaction|ref|token|table|card)\s*(?:no|number|#|id)\b|\bhsn\b|\bsac\b|\bpin\s*code\b/i;

const MERCHANT_SKIP = /\b(?:tax\s*invoice|invoice|receipt|bill\s*of\s*supply|cash\s*memo|welcome|thank|original|duplicate|copy|customer|date|time|gst|phone|tel|mob|email|www|road|rd|street|st|nagar|floor|near|opp|sector|lane|marg|chowk|plot|shop\s*no|building|bldg)\b|@|\d{6}/i;

/** Reads the amount paid, the date and the merchant from a receipt's text. */
export function parseReceiptText(text: string): ReceiptDetails {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const details: ReceiptDetails = {};
  const amount = findAmount(lines);
  if (amount !== undefined) details.amount = amount;
  const date = findDate(lines);
  if (date) details.date = date;
  const merchant = findMerchant(lines);
  if (merchant) details.merchant = merchant;
  return details;
}

function amountsIn(line: string): { value: number; hasCurrency: boolean; hasDecimals: boolean }[] {
  // Dates and times on the same line are not amounts.
  const cleaned = line
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ");
  return Array.from(cleaned.matchAll(AMOUNT_PATTERN)).flatMap((match) => {
    const value = Number(match[1].replace(/,/g, ""));
    // Long digit runs are phone, account or reference numbers.
    if (!Number.isFinite(value) || value <= 0 || match[1].replace(/[,.]/g, "").length > 9) return [];
    return [{ value, hasCurrency: CURRENCY_MARKER.test(match[0]), hasDecimals: match[1].includes(".") }];
  });
}

function findAmount(lines: string[]): number | undefined {
  for (const label of TOTAL_LABELS) {
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (!label.test(line) || NOT_A_TOTAL.test(line)) continue;
      // The amount is usually at the end of the line, otherwise on the next one.
      const onLine = amountsIn(line.replace(label, " "));
      const candidates = onLine.length ? onLine : amountsIn(lines[index + 1] ?? "");
      const amount = candidates.at(-1)?.value;
      if (amount !== undefined) return round(amount);
    }
  }

  // Without a labelled total, the largest amount that looks like money.
  const money = lines
    .filter((line) => !IDENTIFIER_LINE.test(line))
    .flatMap(amountsIn)
    .filter((amount) => amount.hasCurrency || amount.hasDecimals);
  if (!money.length) return undefined;
  return round(Math.max(...money.map((amount) => amount.value)));
}

const round = (value: number) => Math.round(value * 100) / 100;

function toIsoDate(year: number, month: number, day: number): string | undefined {
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  if (fullYear < 2000 || fullYear > 2100) return undefined;
  return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function datesIn(line: string): string[] {
  const found: string[] = [];
  const add = (date: string | undefined) => {
    if (date) found.push(date);
  };
  for (const match of line.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    add(toIsoDate(Number(match[1]), Number(match[2]), Number(match[3])));
  }
  // Numeric dates on Indian receipts are day first.
  for (const match of line.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g)) {
    add(toIsoDate(Number(match[3]), Number(match[2]), Number(match[1])));
  }
  for (const match of line.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]*([a-z]{3})[a-z]*\.?[\s,-]*(\d{4}|\d{2})\b/gi)) {
    const month = MONTHS.indexOf(match[2].toLowerCase()) + 1;
    if (month) add(toIsoDate(Number(match[3]), month, Number(match[1])));
  }
  for (const match of line.matchAll(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/gi)) {
    const month = MONTHS.indexOf(match[1].toLowerCase()) + 1;
    if (month) add(toIsoDate(Number(match[3]), month, Number(match[2])));
  }
  return found;
}

function findDate(lines: string[]): string | undefined {
  // A line labelled as the date wins over dates elsewhere, such as a due date.
  const labelled = lines.filter((line) => /\bdate\b|\bdated\b|\bdt\b/i.test(line) && !/\bdue\b/i.test(line));
  for (const line of [...labelled, ...lines]) {
    const [date] = datesIn(line);
    if (date) return date;
  }
  return undefined;
}

function findMerchant(lines: string[]): string | undefined {
  // The merchant's name is printed at the top of a receipt.
  for (const line of lines.slice(0, 6)) {
    const name = line.replace(/^[^\p{L}\d]+|[^\p{L}\d.)&]+$/gu, "").trim();
    const letters = name.match(/\p{L}/gu)?.length ?? 0;
    if (letters < 3 || letters / name.length < 0.6 || MERCHANT_SKIP.test(name) || datesIn(name).length) continue;
    const isUpperCase = name === name.toUpperCase();
    const readable = isUpperCase
      ? name.toLowerCase().replace(/(^|[\s&(.-])(\p{L})/gu, (_match, start: string, letter: string) => start + letter.toUpperCase())
      : name;
    return readable.slice(0, 80);
  }
  return undefined;
}
