import { defineConfig, devices } from "@playwright/test"

// The behaviour contract; CALC_BASE_URL (and CALC_PAGE) point it at a running build instead of dist/.
const PORT = Number(process.env.CALC_PORT || 4173)
// 127.0.0.2 on Linux: WSL's mirrored networking hangs on an unbound 127.0.0.1 port.
const HOST = process.env.CALC_HOST || (process.platform === "linux" ? "127.0.0.2" : "127.0.0.1")
const BASE_URL = process.env.CALC_BASE_URL || `http://${HOST}:${PORT}`

export default defineConfig({
    testDir: "tests/e2e/specs",
    snapshotPathTemplate: "tests/e2e/__snapshots__/{testFilePath}/{arg}{-projectName}{ext}",
    outputDir: "test-results",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: process.env.CI ? 2 : undefined,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
    timeout: 30_000,
    expect: {
        timeout: 10_000,
        toHaveScreenshot: {
            // Anti-aliasing noise only.
            maxDiffPixelRatio: 0.002,
            animations: "disabled",
            caret: "hide",
            stylePath: "tests/e2e/fixtures/screenshot.css",
        },
    },
    use: {
        baseURL: BASE_URL,
        locale: "en-US",
        timezoneId: "America/New_York",
        colorScheme: "dark",
        reducedMotion: "reduce",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: [
        {
            name: "desktop",
            use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
        },
        {
            // Only specs tagged @mobile run here.
            name: "mobile",
            grep: /@mobile/,
            use: { ...devices["Pixel 7"] },
        },
    ],
    webServer: process.env.CALC_BASE_URL ? undefined : {
        command: `npm run build && node tests/e2e/support/serve.mjs ${PORT} ${HOST} dist`,
        timeout: 180_000,
        url: `${BASE_URL}/calc.html`,
        reuseExistingServer: true,
        stdout: "ignore",
        stderr: "ignore",
    },
})
