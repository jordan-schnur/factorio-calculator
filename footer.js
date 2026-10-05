// calc/footer.js — the bottom bar: whole-factory machine/power totals
// (#footer-totals) and a summary of what's brought in from elsewhere
// (#footer-bring), replacing the old bring-in bar, and what is sent out on
// purpose (#footer-sendout, the Byproducts bar's "Send out" fix).
import { sentOut } from "./byproduct-core.js"
import { spec } from "./factory.js"
import { zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { RATE_LABEL } from "./table-core.js"
import { buildingCount, buildRows, powerRepr } from "./table.js"

function formatRate(rate) {
    return `${spec.format.rate(rate)}${RATE_LABEL[spec.format.rateName] || "/min"}`
}

function renderFooter(spec, totals) {
    let totalsSpan = document.getElementById("footer-totals")
    let bringSpan = document.getElementById("footer-bring")
    let sendOutSpan = document.getElementById("footer-sendout")
    if (!totalsSpan && !bringSpan) {
        return
    }
    if (!totals || spec.buildTargets.length === 0) {
        if (totalsSpan) totalsSpan.textContent = ""
        if (bringSpan) bringSpan.textContent = ""
        if (sendOutSpan) sendOutSpan.hidden = true
        return
    }

    let rows = buildRows(totals)

    let totalBuildings = 0
    let totalPower = zero
    for (let row of rows) {
        if (!row.isReal) {
            continue
        }
        totalBuildings += buildingCount(row)
        totalPower = totalPower.add(spec.getPowerUsage(row.recipe, row.recipeRate).power)
    }
    if (totalsSpan) {
        totalsSpan.textContent = `${totalBuildings} machines · ${powerRepr(totalPower)}`
    }

    if (bringSpan) {
        let supplied = rows.filter(r => !r.isReal)
        if (supplied.length === 0) {
            bringSpan.textContent = "Everything is made here from raw ore, gas and water."
        } else {
            let parts = supplied.map(row => `${row.item.name.toLowerCase()} ${formatRate(row.itemRate)}`)
            bringSpan.textContent = "Brought in: " + parts.join(", ")
        }
    }

    if (sendOutSpan) {
        let parts = sentOut(totals, spec.sendOut).map(({item, rate}) => `${item.name.toLowerCase()} ${formatRate(rate)}`)
        sendOutSpan.textContent = parts.length ? "Sent out: " + parts.join(", ") : ""
        sendOutSpan.hidden = parts.length === 0
    }
}

export function initFooter() {
    registerRenderer(renderFooter)
}
