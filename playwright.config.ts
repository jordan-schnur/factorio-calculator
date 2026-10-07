import { defineConfig, devices } from "@playwright/test"

// The end-to-end suite is the behaviour contract for the calculator: it
// drives the page only as a player would (URL fragments, clicks, typing)
// and reads back what the page shows, so it should pass unchanged against
// a rewrite in any framework. Point it at another build with
//   CALC_BASE_URL=http://127.0.0.1:5173 CALC_PAGE=/ npx playwright test
// (CALC_BASE_URL skips the built-in static server).
const PORT = Number(process.env.CALC_PORT || 4173)
// Not 127.0.0.1 on Linux: under WSL's mirrored networking a connection to
// an unbound 127.0.0.1 port hangs instead of being refused, and Playwright's
// "is the server up yet" probe then never returns. All of 127/8 is loopback
// on Linux; macOS only answers on 127.0.0.1.
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
            // Anti-aliasing noise only; a moved element or changed colour
            // is well past this.
            maxDiffPixelRatio: 0.002,
            animations: "disabled",
            caret: "hide",
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
        command: `python3 -m http.server ${PORT} --bind ${HOST}`,
        url: `${BASE_URL}/calc.html`,
        reuseExistingServer: true,
        stdout: "ignore",
        stderr: "ignore",
    },
})
