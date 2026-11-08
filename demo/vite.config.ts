import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  base: "/demos/shahnameh/",
  build: { outDir: "dist-demo", emptyOutDir: true, target: "es2020" },
  test: { include: ["test/**/*.test.ts"] },
} as any);
