import { test, expect } from "../support/fixtures"
import { stubCompanion } from "../support/areas/companion"

// "Add to board" in the top bar, with a stubbed companion server behind the page.

const TWO = "items=automation-science-pack:r:60,logistic-science-pack:r:30"
const RED_CHECK = '#board-checks .board-check[data-item="automation-science-pack"]'

test("the button opens a form prefilled from the plan's rate targets", async ({ calc, page }) => {
    await stubCompanion(page)
    await calc.open(TWO)
    let panel = page.locator("#board-panel")
    await expect(panel).toBeHidden()
    await page.locator("#board-button").click()
    await expect(panel).toBeVisible()
    await expect(page.locator("#board-title-input")).toHaveValue("60/min Automation science pack + 30/min Logistic science pack")
    await expect(page.locator("#board-column-select")).toHaveValue("backlog")
    await expect(page.locator("#board-column-select option")).toHaveText(["Backlog", "Next", "Doing", "Done"])
    await expect(page.locator("#board-checks .board-check")).toHaveText(["✓", "✓"])
    await expect(page.locator(RED_CHECK)).toHaveAttribute("data-checked", "1")
    await expect(page.locator(RED_CHECK)).toHaveAttribute("data-value", "60")
    await expect(page.locator("#board-checks .row > span:last-child")).toHaveText(["60/min Automation science pack", "30/min Logistic science pack"])
    let form = panel.locator(":scope > .deep")
    await expect(form).toHaveCSS("display", "flex")
    await expect(form).toHaveCSS("flex-direction", "column")
    await expect(form).toHaveCSS("gap", "6px")
    await expect(page.locator("#board-add-btn")).toHaveText("Add")
    await expect(page.locator("#board-add-btn")).toHaveClass(/\bbtn-green\b/)
    await expect(page.locator("#board-cancel-btn")).toHaveText("Cancel")
    await expect(page.locator("#board-result")).toHaveText("")
})

test("unchecking every target refuses to add", async ({ calc, page }) => {
    let stub = await stubCompanion(page)
    await calc.open("items=automation-science-pack:r:60")
    await page.locator("#board-button").click()
    await page.locator(RED_CHECK).click()
    await expect(page.locator(RED_CHECK)).toHaveAttribute("data-checked", "0")
    await expect(page.locator(RED_CHECK)).toHaveText("")
    await page.locator("#board-add-btn").click()
    await expect(page.locator("#board-result")).toHaveText("Check at least one target first.")
    expect(stub.cardBodies).toEqual([])
    await page.locator(RED_CHECK).click()
    await expect(page.locator(RED_CHECK)).toHaveAttribute("data-checked", "1")
    await expect(page.locator(RED_CHECK)).toHaveText("✓")
})

test("Add posts the card and links to the board", async ({ calc, page }) => {
    let stub = await stubCompanion(page)
    await calc.open(TWO)
    await page.locator("#board-button").click()
    await page.locator("#board-checks .board-check").nth(1).click()
    await page.locator("#board-title-input").fill("Red science line")
    await page.locator("#board-column-select").selectOption("next")
    await page.locator("#board-add-btn").click()
    await expect(page.locator("#board-result")).toHaveText("Added to Next — open board")
    let link = page.locator("#board-result a")
    await expect(link).toHaveAttribute("href", "/board/board.html")
    await expect(link).toHaveAttribute("target", "_blank")
    await expect(link).toHaveAttribute("rel", "noopener")
    expect(stub.cardBodies).toEqual([{
        title: "Red science line",
        column: "next",
        icon: "automation-science-pack",
        goals: [{ type: "rate", item: "automation-science-pack", target: 60 }],
        plan: await calc.hash(),
    }])
})

test("a refused card shows the server's reason", async ({ calc, page, pageErrors }) => {
    pageErrors.allow(/\/api\/board\/cards/)
    await stubCompanion(page, { boardStatus: 400, boardBody: { error: "Board is full" } })
    await calc.open("items=automation-science-pack:r:60")
    await page.locator("#board-button").click()
    await page.locator("#board-add-btn").click()
    await expect(page.locator("#board-result")).toHaveText("Board is full")
    await expect(page.locator("#board-result a")).toHaveCount(0)
})

test("Cancel and a second click on the button close the panel; reopening starts afresh", async ({ calc, page }) => {
    await stubCompanion(page)
    await calc.open("items=automation-science-pack:r:60")
    let panel = page.locator("#board-panel")
    await page.locator("#board-button").click()
    await page.locator("#board-title-input").fill("Edited")
    await page.locator("#board-cancel-btn").click()
    await expect(panel).toBeHidden()
    await page.locator("#board-button").click()
    await expect(panel).toBeVisible()
    await expect(page.locator("#board-title-input")).toHaveValue("60/min Automation science pack")
    await page.locator("#board-button").click()
    await expect(panel).toBeHidden()
})

test("a plan with only machine-count targets has nothing to add", async ({ calc, page }) => {
    await stubCompanion(page)
    await calc.open("items=automation-science-pack:f:2")
    await page.locator("#board-button").click()
    let note = page.locator("#board-panel > #board-note")
    await expect(note).toHaveText("Set at least one rate target first.")
    await expect(note).toHaveClass("deep muted")
    await expect(page.locator("#board-title-input")).toHaveCount(0)
})
