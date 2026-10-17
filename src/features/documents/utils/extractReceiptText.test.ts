import { beforeEach, describe, expect, it, vi } from "vitest";

import { readImages } from "./imageReader";
import { readPdf, type PdfPage } from "./pdfReader";
import { extractReceiptText } from "./extractReceiptText";

// The readers run PDF.js and Tesseract in browser workers; here only the choice between them is tested.
vi.mock("./pdfReader", () => ({ readPdf: vi.fn() }));
vi.mock("./imageReader", () => ({ readImages: vi.fn() }));

const pdfFile = new File(["%PDF"], "bill.pdf", { type: "application/pdf" });
const imageFile = new File(["png"], "photo.png", { type: "image/png" });

function givenPdf(pages: PdfPage[]) {
  const close = vi.fn().mockResolvedValue(undefined);
  vi.mocked(readPdf).mockResolvedValue({ pages, close });
  return close;
}

const textPage = (text: string): PdfPage => ({ text, render: vi.fn() });

describe("extractReceiptText", () => {
  beforeEach(() => {
    vi.mocked(readImages).mockReset();
    vi.mocked(readPdf).mockReset();
  });

  it("reads a PDF's own text without OCR and closes it", async () => {
    const close = givenPdf([textPage("Cafe Coffee Day\nGrand Total 609.00")]);
    const progress = vi.fn();

    await expect(extractReceiptText(pdfFile, progress)).resolves.toBe("Cafe Coffee Day\nGrand Total 609.00");

    expect(readPdf).toHaveBeenCalledWith(pdfFile, 2);
    expect(readImages).not.toHaveBeenCalled();
    expect(progress).toHaveBeenLastCalledWith(1);
    expect(close).toHaveBeenCalled();
  });

  it("reads scanned PDF pages with OCR and keeps the page order", async () => {
    const canvas = {} as HTMLCanvasElement;
    const scanned: PdfPage = { text: " ", render: vi.fn().mockResolvedValue(canvas) };
    givenPdf([scanned, textPage("Terms and conditions apply to this purchase.")]);
    vi.mocked(readImages).mockResolvedValue(["Grand Total 1,180.00"]);

    await expect(extractReceiptText(pdfFile)).resolves.toBe("Grand Total 1,180.00\nTerms and conditions apply to this purchase.");

    expect(readImages).toHaveBeenCalledWith([canvas], expect.any(Function));
  });

  it("closes the PDF when OCR fails", async () => {
    const close = givenPdf([{ text: "", render: vi.fn().mockResolvedValue({}) }]);
    vi.mocked(readImages).mockRejectedValue(new Error("OCR failed"));

    await expect(extractReceiptText(pdfFile)).rejects.toThrow("OCR failed");
    expect(close).toHaveBeenCalled();
  });

  it("reads images with OCR", async () => {
    vi.mocked(readImages).mockResolvedValue(["Total 250.00"]);
    const progress = vi.fn();

    await expect(extractReceiptText(imageFile, progress)).resolves.toBe("Total 250.00");

    expect(readImages).toHaveBeenCalledWith([imageFile], progress);
    expect(readPdf).not.toHaveBeenCalled();
  });
});
