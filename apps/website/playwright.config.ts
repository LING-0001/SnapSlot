import { defineConfig } from "@playwright/test";

const baseURL = process.env.SNAPSLOT_TEST_URL || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    launchOptions: process.platform === "win32"
      ? { executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" } : process.platform === "darwin" ? { channel: "chrome" } : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3000",
    url: `${baseURL}/en/`,
    reuseExistingServer: !process.env.CI,
  },
});
