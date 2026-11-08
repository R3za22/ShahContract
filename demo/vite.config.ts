import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  base: "/demos/shahnameh/",
  esbuild: { jsx: "automatic", jsxImportSource: "preact" },
  build: { outDir: "dist-demo", emptyOutDir: true, target: "es2022" },
  test: { include: ["test/**/*.test.ts"] },
} as any);
