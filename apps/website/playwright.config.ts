import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1280, height: 900 },
    launchOptions: process.platform === "win32"
      ? { executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" } : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: "http://127.0.0.1:3000/en/",
    reuseExistingServer: !process.env.CI,
  },
});
