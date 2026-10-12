import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { openFeedback, stubFeedback, stubFeedbackNetworkError } from "../support/areas/feedback"
import { openOnPublicHost } from "../support/areas/analytics"

test("clicking Feedback opens the dialog", async ({ calc, page }) => {
    await calc.open("items=")
    stubFeedback(page, 201, { number: 1, url: "https://github.com/x/x/issues/1" })
    await openFeedback(page)
    let dialog = page.locator(S.feedbackDialog)
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute("aria-labelledby", "feedback-heading")
})

test("Send posts the message, contact, plan and version as JSON", async ({ page, baseURL, pageErrors }) => {
    let requests = stubFeedback(page, 201, { number: 42, url: "https://github.com/x/x/issues/42" })
    await openOnPublicHost(page, baseURL!, pageErrors)
    await openFeedback(page)
    await page.locator(S.feedbackMessage).fill("The belts look wrong")
    await page.locator(S.feedbackContact).fill("me@example.com")
    await page.locator(S.feedbackSend).click()
    await expect(page.locator(S.feedbackThanks)).toBeVisible()
    expect(requests).toHaveLength(1)
    let body = requests[0].postDataJSON()
    expect(body.message).toBe("The belts look wrong")
    expect(body.contact).toBe("me@example.com")
    expect(body.plan).toMatch(/^https:\/\/factoriocalculator\.app\//)
    expect(body.version).toBeTruthy()
    expect(body.website).toBe("")
})

test("a successful send shows the issue link", async ({ calc, page }) => {
    await calc.open("items=")
    stubFeedback(page, 201, { number: 7, url: "https://github.com/x/x/issues/7" })
    await openFeedback(page)
    await page.locator(S.feedbackMessage).fill("Hello")
    await page.locator(S.feedbackSend).click()
    await expect(page.locator(S.feedbackThanks)).toHaveText("Thanks, filed as #7")
    let link = page.locator(`${S.feedbackThanks} a`)
    await expect(link).toHaveAttribute("href", "https://github.com/x/x/issues/7")
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", "noopener")
})

test("a null issue number still shows thanks", async ({ calc, page }) => {
    await calc.open("items=")
    stubFeedback(page, 201, { number: null, url: null })
    await openFeedback(page)
    await page.locator(S.feedbackMessage).fill("Hello")
    await page.locator(S.feedbackSend).click()
    await expect(page.locator(S.feedbackThanks)).toHaveText("Thanks!")
})

test("a failed send shows the error, keeps the message and offers Copy message", async ({ calc, page, context, pageErrors }) => {
    await calc.open("items=")
    // Chromium logs failed resource loads to the console regardless of fetch() handling the rejection.
    pageErrors.allow(/feedback\.test/)
    stubFeedback(page, 502, { error: "boom" })
    await context.grantPermissions(["clipboard-read", "clipboard-write"])
    await openFeedback(page)
    await page.locator(S.feedbackMessage).fill("It broke")
    await page.locator(S.feedbackSend).click()
    await expect(page.locator(S.feedbackError)).toBeVisible()
    await expect(page.locator(S.feedbackMessage)).toHaveValue("It broke")
    await page.locator(S.feedbackCopy).click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("It broke")
})

test("a network failure is also an error", async ({ calc, page, pageErrors }) => {
    await calc.open("items=")
    pageErrors.allow(/feedback\.test/)
    stubFeedbackNetworkError(page)
    await openFeedback(page)
    await page.locator(S.feedbackMessage).fill("It broke")
    await page.locator(S.feedbackSend).click()
    await expect(page.locator(S.feedbackError)).toBeVisible()
})

test("Send stays disabled until there is a message", async ({ calc, page }) => {
    await calc.open("items=")
    await openFeedback(page)
    await expect(page.locator(S.feedbackSend)).toBeDisabled()
    await page.locator(S.feedbackMessage).fill("Hi")
    await expect(page.locator(S.feedbackSend)).toBeEnabled()
})

test("Escape closes the dialog", async ({ calc, page }) => {
    await calc.open("items=")
    await openFeedback(page)
    await expect(page.locator(S.feedbackDialog)).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.locator(S.feedbackDialog)).toBeHidden()
})

test("fits at 360px without sideways scroll @mobile", async ({ calc, page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await calc.open("items=")
    await openFeedback(page)
    let { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    expect(scroll).toBeLessThanOrEqual(client)
})
