import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { openFeedback, openFeedbackViaKeyboard, xorshiftNoise } from "../support/areas/feedback"

test("the footer shows a Feedback link", async ({ calc, page }) => {
    await calc.open("items=")
    let link = page.locator(S.feedbackLink)
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute("href", /template=feedback\.yml/)
})

test("clicking it opens a pre-filled issue with the live plan and version, under GitHub's URL limit", async ({ calc, page }) => {
    await calc.open("items=automation-science-pack:r:60")
    let planUrl = page.url()
    expect(encodeURIComponent(planUrl).length).toBeLessThan(6000)
    let url = await openFeedback(page)

    expect(url.searchParams.get("template")).toBe("feedback.yml")
    expect(url.searchParams.get("plan")).toBe(planUrl)
    expect(url.searchParams.get("version")).not.toBeNull()
})

test("pressing Enter on the focused link opens the same pre-filled issue", async ({ calc, page }) => {
    await calc.open("items=automation-science-pack:r:60")
    let planUrl = page.url()
    let url = await openFeedbackViaKeyboard(page)

    expect(url.searchParams.get("plan")).toBe(planUrl)
    expect(url.searchParams.get("version")).not.toBeNull()
})

test("a plan link over GitHub's URL limit is dropped, not truncated into garbage", async ({ calc, page }) => {
    // Deterministic noise: xorshift32 output doesn't shrink under the page's own zip= deflate, unlike a repeated or low-entropy string.
    let noise = xorshiftNoise(7300)
    await calc.open(`title=${noise}&items=automation-science-pack:r:60`)
    expect(encodeURIComponent(page.url()).length).toBeGreaterThan(7000)
    let url = await openFeedback(page)

    expect(url.searchParams.get("template")).toBe("feedback.yml")
    expect(url.searchParams.has("plan")).toBe(false)
    expect(url.searchParams.get("version")).not.toBeNull()
})
