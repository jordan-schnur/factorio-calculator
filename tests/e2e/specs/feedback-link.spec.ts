import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { openFeedback } from "../support/areas/feedback"

test("the footer shows a Feedback link", async ({ calc, page }) => {
    await calc.open("items=")
    let link = page.locator(S.feedbackLink)
    await expect(link).toBeVisible()
    await expect(link).toHaveAttribute("href", /template=feedback\.yml/)
})

test("clicking it opens a pre-filled issue with the live plan and version", async ({ calc, page }) => {
    await calc.open("items=automation-science-pack:r:60")
    let planUrl = page.url()
    let url = await openFeedback(page)

    expect(url.searchParams.get("template")).toBe("feedback.yml")
    expect(url.searchParams.get("plan")).toBe(planUrl)
    expect(url.searchParams.get("version")).not.toBeNull()
})

test("a plan link over GitHub's URL limit is dropped, not truncated into garbage", async ({ calc, page }) => {
    // Random, not repeated, so the page's own zip= compression can't shrink it back under the limit.
    let noise = Array.from({ length: 6000 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 62)]).join("")
    await calc.open(`title=${noise}&items=automation-science-pack:r:60`)
    expect(encodeURIComponent(page.url()).length).toBeGreaterThan(6000)
    let url = await openFeedback(page)

    expect(url.searchParams.get("template")).toBe("feedback.yml")
    expect(url.searchParams.has("plan")).toBe(false)
    expect(url.searchParams.get("version")).not.toBeNull()
})
