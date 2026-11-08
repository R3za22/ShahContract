import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:4173", browserName: "chromium" },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --config demo/vite.config.ts --port 4173 --strictPort",
    cwd: "..",
    url: "http://localhost:4173/demos/shahnameh/",
    reuseExistingServer: false,
  },
});
