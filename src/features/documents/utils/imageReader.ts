import { createWorker, OEM } from "tesseract.js";
import tesseractWorkerUrl from "tesseract.js/dist/worker.min.js?url";
// The SIMD build runs in every browser the app supports; only the LSTM engine is used.
import tesseractCoreUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url";

/** Folder holding `eng.traineddata.gz`, served by the `ocrLanguageData` plugin in vite.config.ts. */
const OCR_LANGUAGE_PATH = `${import.meta.env.BASE_URL}ocr/eng-4.0.0_best_int`;

/** Longest side, in pixels, an image is scaled down to before OCR. */
const MAX_IMAGE_SIDE = 2000;

const absolute = (url: string) => new URL(url, window.location.href).href;

/** Scales large photos down: OCR time grows with pixels, accuracy does not. */
async function prepare(image: Blob | HTMLCanvasElement): Promise<Blob | HTMLCanvasElement> {
  if (image instanceof HTMLCanvasElement) return image;
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) {
    bitmap.close();
    return image;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/**
 * Reads the text of images with Tesseract in a web worker, so the page stays
 * responsive. All files are served by the app itself and cached by the
 * browser, so no third-party service is contacted. The worker is shut down
 * afterwards to free its memory.
 */
export async function readImages(
  images: (Blob | HTMLCanvasElement)[],
  onProgress: (fraction: number) => void,
): Promise<string[]> {
  let current = 0;
  const worker = await createWorker("eng", OEM.LSTM_ONLY, {
    workerPath: absolute(tesseractWorkerUrl),
    corePath: absolute(tesseractCoreUrl),
    langPath: absolute(OCR_LANGUAGE_PATH),
    workerBlobURL: false,
    // The language data comes from the browser's HTTP cache; nothing is kept in IndexedDB.
    cacheMethod: "none",
    // Failures already reject the pending call; without a handler Tesseract also throws them uncaught.
    errorHandler: () => {},
    logger: (message) => {
      if (message.status === "recognizing text") onProgress((current + message.progress) / images.length);
    },
  });

  try {
    const texts: string[] = [];
    for (const image of images) {
      const { data } = await worker.recognize(await prepare(image));
      texts.push(data.text);
      current += 1;
    }
    return texts;
  } finally {
    await worker.terminate();
  }
}
