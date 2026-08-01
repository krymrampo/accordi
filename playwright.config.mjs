import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "browser-layout.spec.mjs",
  fullyParallel: false,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4186",
    headless: true,
  },
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4186",
    url: "http://127.0.0.1:4186",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
