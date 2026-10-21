import type { TDocumentDefinitions } from "pdfmake/interfaces";

/** Every piece of text in a PDF document definition, in reading order, one per line. */
export function pdfText(definition: TDocumentDefinitions): string {
  const texts: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node === "string") texts.push(node);
    else if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") {
      const { text, stack, columns, table } = node as { text?: unknown; stack?: unknown; columns?: unknown; table?: { body?: unknown } };
      if (text !== undefined) visit(text);
      if (stack) visit(stack);
      if (columns) visit(columns);
      if (table?.body) visit(table.body);
    }
  };
  visit(definition.content);
  return texts.join("\n");
}

/** The cells of the tables in a definition, as rows of text. */
export function pdfTables(definition: TDocumentDefinitions): string[][][] {
  const tables: string[][][] = [];
  const cellText = (cell: unknown): string => pdfText({ content: cell as TDocumentDefinitions["content"] }).replace(/\n/g, " ");
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") {
      const { stack, columns, table } = node as { stack?: unknown; columns?: unknown; table?: { body?: unknown[][] } };
      if (table?.body) tables.push(table.body.map((row) => row.map(cellText)));
      if (stack) visit(stack);
      if (columns) visit(columns);
    }
  };
  visit(definition.content);
  return tables;
}
