// The Inputs frame (#inputs): what must be fed in (supplied-from-elsewhere
// items), what is mined here, and the whole-factory power/building totals.
// Reuses table.js's row shape so this frame and the Factory table never
// disagree about what counts as "supplied" or "mined".
import { spec } from "./factory.js"
import { zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { buildRows, powerRepr } from "./table.js"
import { laneNote, machineSummary } from "./table-core.js"

const RATE_LABEL = { s: "/s", m: "/min", h: "/h" }

function displayedRate(rate) {
    return rate.mul(spec.format.rateFactor).toFloat()
}

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
    num.dataset.value = displayedRate(row.itemRate)
    num.textContent = spec.format.rate(row.itemRate)
    div.appendChild(num)

    const unit = document.createElement("span")
    unit.className = "muted"
    unit.textContent = RATE_LABEL[spec.format.rateName] || "/min"
    div.appendChild(unit)

    return div
}

function kv(label, value) {
    const div = document.createElement("div")
    div.className = "kv"
    const l = document.createElement("span")
    l.textContent = label
    div.appendChild(l)
    const v = document.createElement("span")
    v.className = "num"
    v.style.marginLeft = "auto"
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
            const count = Math.ceil(spec.getCount(row.recipe, row.recipeRate).toFloat())
            const note = building ? `${count} ${building.name.toLowerCase()}` : null
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
        const count = Math.ceil(spec.getCount(row.recipe, row.recipeRate).toFloat())
        totalBuildings += count
        totalPower = totalPower.add(spec.getPowerUsage(row.recipe, row.recipeRate).power)
        counts.push({ building: building.key, count })
    }
    container.appendChild(kv("Power", powerRepr(totalPower)))
    container.appendChild(kv("Buildings", String(totalBuildings)))

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
