import { test, expect } from "../support/fixtures"
import { S } from "../support/selectors"
import { TD, hoverLines, unhover } from "../support/areas/table-details"

// Hover cards on a rate: belts, the machines that make it, and (for the
// table's own Need column) a breakdown per destination.

const F60 = "items=military-science-pack:r:60&ignore=steel-plate"

test("hovering a Goes to rate in an open row shows belts, a maker and a user", async ({ calc }) => {
    await calc.open(F60)
    let detail = await calc.openRow("iron-plate")
    let lines = await hoverLines(calc.page, detail.locator(TD.goesToCol + " " + TD.flowNum).first())
    expect(lines[0]).toMatch(/^[\d./ ]+ [a-z ]*belts?$/)
    expect(lines.some(l => /^Made by [\d.]+ of the [\d.]+ .+ on Iron plate$/.test(l))).toBe(true)
    expect(lines.some(l => l.startsWith("Used by ") && l.includes(" on "))).toBe(true)
})

test("pins the exact Goes to hover card for a known plan", async ({ calc }) => {
    await calc.open(F60)
    let detail = await calc.openRow("iron-plate")
    let lines = await hoverLines(calc.page, detail.locator(TD.goesToCol + " " + TD.flowNum).first())
    expect(lines).toEqual([
        "1/6 transport belt",
        "Made by 4 of the 7.2 electric furnaces on Iron plate",
        "Used by 8 assembling machines 1 on Grenade",
    ])
})

test("hovering the table's own Need rate shows the same breakdown, without opening the row", async ({ calc }) => {
    await calc.open(F60)
    let need = calc.row("iron-plate").locator(S.rowNeed)
    let lines = await hoverLines(calc.page, need)
    expect(lines[0]).toBe("3/10 transport belt")
    expect(lines).toContain("Goes to")
    await expect(calc.row("iron-plate")).not.toHaveClass(/\bopen\b/)
})

test("hovering a table need rate splits its machines per destination (fluid, Space Age)", async ({ calc }) => {
    await calc.open("items=lubricant:r:600,plastic-bar:r:1200&planet=vulcanus")
    let out = calc.row("heavy-oil").locator('[data-output="heavy-oil"]')
    let lines = await hoverLines(calc.page, out)
    expect(lines[0]).toBe("Fluid, by pipe")
    expect(lines.some(l => /^Made by [\d.]+ oil refineries on Coal liquefaction$/.test(l))).toBe(true)
    expect(lines.some(l => l.startsWith("Heavy oil cracking to light oil · "))).toBe(true)
    expect(lines.some(l => /^[\d.]+ oil refineries feed [\d.]+ chemical plants$/.test(l))).toBe(true)
    expect(lines.some(l => l.startsWith("Lubricant · "))).toBe(true)
})

test("leaving the rate hides the card", async ({ calc }) => {
    await calc.open(F60)
    await hoverLines(calc.page, calc.row("iron-plate").locator(S.rowNeed))
    await unhover(calc.page)
})
