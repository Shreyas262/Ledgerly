/** Receipts rarely run longer; later pages are terms and conditions. */
const MAX_PDF_PAGES = 2;

/** A page with fewer readable characters than this is a scan and needs OCR. */
const MIN_PDF_TEXT_LENGTH = 20;

/**
 * Reads the text of a receipt in the browser. PDFs with a text layer are read
 * directly; images and scanned PDF pages go through OCR. The readers are
 * loaded on first use so they never weigh on the rest of the app.
 *
 * @param onProgress Called with the share of the work done, from 0 to 1.
 */
export async function extractReceiptText(file: File, onProgress: (fraction: number) => void = () => {}): Promise<string> {
  if (file.type !== "application/pdf") {
    const { readImages } = await import("./imageReader");
    const [text] = await readImages([file], onProgress);
    return text;
  }

  const { readPdf } = await import("./pdfReader");
  const pdf = await readPdf(file, MAX_PDF_PAGES);
  try {
    const scanned = pdf.pages.filter((page) => page.text.replace(/\s/g, "").length < MIN_PDF_TEXT_LENGTH);
    let ocrTexts: string[] = [];
    if (scanned.length) {
      const images = await Promise.all(scanned.map((page) => page.render()));
      const { readImages } = await import("./imageReader");
      ocrTexts = await readImages(images, onProgress);
    }
    onProgress(1);
    return pdf.pages.map((page) => (scanned.includes(page) ? ocrTexts[scanned.indexOf(page)] : page.text)).join("\n");
  } finally {
    await pdf.close();
  }
}
