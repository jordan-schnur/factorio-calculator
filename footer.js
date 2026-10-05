// calc/footer.js — the bottom bar: whole-factory machine/power totals
// (#footer-totals) and a summary of what's brought in from elsewhere
// (#footer-bring), replacing the old bring-in bar, and what is sent out on
// purpose (#footer-sendout, the Byproducts bar's "Send out" fix). With
// modules anywhere in the plan, #footer-bare says what the same plan needs
// without them, from a second solve (spec.withoutModules) run just after
// the page draws.
import { sentOut } from "./byproduct-core.js"
import { spec } from "./factory.js"
import { zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { RATE_LABEL } from "./table-core.js"
import { buildingCount, buildRows, powerRepr } from "./table.js"

function formatRate(rate) {
    return `${spec.format.rate(rate)}${RATE_LABEL[spec.format.rateName] || "/min"}`
}

// Machines and power of every row of `totals`, as the spec counts them now.
function tally(totals) {
    let machines = 0
    let power = zero
    for (let row of buildRows(totals)) {
        if (!row.isReal) {
            continue
        }
        machines += buildingCount(row)
        power = power.add(spec.getPowerUsage(row.recipe, row.recipeRate).power)
    }
    return {machines, power}
}

function tallyWords({machines, power}) {
    return `${machines} machines · ${powerRepr(power)}`
}

function hasModules() {
    for (let m of spec.spec.values()) {
        if (m.modules.some(Boolean)) return true
        if (m.beaconModules.some(Boolean) && !m.beaconCount.isZero()) return true
    }
    return false
}

// The bare solve takes a few milliseconds, so it runs after the page draws;
// a newer render (generation) drops a pending one. Cached per solution and
// module edit: machine quality, which counts here too, goes through
// commitModules and so bumps modulesVersion.
let bareGeneration = 0
let bareKey = null
let bareTally = null

function renderBare(span, totals, withModules) {
    let mine = ++bareGeneration
    if (!hasModules()) {
        span.hidden = true
        return
    }
    let show = bare => {
        let same = bare.machines === withModules.machines && bare.power.equal(withModules.power)
        span.textContent = same ? "" : `Without modules: ${tallyWords(bare)}`
        span.hidden = same
    }
    if (bareKey && bareKey.totals === totals && bareKey.version === spec.modulesVersion) {
        show(bareTally)
        return
    }
    span.hidden = true
    setTimeout(() => {
        if (mine !== bareGeneration || spec.lastTotals !== totals) return
        bareTally = spec.withoutModules(() => tally(spec.solve()))
        bareKey = {totals, version: spec.modulesVersion}
        show(bareTally)
    }, 0)
}

function renderFooter(spec, totals) {
    let totalsSpan = document.getElementById("footer-totals")
    let bringSpan = document.getElementById("footer-bring")
    let sendOutSpan = document.getElementById("footer-sendout")
    let bareSpan = document.getElementById("footer-bare")
    if (!totalsSpan && !bringSpan) {
        return
    }
    if (!totals || spec.buildTargets.length === 0) {
        bareGeneration++
        if (bareSpan) bareSpan.hidden = true
        if (totalsSpan) totalsSpan.textContent = ""
        if (bringSpan) bringSpan.textContent = ""
        if (sendOutSpan) sendOutSpan.hidden = true
        return
    }

    let rows = buildRows(totals)
    let withModules = tally(totals)
    if (totalsSpan) {
        totalsSpan.textContent = tallyWords(withModules)
    }
    if (bareSpan) {
        renderBare(bareSpan, totals, withModules)
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
