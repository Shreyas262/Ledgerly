import { useState } from "react";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

import { downloadPdf } from "./downloadPdf";

/**
 * Creates and downloads a PDF report. `build` may first load what the report
 * needs; while it runs `isCreating` is true, and a failure is kept in `error`.
 */
export function usePdfDownload() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const download = async (build: () => TDocumentDefinitions | Promise<TDocumentDefinitions>, fileName: string) => {
    setIsCreating(true);
    setError(null);
    try {
      await downloadPdf(await build(), fileName);
    } catch (failure) {
      setError(failure);
    } finally {
      setIsCreating(false);
    }
  };

  return { download, isCreating, error, clearError: () => setError(null) };
}
