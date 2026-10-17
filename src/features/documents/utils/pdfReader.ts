import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Loaded only when a PDF receipt is read; PDF.js parses in its own worker.
GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Rendering scale for pages that have to be read by OCR. */
const OCR_SCALE = 2;

export interface PdfPage {
  /** The page's text, one printed line per line. */
  text: string;
  /** Draws the page as an image, for pages that only contain a scan. */
  render: () => Promise<HTMLCanvasElement>;
}

/** Opens a PDF and reads the text of its first pages. Call `close` when done. */
export async function readPdf(file: File, maxPages: number): Promise<{ pages: PdfPage[]; close: () => Promise<void> }> {
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  const pages: PdfPage[] = [];

  for (let number = 1; number <= Math.min(pdf.numPages, maxPages); number += 1) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    pages.push({
      text: toLines(content.items.filter((item): item is TextItem => "str" in item)),
      render: async () => {
        const viewport = page.getViewport({ scale: OCR_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        return canvas;
      },
    });
  }

  // Destroying the loading task also stops the PDF.js worker.
  return { pages, close: () => loadingTask.destroy() };
}

/** Groups text runs into printed lines, top to bottom and left to right. */
function toLines(items: TextItem[]): string {
  const lines = new Map<number, TextItem[]>();
  for (const item of items) {
    if (!item.str.trim()) continue;
    // Runs on the same baseline, within a couple of points, share a line.
    const y = Math.round(item.transform[5] / 2) * 2;
    lines.set(y, [...(lines.get(y) ?? []), item]);
  }
  return [...lines.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, runs]) => runs.sort((a, b) => a.transform[4] - b.transform[4]).map((run) => run.str.trim()).join(" "))
    .join("\n");
}
