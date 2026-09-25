// calc/details.js — the shared "row opened" detail markup: Needs, Goes to
// and Source (make-here/bring-in switch, recipe picker, exact machine
// count). `renderDetail` is pure DOM-building, called by both the table's
// open row (itemtable.js, `.detail` under the clicked `.lrow`) and the
// graph view's side card (`#graph-side`, built here since selecting a node
// does not itself trigger a re-solve).
import { spec } from "./factory.js"
import { beltText } from "./flow-core.js"
import { recipesFor } from "./machines-core.js"
import { destinationLines, flowLines, goesToRatio, needsRatio } from "./ratio-core.js"
import { one, Rational, zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { relevantRecipes, renderOptions } from "./source.js"
import { RATE_LABEL } from "./table-core.js"
import { buildRows, powerRepr } from "./table.js"
import { Tooltip } from "./tooltip.js"

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
function numSpan(text) {
    let span = document.createElement("span")
    span.className = "num"
    span.dataset.value = text
    span.textContent = text
    return span
}

// The "Goes to" share, which the scratch pad should never insert.
function shareSpan(text) {
    let span = document.createElement("span")
    span.className = "share num"
    span.textContent = text
    return span
}

function badgeSpan(kind, text) {
    let span = document.createElement("span")
    span.className = `badge ${kind}`
    span.textContent = text
    return span
}

function mutedSpan(text, extraClass) {
    let span = document.createElement("span")
    span.className = extraClass ? `muted ${extraClass}` : "muted"
    span.textContent = text
    return span
}

function lbl(text) {
    let span = document.createElement("span")
    span.className = "lbl"
    span.textContent = text
    return span
}

function slotXs(icon) {
    let span = document.createElement("span")
    span.className = "slot xs"
    span.appendChild(icon.make(18, true))
    return span
}

function drow(icon, name, badge, numEl) {
    let div = document.createElement("div")
    div.className = "drow"
    div.appendChild(slotXs(icon))
    let grow = document.createElement("span")
    grow.className = "grow"
    grow.textContent = name
    div.appendChild(grow)
    if (badge) {
        div.appendChild(badge)
    }
    div.appendChild(numEl)
    return div
}

// Item rate one machine running `recipe` moves, given the recipe's total
// `itemRate` of that item in this solution; null when the recipe has no
// machine (so there is no ratio to state).
function perMachine(totals, recipe, itemRate) {
    if (spec.getBuilding(recipe) === null) {
        return null
    }
    let count = spec.getCount(recipe, totals.rates.get(recipe) || zero)
    return count.isZero() ? null : itemRate.div(count)
}

// {supplier, consumer, p, q} for `item` flowing from its own row's recipe
// into `consumer`, with p/q consumer machines per supplier machine; null
// when either side has no machine or the item is brought in.
function machineRatio(totals, rows, item, consumer, consumedRate) {
    let row = rows.find(r => r.item === item)
    if (!row || !row.isReal) {
        return null
    }
    let produced = (totals.producers.get(item) || new Map()).get(row.recipe) || row.itemRate
    let perSupplier = perMachine(totals, row.recipe, produced)
    let perConsumer = perMachine(totals, consumer, consumedRate)
    if (perSupplier === null || perConsumer === null || perConsumer.isZero()) {
        return null
    }
    let r = perSupplier.div(perConsumer)
    return {
        supplier: spec.getBuilding(row.recipe).name,
        consumer: spec.getBuilding(consumer).name,
        p: r.p.toJSNumber(),
        q: r.q.toJSNumber(),
    }
}

// {building, recipe, count, total} for `recipe`'s machines, `count` of the
// `total` being the part that moves `share` of the recipe's output; null
// when the recipe has no machine.
function machinesOn(totals, recipe, share) {
    let building = spec.getBuilding(recipe)
    if (building === null) {
        return null
    }
    let total = spec.getCount(recipe, totals.rates.get(recipe) || zero)
    if (total.isZero()) {
        return null
    }
    return { building: building.name, recipe: recipe.name, count: total.mul(share).toFloat(), total: total.toFloat() }
}

// The machines making `rate` of `item`: every recipe that makes it, each
// its share of the item's total output. Empty when the item's row is
// brought in.
function suppliersOf(totals, rows, item, rate) {
    let row = rows.find(r => r.item === item)
    if (!row || !row.isReal) {
        return []
    }
    let producers = [...(totals.producers.get(item) || new Map())]
    let produced = producers.reduce((sum, [, r]) => sum.add(r), zero)
    if (produced.isZero()) {
        return []
    }
    let share = rate.div(produced)
    return producers.map(([recipe]) => machinesOn(totals, recipe, share)).filter(m => m !== null)
}

function cardFrame(heading) {
    let frame = document.createElement("div")
    frame.className = "frame flow-card"
    let head = document.createElement("h3")
    head.textContent = heading
    frame.appendChild(head)
    return frame
}

function cardLine(frame, text, className) {
    let div = document.createElement("div")
    if (className) {
        div.className = className
    }
    div.textContent = text
    frame.appendChild(div)
}

// Hovering the rate on a Needs/Goes to line: the belts `rate` of `item`
// fills, the machines making it and the `consumer` machines that use it.
function flowTooltip(numEl, totals, rows, item, consumer, rate) {
    let lines = flowLines({
        belts: spec.getBeltCount(rate).toFloat(),
        beltName: spec.belt.name,
        fluid: item.phase === "fluid",
        suppliers: suppliersOf(totals, rows, item, rate),
        consumer: machinesOn(totals, consumer, one),
    })
    numEl.classList.add("flow")
    new Tooltip(numEl, () => {
        let frame = cardFrame(`${numEl.textContent} ${item.name}`)
        for (let line of lines) {
            cardLine(frame, line)
        }
        return frame
    })
    return numEl
}

// Hovering a table row's Need rate: the item's belts and what makes it,
// then every place it goes with how many of those machines feed how many
// of the next ones -- the whole Goes to column, worked out.
export function itemTooltip(el, totals, rows, item) {
    let total = totals.items.get(item) || zero
    if (total.isZero()) {
        return
    }
    let fluid = item.phase === "fluid"
    let summary = flowLines({
        belts: spec.getBeltCount(total).toFloat(),
        beltName: spec.belt.name,
        fluid,
        suppliers: suppliersOf(totals, rows, item, total),
        consumer: null,
    })
    let flows = [...(totals.consumers.get(item) || new Map())]
        .filter(([recipe]) => recipe.isReal())
        .sort((a, b) => b[1].toFloat() - a[1].toFloat())
        .map(([recipe, rate]) => ({ name: recipe.name, rate, consumer: machinesOn(totals, recipe, one) }))
    let left = flows.reduce((sum, f) => sum.sub(f.rate), total)
    if (spec.buildTargets.some(t => t.item === item) && zero.less(left)) {
        flows.push({ name: "What you asked for", rate: left, consumer: null })
    }
    let destinations = flows.map(f => destinationLines({
        name: f.name,
        rate: rateText(f.rate),
        percent: percentText(f.rate.div(total)),
        belts: fluid ? null : spec.getBeltCount(f.rate).toFloat(),
        beltName: spec.belt.name,
        suppliers: suppliersOf(totals, rows, item, f.rate).map(m => ({ building: m.building, count: m.count })),
        consumer: f.consumer ? { building: f.consumer.building, count: f.consumer.count } : null,
    }))
    el.classList.add("flow")
    new Tooltip(el, () => {
        let frame = cardFrame(`${rateText(total)} ${item.name}`)
        for (let line of summary) {
            cardLine(frame, line)
        }
        if (destinations.length > 0) {
            cardLine(frame, "Goes to", "lbl")
        }
        for (let d of destinations) {
            cardLine(frame, d.title, "dest")
            if (d.detail) {
                cardLine(frame, d.detail, "muted dest-detail")
            }
        }
        return frame
    })
}

function col(className, children) {
    let div = document.createElement("div")
    div.className = `col ${className}`
    for (let child of children) {
        div.appendChild(child)
    }
    return div
}

function buildHead(item, rate, size) {
    let head = document.createElement("div")
    head.className = "head"
    head.style.cssText = "display: flex; align-items: center; gap: 10px;"
    let icon = document.createElement("span")
    icon.className = "slot"
    icon.appendChild(item.icon.make(size, true))
    head.appendChild(icon)

    let grow = document.createElement("span")
    grow.style.flex = "1"
    grow.style.lineHeight = "1.15"
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

// The ingredient's own row, for the "brought in"/"mined"/"piped in" badge
// on a Needs line -- an ingredient can be supplied or a raw resource
// independently of the row being expanded.
function needBadge(rows, item) {
    let ingredientRow = rows.find(r => r.item === item)
    if (!ingredientRow) {
        return null
    }
    if (!ingredientRow.isReal) {
        return badgeSpan("in", "brought in")
    }
    if (ingredientRow.isResource) {
        return item.phase === "fluid" ? badgeSpan("pipe", "piped in") : badgeSpan("mine", "mined")
    }
    return null
}

function buildNeedsCol(rows, row, totals) {
    let children = [lbl("Needs")]
    if (!row) {
        children.push(mutedSpan("Nothing needed."))
    } else if (!row.isReal) {
        children.push(mutedSpan("Made in another build; nothing needed here."))
    } else if (row.isResource) {
        children.push(mutedSpan(row.item.phase === "fluid" ? "Piped in." : "Mined here."))
    } else {
        let ingredients = row.recipe.ingredients || []
        if (ingredients.length === 0) {
            children.push(mutedSpan("Nothing needed."))
        }
        let consumed = totals.consumers
        for (let ing of ingredients) {
            let amount = ing.amount.mul(row.recipeRate)
            let rate = (consumed.get(ing.item) || new Map()).get(row.recipe) || amount
            let num = flowTooltip(numSpan(rateText(amount)), totals, rows, ing.item, row.recipe, rate)
            children.push(drow(ing.item.icon, ing.item.name, needBadge(rows, ing.item), num))
            let ratio = machineRatio(totals, rows, ing.item, row.recipe, rate)
            if (ratio) {
                children.push(mutedSpan(needsRatio(ratio.supplier, ratio.consumer, ratio.p, ratio.q), "ratio"))
            }
        }
    }
    return col("needs", children)
}

function buildGoesToCol(rows, item, totals, isTarget) {
    let children = [lbl("Goes to")]
    let totalRate = totals.items.get(item) || zero
    let consumers = [...(totals.consumers.get(item) || new Map())]
        .filter(([recipe]) => recipe.isReal())
        .sort((a, b) => b[1].toFloat() - a[1].toFloat())
    if (consumers.length === 0) {
        children.push(mutedSpan(isTarget ? "This is what you asked for." : "Nothing consumes it."))
    } else {
        for (let [recipe, rate] of consumers) {
            let product = recipe.products[0].item
            let share = totalRate.isZero() ? zero : rate.div(totalRate)
            let num = flowTooltip(numSpan(rateText(rate)), totals, rows, item, recipe, rate)
            children.push(drow(product.icon, recipe.name, shareSpan(percentText(share)), num))
            let ratio = machineRatio(totals, rows, item, recipe, rate)
            if (ratio) {
                children.push(mutedSpan(goesToRatio(ratio.supplier, ratio.consumer, ratio.p, ratio.q), "ratio"))
            }
        }
    }
    return col("goesto", children)
}

function buildSourceSeg(item, row) {
    let seg = document.createElement("span")
    seg.className = "seg source"
    let here = document.createElement("button")
    here.type = "button"
    here.textContent = "Make here"
    let bringIn = document.createElement("button")
    bringIn.type = "button"
    bringIn.textContent = "Bring in from another build"

    let supplied = !row.isReal
    here.classList.toggle("on", !supplied)
    bringIn.classList.toggle("on", supplied)
    bringIn.classList.toggle("in", supplied)

    let toggle = () => document.dispatchEvent(new CustomEvent("calc:toggle-supplied", { detail: { item: item.key } }))
    here.addEventListener("click", () => { if (supplied) toggle() })
    bringIn.addEventListener("click", () => { if (!supplied) toggle() })

    seg.appendChild(here)
    seg.appendChild(bringIn)
    return seg
}

function smallButton(text, className, onClick) {
    let button = document.createElement("button")
    button.type = "button"
    button.className = `btn btn-sm ${className}`
    button.textContent = text
    button.addEventListener("click", event => {
        event.stopPropagation()
        onClick()
    })
    return button
}

// The Machine line: one slot per machine that can make `recipe`, the one in
// use lit. A click pins this recipe to that machine (factory.js's
// recipeBuildings, `mach=`); "for everything in this build" pins every
// recipe in the plan it can make; "Automatic" drops this recipe's pin.
function buildMachinePicker(recipe, totals) {
    let capable = spec.capableBuildings(recipe)
    if (capable.length < 2) {
        return []
    }
    let current = spec.getBuilding(recipe)
    let slots = document.createElement("div")
    slots.className = "machines"
    for (let building of capable) {
        let off = spec.excludedBuildings.has(building.key)
        let button = document.createElement("button")
        button.type = "button"
        button.className = "slot" + (building === current ? " sel" : "") + (off ? " dim" : "")
        button.dataset.machine = building.key
        button.title = building.name + (off ? " (off in Settings → Machines)" : "")
        button.appendChild(building.icon.make(28, false))
        button.addEventListener("click", event => {
            event.stopPropagation()
            if (building !== current) {
                spec.setRecipeBuilding(recipe, building)
                spec.updateSolution()
            }
        })
        slots.appendChild(button)
    }

    let actions = document.createElement("div")
    actions.className = "machine-actions"
    let others = recipesFor(current, [...totals.rates.keys()])
        .filter(r => r !== recipe && spec.getBuilding(r) !== current)
    if (others.length > 0) {
        let text = `Use ${current.name.toLowerCase()} for everything in this build (${others.length} more)`
        actions.appendChild(smallButton(text, "machine-all", () => {
            for (let r of others) {
                spec.setRecipeBuilding(r, current)
            }
            spec.updateSolution()
        }))
    }
    if (spec.recipeBuildings.has(recipe.key)) {
        actions.appendChild(smallButton("Automatic", "machine-auto", () => {
            spec.setRecipeBuilding(recipe, null)
            spec.updateSolution()
        }))
    }
    return actions.childElementCount > 0 ? [lbl("Machine"), slots, actions] : [lbl("Machine"), slots]
}

function buildSourceCol(item, row, totals, isTarget, isResource) {
    let children = []
    if (row && !isTarget && !isResource) {
        children.push(buildSourceSeg(item, row))
    }
    if (relevantRecipes(item).length > 1) {
        children.push(lbl("Recipe"))
        children.push(renderOptions(item, totals))
    }
    if (row && spec.getBuilding(row.recipe) !== null) {
        children.push(...buildMachinePicker(row.recipe, totals))
        let exact = spec.getCount(row.recipe, row.recipeRate).toDecimal(2)
        let power = powerRepr(spec.getPowerUsage(row.recipe, row.recipeRate).power)
        children.push(mutedSpan(`${exact} machines exactly · ${power}`, "exact"))
        if (spec.isFallbackBuilding(row.recipe)) {
            let name = spec.getBuilding(row.recipe).name
            children.push(mutedSpan(`No available machine makes this, so it uses ${name.toLowerCase()} (switched off in Settings → Machines).`, "fallback"))
        }
    }
    return col("source", children)
}

// Fills `container` (emptying it first) with the Needs/Goes to/Source
// columns for `item`'s row, looked up fresh from `totals` every call --
// callers never cache a row across a re-solve.
export function renderDetail(container, item, totals) {
    container.textContent = ""
    let rows = buildRows(totals)
    let row = rows.find(r => r.item === item) || null
    let isTarget = row ? row.isTarget : spec.buildTargets.some(t => t.item === item)
    let isResource = row ? row.isResource : false

    container.appendChild(buildNeedsCol(rows, row, totals))
    container.appendChild(buildGoesToCol(rows, item, totals, isTarget))
    container.appendChild(buildSourceCol(item, row, totals, isTarget, isResource))
}

function renderGraphSide(_spec, totals) {
    let side = document.getElementById("graph-side")
    if (!side) {
        return
    }
    let item = spec.view === "graph" && spec.whereItem ? spec.items.get(spec.whereItem) : null
    if (!item || !totals || !totals.items.has(item)) {
        side.hidden = true
        side.textContent = ""
        return
    }

    side.textContent = ""
    let rate = totals.items.get(item) || zero
    side.appendChild(buildHead(item, rate, 28))
    let detail = document.createElement("div")
    detail.className = "detail"
    renderDetail(detail, item, totals)
    side.appendChild(detail)
    side.hidden = false
}

export function initDetails() {
    document.addEventListener("calc:select", () => renderGraphSide(spec, spec.lastTotals))
    // A view switch doesn't re-solve and doesn't change spec.whereItem, but
    // #graph-side must appear/disappear with it -- header.js dispatches
    // calc:view on every Table<->Graph click.
    document.addEventListener("calc:view", () => renderGraphSide(spec, spec.lastTotals))
    registerRenderer(renderGraphSide)
}
