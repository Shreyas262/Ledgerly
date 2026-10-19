import type { TDocumentDefinitions } from "pdfmake/interfaces";
// The two Roboto weights the reports use; Roboto has the rupee sign. Served as
// hashed assets and fetched only when a PDF is first created.
import regularFont from "pdfmake/build/fonts/Roboto/Roboto-Regular.ttf?url";
import mediumFont from "pdfmake/build/fonts/Roboto/Roboto-Medium.ttf?url";

/**
 * Creates the PDF in the browser and downloads it. pdfmake is loaded on first
 * use, so it is not part of the main bundle.
 */
export async function downloadPdf(definition: TDocumentDefinitions, fileName: string): Promise<void> {
  // The browser build is a CommonJS module exporting one object.
  const { default: pdfMake } = await import("pdfmake/build/pdfmake");

  const origin = window.location.origin;
  const absolute = (url: string) => new URL(url, window.location.href).href;
  pdfMake.setFonts({
    Roboto: {
      normal: absolute(regularFont),
      bold: absolute(mediumFont),
      italics: absolute(regularFont),
      bolditalics: absolute(mediumFont),
    },
  });
  // Reports load nothing but the app's own fonts.
  pdfMake.setUrlAccessPolicy((url) => url.startsWith(`${origin}/`));

  await pdfMake.createPdf(definition).download(fileName);
}
