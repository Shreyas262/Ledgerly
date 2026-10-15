import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      setupFiles: ["./src/test/setup.ts"],
      restoreMocks: true,
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            environment: "node",
            include: ["src/**/*.test.ts"],
            exclude: ["src/mocks/handler/**"],
          },
        },
        {
          // Handlers register relative "/api/*" paths, which MSW resolves
          // against the page origin, so API tests need a document location.
          extends: true,
          test: {
            name: "api",
            environment: "jsdom",
            include: ["src/mocks/handler/**/*.test.ts"],
          },
        },
        {
          extends: true,
          test: {
            name: "dom",
            environment: "jsdom",
            include: ["src/**/*.test.tsx"],
          },
        },
      ],
    },
  }),
);
