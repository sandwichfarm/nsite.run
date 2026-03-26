import { defineConfig } from "vite";
import cssnano from "cssnano";

export default defineConfig({
  css: {
    postcss: {
      plugins: [cssnano()],
    },
  },
  build: {
    lib: {
      entry: "src/index.ts",
      name: "stealthis",
      formats: ["iife", "es"],
      fileName: (format) =>
        format === "es" ? "stealthis.mjs" : "stealthis.js",
    },
    outDir: "dist",
  },
});
