// calc/details.js — the per-node details card (#node-details): head (icon,
// rate, belts), the make-here/bring-in switch, the exact machine count, and
// the Needs/Goes-to ingredient and consumer lists. Rendered both as a normal
// renderer (registerRenderer) and directly off calc:select, since selecting
// a node from flow.js does not itself trigger a re-solve.
import { spec } from "./factory.js"
import { beltText } from "./flow-core.js"
import { one, Rational, zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { RATE_LABEL } from "./table-core.js"
import { buildingCount, buildRows } from "./table.js"

const HUNDRED = Rational.from_float(100)

// The "Goes to" share as a rounded percentage, with a floor of "<1%" so a
// real-but-tiny consumer never reads as a flat 0%.
function percentText(share) {
    let percent = share.mul(HUNDRED)
    if (percent.less(one)) {
        return "<1%"
    }
    return percent.toDecimal(0) + "%"
}

function rateText(rate) {
    return `${spec.format.rate(rate)}${RATE_LABEL[spec.format.rateName] || "/min"}`
}

// data-value must be the exact decimal text on screen, not the raw
// per-second Rational -- the scratch pad inserts it verbatim.
function numSpan(text, extraClass) {
    let span = document.createElement("span")
    span.className = extraClass ? `num ${extraClass}` : "num"
    span.dataset.value = text
    span.textContent = text
    return span
}

// A "num" span with no data-value, for numbers that are not a rate or count
// the scratch pad should ever insert -- a percentage share evaluates to "?".
function plainNum(text) {
    let span = document.createElement("span")
    span.className = "num"
    span.textContent = text
    return span
}

function slot(icon, size) {
    let span = document.createElement("span")
    span.className = "slot"
    span.appendChild(icon.make(size, true))
    return span
}

function listRow(icon, name, ...trailing) {
    let row = document.createElement("div")
    row.className = "row"
    row.appendChild(slot(icon, 20))
    let nameSpan = document.createElement("span")
    nameSpan.style.flex = "1"
    nameSpan.textContent = name
    row.appendChild(nameSpan)
    for (let el of trailing) {
        row.appendChild(el)
    }
    return row
}

function lbl(text) {
    let span = document.createElement("span")
    span.className = "lbl"
    span.textContent = text
    return span
}

function list(rows, emptyText) {
    let div = document.createElement("div")
    div.className = "list"
    if (rows.length === 0) {
        let muted = document.createElement("span")
        muted.className = "muted"
        muted.textContent = emptyText
        div.appendChild(muted)
    } else {
        for (let row of rows) {
            div.appendChild(row)
        }
    }
    return div
}

function buildHead(item, rate) {
    let head = document.createElement("div")
    head.className = "head"
    head.style.cssText = "display: flex; align-items: center; gap: 10px;"
    head.appendChild(slot(item.icon, 32))

    let grow = document.createElement("span")
    grow.className = "grow"
    grow.style.flex = "1"
    let title = document.createElement("span")
    title.className = "title"
    title.textContent = item.name
    grow.appendChild(title)
    grow.appendChild(document.createElement("br"))
    let subtitle = document.createElement("span")
    subtitle.className = "muted num"
    let beltPart = item.phase === "fluid" ? "pipe" : beltText(spec.getBeltCount(rate).toFloat())
    subtitle.textContent = `${rateText(rate)} · ${beltPart}`
    grow.appendChild(subtitle)
    head.appendChild(grow)

    let close = document.createElement("button")
    close.type = "button"
    close.className = "x"
    close.id = "details-close"
    close.textContent = "✕"
    close.addEventListener("click", () => {
        spec.whereItem = null
        spec.setHash()
        document.dispatchEvent(new CustomEvent("calc:select", { detail: { item: null } }))
    })
    head.appendChild(close)

    return head
}

function buildSourceSeg(item, row) {
    let seg = document.createElement("span")
    seg.className = "seg source"
    let here = document.createElement("button")
    here.type = "button"
    here.textContent = "make here"
    let bringIn = document.createElement("button")
    bringIn.type = "button"
    bringIn.textContent = "bring in"

    let supplied = !row.isReal
    here.classList.toggle("on", !supplied)
    bringIn.classList.toggle("on", supplied)

    let toggle = () => document.dispatchEvent(new CustomEvent("calc:toggle-supplied", { detail: { item: item.key } }))
    here.addEventListener("click", () => { if (supplied) toggle() })
    bringIn.addEventListener("click", () => { if (!supplied) toggle() })

    seg.appendChild(here)
    seg.appendChild(bringIn)
    return seg
}

function buildMachinesLine(row) {
    let building = spec.getBuilding(row.recipe)
    if (building === null) {
        return null
    }
    let div = document.createElement("div")
    div.className = "machines num"
    div.appendChild(slot(building.icon, 24))
    let count = buildingCount(row)
    let exact = spec.getCount(row.recipe, row.recipeRate).toDecimal(1)
    div.appendChild(document.createTextNode(`${count} × ${building.name} `))
    let muted = document.createElement("span")
    muted.className = "muted"
    muted.textContent = `(${exact} exactly)`
    div.appendChild(muted)
    return div
}

function buildNeeds(row) {
    if (!row) {
        return list([], "Nothing needed.")
    }
    let rows = (row.recipe.ingredients || []).map(ing => {
        let amount = ing.amount.mul(row.recipeRate)
        return listRow(ing.item.icon, ing.item.name, numSpan(rateText(amount)))
    })
    return list(rows, "Nothing needed.")
}

function buildGoesTo(item, totals) {
    let totalRate = totals.items.get(item) || zero
    let consumers = [...(totals.consumers.get(item) || new Map())]
        .filter(([recipe]) => recipe.isReal())
        .sort((a, b) => b[1].toFloat() - a[1].toFloat())
    let rows = consumers.map(([recipe, rate]) => {
        let product = recipe.products[0].item
        let share = totalRate.isZero() ? zero : rate.div(totalRate)
        return listRow(product.icon, recipe.name, plainNum(percentText(share)), numSpan(rateText(rate)))
    })
    return list(rows, "Nothing consumes it.")
}

function renderDetails(spec, totals) {
    let card = document.getElementById("node-details")
    if (!card) {
        return
    }
    let item = spec.whereItem ? spec.items.get(spec.whereItem) : null
    if (!totals || !item || !totals.items.has(item)) {
        card.hidden = true
        card.removeAttribute("data-item")
        card.textContent = ""
        return
    }

    card.dataset.item = item.key
    card.textContent = ""

    let rate = totals.items.get(item) || zero
    let rows = buildRows(totals)
    let row = rows.find(r => r.item === item) || null
    let isTarget = row ? row.isTarget : spec.buildTargets.some(t => t.item === item)
    let isResource = row ? row.isResource : false

    card.appendChild(buildHead(item, rate))

    if (row && !isTarget && !isResource) {
        card.appendChild(buildSourceSeg(item, row))
    }

    if (row && row.isReal) {
        let machines = buildMachinesLine(row)
        if (machines) {
            card.appendChild(machines)
        }
    }

    card.appendChild(lbl("Needs"))
    card.appendChild(buildNeeds(row))

    card.appendChild(lbl("Goes to"))
    card.appendChild(buildGoesTo(item, totals))

    card.hidden = false
}

export function initDetails() {
    document.addEventListener("calc:select", () => renderDetails(spec, spec.lastTotals))
    registerRenderer(renderDetails)
}
