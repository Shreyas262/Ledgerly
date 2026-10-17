import { createReadStream, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, type Plugin } from 'vite'

/**
 * Serves Tesseract's English language data at a fixed, versioned path
 * (`OCR_LANGUAGE_PATH` in src/features/documents/utils/imageReader.ts).
 * Tesseract loads it from a folder by its file name, so it cannot be a
 * content-hashed asset like the other OCR files.
 */
function ocrLanguageData(): Plugin {
  const fileName = 'ocr/eng-4.0.0_best_int/eng.traineddata.gz'
  const source = fileURLToPath(
    new URL('./node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', import.meta.url),
  )
  return {
    name: 'ocr-language-data',
    configureServer(server) {
      server.middlewares.use(`/${fileName}`, (_request, response) => {
        response.setHeader('Content-Type', 'application/octet-stream')
        createReadStream(source).pipe(response)
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName, source: readFileSync(source) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    ocrLanguageData(),
  ],
})
