// The Inputs frame (#inputs): what must be fed in (supplied-from-elsewhere
// items), what is mined here, and the whole-factory power/building totals.
// Reuses table.js's row shape and totals helpers so this frame and the
// Factory table never disagree about what counts as "supplied"/"mined" or
// how many buildings a row needs.
import { spec } from "./factory.js"
import { zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { buildingCount, buildRows, powerRepr } from "./table.js"
import { laneNote, machineSummary, RATE_LABEL } from "./table-core.js"

function laneLine(row) {
    if (row.item.phase === "fluid") {
        return null
    }
    const belts = spec.getBeltCount(row.itemRate)
    return `${belts.toDecimal(2)} belts · ${laneNote(belts.toFloat())}`
}

function inputRow(row, note) {
    const div = document.createElement("div")
    div.className = "row"

    const slot = document.createElement("span")
    slot.className = "slot"
    slot.appendChild(row.item.icon.make(28, true))
    div.appendChild(slot)

    const mid = document.createElement("span")
    mid.style.flex = "1"
    mid.appendChild(document.createTextNode(row.name))
    if (note) {
        mid.appendChild(document.createElement("br"))
        const noteSpan = document.createElement("span")
        noteSpan.className = "muted"
        noteSpan.style.fontSize = "13px"
        noteSpan.textContent = note
        mid.appendChild(noteSpan)
    }
    div.appendChild(mid)

    const num = document.createElement("span")
    num.className = "num"
    num.style.fontSize = "20px"
    const rateText = spec.format.rate(row.itemRate)
    num.dataset.value = rateText
    num.textContent = rateText
    div.appendChild(num)

    const unit = document.createElement("span")
    unit.className = "muted"
    unit.textContent = RATE_LABEL[spec.format.rateName] || "/min"
    div.appendChild(unit)

    return div
}

// label: value, where value is either a bare number (numeric, gets class
// "num" and a data-value so the scratch pad can reuse it) or prose (power's
// "5.8 MW" -- not a bare number, so no "num" class and no data-value).
function kv(label, value, numeric) {
    const div = document.createElement("div")
    div.className = "kv"
    const l = document.createElement("span")
    l.textContent = label
    div.appendChild(l)
    const v = document.createElement("span")
    v.style.marginLeft = "auto"
    if (numeric !== undefined) {
        v.className = "num"
        v.dataset.value = String(numeric)
    }
    v.textContent = value
    div.appendChild(v)
    return div
}

function sec(text) {
    const div = document.createElement("div")
    div.className = "sec"
    div.textContent = text
    return div
}

function renderInputs(spec, totals) {
    const container = document.getElementById("inputs")
    if (!container) {
        return
    }
    container.innerHTML = ""

    const rows = buildRows(totals)
    const supplied = rows.filter(r => !r.isReal)
    const mined = rows.filter(r => r.isReal && r.isResource)

    if (supplied.length === 0) {
        const empty = document.createElement("div")
        empty.className = "muted"
        empty.style.fontSize = "13px"
        empty.style.padding = "2px 6px"
        empty.textContent = "Nothing supplied from elsewhere yet."
        container.appendChild(empty)
    } else {
        for (const row of supplied) {
            container.appendChild(inputRow(row, laneLine(row)))
        }
    }

    if (mined.length) {
        container.appendChild(sec("Mined here"))
        for (const row of mined) {
            const building = spec.getBuilding(row.recipe)
            const note = building ? `${buildingCount(row)} ${building.name.toLowerCase()}` : null
            container.appendChild(inputRow(row, note))
        }
    }

    container.appendChild(sec("Totals"))
    let totalBuildings = 0
    let totalPower = zero
    const counts = []
    for (const row of rows) {
        if (!row.isReal) {
            continue
        }
        const building = spec.getBuilding(row.recipe)
        if (building === null) {
            continue
        }
        const count = buildingCount(row)
        totalBuildings += count
        totalPower = totalPower.add(spec.getPowerUsage(row.recipe, row.recipeRate).power)
        counts.push({ building: building.key, count })
    }
    container.appendChild(kv("Power", powerRepr(totalPower)))
    container.appendChild(kv("Buildings", String(totalBuildings), totalBuildings))

    const summary = document.createElement("div")
    summary.className = "kv"
    const summarySpan = document.createElement("span")
    summarySpan.className = "muted"
    summarySpan.style.fontSize = "13px"
    summarySpan.textContent = machineSummary(counts)
    summary.appendChild(summarySpan)
    container.appendChild(summary)
}

export function initInputs() {
    registerRenderer(renderInputs)
}
