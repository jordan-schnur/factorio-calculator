// calc/bringin.js — the bottom bar (#bringin-bar): one chip per item the
// factory brings in (supplied-from-elsewhere, then mined here) and the
// whole-factory machine/power totals, replacing the Inputs frame.
import { spec } from "./factory.js"
import { zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { RATE_LABEL } from "./table-core.js"
import { buildingCount, buildRows, powerRepr } from "./table.js"

const HINT = "Scroll to zoom, drag to pan, Fit resets. Click a node for details. The − on a node folds everything to its left into one line."

function formatRate(rate) {
    return `${spec.format.rate(rate)}${RATE_LABEL[spec.format.rateName] || "/min"}`
}

function chip(item, rate) {
    let span = document.createElement("span")
    span.className = "chip"

    let slot = document.createElement("span")
    slot.className = "slot slot-sm"
    slot.appendChild(item.icon.make(20, true))
    span.appendChild(slot)

    span.appendChild(document.createTextNode(item.name + " "))

    let num = document.createElement("b")
    num.className = "num"
    let text = formatRate(rate)
    num.dataset.value = text
    num.textContent = text
    span.appendChild(num)

    return span
}

function renderBringin(spec, totals) {
    let bar = document.getElementById("bringin-bar")
    if (!bar) {
        return
    }
    bar.textContent = ""
    if (!totals || spec.buildTargets.length === 0) {
        bar.hidden = true
        return
    }
    bar.hidden = false

    let rows = buildRows(totals)
    let supplied = rows.filter(r => !r.isReal)
    let mined = rows.filter(r => r.isReal && r.isResource)

    let line = document.createElement("div")
    line.style.cssText = "display: flex; align-items: center; gap: 8px; flex-wrap: wrap;"

    let label = document.createElement("span")
    label.className = "lbl"
    label.textContent = "Bring in"
    line.appendChild(label)

    for (let row of [...supplied, ...mined]) {
        line.appendChild(chip(row.item, row.itemRate))
    }

    let spacer = document.createElement("span")
    spacer.className = "spacer"
    line.appendChild(spacer)

    let totalBuildings = 0
    let totalPower = zero
    for (let row of rows) {
        if (!row.isReal) {
            continue
        }
        totalBuildings += buildingCount(row)
        totalPower = totalPower.add(spec.getPowerUsage(row.recipe, row.recipeRate).power)
    }
    let totalsSpan = document.createElement("span")
    totalsSpan.className = "num totals"
    totalsSpan.textContent = `${totalBuildings} machines · ${powerRepr(totalPower)}`
    line.appendChild(totalsSpan)

    bar.appendChild(line)

    let hint = document.createElement("span")
    hint.className = "muted hint"
    hint.textContent = HINT
    bar.appendChild(hint)
}

export function initBringin() {
    registerRenderer(renderBringin)
}
