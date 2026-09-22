import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

import { version } from "./package.json";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  // @req REQ-2026-007: package.json is the sole version source.
  define: { __APP_VERSION__: JSON.stringify(version) },
  base: "./",
});
