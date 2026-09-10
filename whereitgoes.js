// calc/whereitgoes.js — the per-item "Where it goes" view: consumers,
// producers, and a what-if for building a supplied item locally instead.
import { clickTab } from "./events.js"
import { spec } from "./factory.js"
import { registerRenderer } from "./render.js"
import { Rational, one, zero } from "./rational.js"

const NOTHING_BUILDS_IT = 'Nothing here builds it: it is on the "supplied from elsewhere" list.'
const OPEN_FROM_ANY_ITEM = "Open this tab from any item: click its name in the Factory table, a node in Flow, or pick from the list on the left."

const HUNDRED = Rational.from_float(100)
const THOUSAND = Rational.from_float(1000)
const RATE_SUFFIX = {s: "/s", m: "/min", h: "/h"}
// Mirrors calc/display.js's powerRepr, which this module cannot import
// (display.js is slated for deletion): step the watt value up through
// kW/MW/GW/TW until it is under 1000 of the current unit.
const POWER_SUFFIXES = [" W", "kW", "MW", "GW", "TW", "PW"]

function powerRepr(watts) {
    let i = 0
    while (THOUSAND.less(watts) && i < POWER_SUFFIXES.length - 1) {
        watts = watts.div(THOUSAND)
        i++
    }
    return {power: watts, suffix: POWER_SUFFIXES[i]}
}

// belts is a Rational belt count, not an integer: a quarter of a belt still
// needs its own lane.
function laneNote(belts) {
    let f = belts.toFloat()
    if (f <= 0.5) {
        return "one lane is enough"
    }
    if (f <= 1) {
        return "one belt"
    }
    return `${Math.ceil(f)} belts`
}

function percentText(share) {
    let percent = share.mul(HUNDRED)
    if (percent.less(one)) {
        return "<1%"
    }
    return percent.toDecimal(0) + "%"
}

function text(content, style) {
    let span = document.createElement("span")
    span.textContent = content
    if (style) {
        span.style.cssText = style
    }
    return span
}

// data-value must be the number the user sees (the display-unit decimal
// text, e.g. "270" for 270/min) -- the scratch pad inserts it verbatim, and
// a per-second float there would silently be 60x-off for a /min display.
function numSpan(displayText, extraClass) {
    let span = document.createElement("span")
    span.className = extraClass ? `num ${extraClass}` : "num"
    span.dataset.value = displayText
    span.textContent = displayText
    return span
}

function slot(icon, size, sizeClass) {
    let span = document.createElement("span")
    span.className = sizeClass ? `slot ${sizeClass}` : "slot"
    span.appendChild(icon.make(size, true))
    return span
}

function row(...children) {
    let div = document.createElement("div")
    div.className = "row"
    for (let c of children) {
        div.appendChild(c)
    }
    return div
}

function muted(content, style) {
    let span = text(content, style)
    span.className = "muted"
    return span
}

function frame(title, subtitle, bodyChildren) {
    let f = document.createElement("div")
    f.className = "frame"
    let titlebar = document.createElement("div")
    titlebar.className = "titlebar"
    titlebar.appendChild(text(title)).className = "title"
    titlebar.appendChild(Object.assign(document.createElement("div"), {className: "drag"}))
    if (subtitle) {
        titlebar.appendChild(muted(subtitle))
    }
    f.appendChild(titlebar)
    let deep = document.createElement("div")
    deep.className = "deep"
    for (let c of bodyChildren) {
        deep.appendChild(c)
    }
    f.appendChild(deep)
    return f
}

function renderWhereList(spec, totals) {
    let list = document.getElementById("where-list")
    list.textContent = ""
    if (!totals) {
        return
    }
    let filter = (document.getElementById("where-filter").value || "").toLowerCase()
    let entries = [...totals.items].sort((a, b) => {
        let cmp = b[1].toFloat() - a[1].toFloat()
        return cmp !== 0 ? cmp : a[0].name.localeCompare(b[0].name)
    })
    for (let [item, rate] of entries) {
        if (filter && !item.name.toLowerCase().includes(filter)) {
            continue
        }
        let r = row(
            slot(item.icon, 20, "slot-sm"),
            text(item.name, "flex: 1;"),
            numSpan(spec.format.rate(rate)),
        )
        if (item.key === spec.whereItem) {
            r.classList.add("hot")
        }
        r.addEventListener("click", () => {
            document.dispatchEvent(new CustomEvent("calc:where", {detail: {item: item.key}}))
        })
        list.appendChild(r)
    }
}

// An item counts as "supplied from elsewhere" either because the user put
// it on the ignore list, or because its only producer in this solution is
// the D- disabled/ex-nihilo recipe (no real recipe currently supplies it).
function isSupplied(spec, totals, item) {
    if (spec.ignore.has(item)) {
        return true
    }
    let producers = totals.producers.get(item)
    return !!producers && producers.size === 1 && [...producers.keys()][0].isDisable()
}

function headerFrame(spec, totals, item, supplied) {
    let f = document.createElement("div")
    f.className = "frame"
    f.style.cssText = "display: flex; align-items: center; gap: 12px; padding: 10px 12px;"
    f.appendChild(slot(item.icon, 34, "slot-lg"))

    let mid = document.createElement("div")
    mid.appendChild(text(item.name)).className = "title"
    mid.lastChild.style.fontSize = "20px"

    let rate = totals.items.get(item) || zero
    let statusText = supplied ? "Supplied from elsewhere" : "Built here"
    if (item.phase !== "fluid") {
        let belts = spec.getBeltCount(rate)
        statusText += ` · ${belts.toDecimal(2)} belts`
        if (supplied) {
            statusText += ` · ${laneNote(belts)}`
        }
    }
    mid.appendChild(muted(statusText))
    f.appendChild(mid)

    let big = numSpan(spec.format.rate(rate))
    big.style.cssText = "font-size: 30px; margin-left: auto;"
    f.appendChild(big)
    f.appendChild(text(RATE_SUFFIX[spec.format.rateName] || "")).className = "muted"

    if (supplied) {
        let button = document.createElement("button")
        button.type = "button"
        button.className = "btn"
        button.textContent = "Build it here instead"
        button.addEventListener("click", () => {
            document.dispatchEvent(new CustomEvent("calc:toggle-supplied", {detail: {item: item.key}}))
        })
        f.appendChild(button)
    }
    return f
}

function goesToRow(spec, totals, item, recipe, rate) {
    let product = recipe.products[0].item
    let building = spec.getBuilding(recipe)
    let count = Math.ceil(spec.getCount(recipe, totals.rates.get(recipe)).toFloat())
    let buildingName = building ? building.name : "?"

    let nameCell = document.createElement("span")
    nameCell.style.width = "260px"
    nameCell.appendChild(new Text(recipe.name))
    nameCell.appendChild(document.createElement("br"))
    nameCell.appendChild(muted(`${count} ${buildingName} · ${recipe.uses(item).toDecimal(2)} per craft`, "font-size: 13px;"))

    let itemRate = totals.items.get(item) || zero
    let share = itemRate.isZero() ? zero : rate.div(itemRate)

    let bartrack = document.createElement("span")
    bartrack.className = "bartrack"
    let bar = document.createElement("div")
    bar.className = "bar"
    bar.style.width = `${Math.min(100, share.toFloat() * 100)}%`
    bartrack.appendChild(bar)

    let shareText = document.createElement("span")
    shareText.className = "num"
    shareText.style.cssText = "width: 50px; text-align: right;"
    shareText.textContent = percentText(share)

    return row(
        slot(product.icon, 28),
        nameCell,
        numSpan(spec.format.rate(rate), "c-out"),
        muted(RATE_SUFFIX[spec.format.rateName] || "", "width: 40px;"),
        bartrack,
        shareText,
    )
}

function comesFromRow(spec, recipe, rate) {
    let product = recipe.products[0].item
    let building = spec.getBuilding(recipe)
    let count = Math.ceil(spec.getCount(recipe, rate).toFloat())
    let buildingName = building ? building.name : "?"

    let nameCell = document.createElement("span")
    nameCell.style.width = "260px"
    nameCell.appendChild(new Text(recipe.name))
    nameCell.appendChild(document.createElement("br"))
    nameCell.appendChild(muted(`${count} ${buildingName}`, "font-size: 13px;"))

    return row(
        slot(product.icon, 28),
        nameCell,
        numSpan(spec.format.rate(rate), "c-out"),
    )
}

function whatIfRow(spec, recipe, deltaRate) {
    let product = recipe.products[0].item
    let building = spec.getBuilding(recipe)
    let count = Math.ceil(spec.getCount(recipe, deltaRate).toFloat())
    let buildingName = building ? building.name : "?"

    let nameCell = document.createElement("span")
    nameCell.style.width = "260px"
    nameCell.appendChild(new Text(product.name))
    nameCell.appendChild(document.createElement("br"))
    nameCell.appendChild(muted(recipe.name, "font-size: 13px;"))

    return row(
        slot(product.icon, 28),
        nameCell,
        numSpan(spec.format.rate(deltaRate), "c-out"),
        muted(`${count} ${buildingName}`),
    )
}

function whatIfSection(spec, totals, item) {
    let rows = []
    let powerDelta = zero
    let errorText = null

    // spec.ignore mutation is scoped to this one solve; the finally clause
    // always restores it even if solve() throws.
    spec.ignore.delete(item)
    try {
        let t2
        try {
            t2 = spec.solve()
        } finally {
            spec.ignore.add(item)
        }
        for (let [recipe, rate] of t2.rates) {
            // Skip the solver's sink pseudo-recipes and the D- disabled
            // recipe: the latter still stands in for a second item that
            // remains supplied even with this one built locally.
            if (!recipe.isReal() || recipe.isDisable()) {
                continue
            }
            let before = totals.rates.get(recipe) || zero
            if (before.less(rate)) {
                let deltaRate = rate.sub(before)
                rows.push(whatIfRow(spec, recipe, deltaRate))
                powerDelta = powerDelta.add(spec.getPowerUsage(recipe, deltaRate).power)
            }
        }
    } catch (err) {
        errorText = "Could not solve the what-if."
    }

    let body
    if (errorText) {
        body = [muted(errorText)]
    } else if (rows.length === 0) {
        body = [muted("Building it here would not add any recipes.")]
    } else {
        let {power, suffix} = powerRepr(powerDelta)
        body = [...rows, muted(`+${power.toDecimal(1)} ${suffix}`)]
    }
    return frame("If you built it here", "what it would add to this factory", body)
}

function renderWhereMain(spec, totals) {
    let main = document.getElementById("where-main")
    main.textContent = ""
    let item = spec.whereItem ? spec.items.get(spec.whereItem) : null
    if (!totals || !item) {
        main.appendChild(muted(OPEN_FROM_ANY_ITEM, "font-size: 13px; padding: 0 4px;"))
        return
    }

    let supplied = isSupplied(spec, totals, item)
    main.appendChild(headerFrame(spec, totals, item, supplied))

    // The terminating "output"/"surplus" pseudo-recipes (solve.js) also
    // appear as consumers of a build target's own item, but have no
    // products to show a row for; isReal() is false for exactly those.
    let consumers = [...(totals.consumers.get(item) || new Map())]
        .filter(([recipe]) => recipe.isReal())
        .sort((a, b) => b[1].toFloat() - a[1].toFloat())
    let goesToBody = consumers.length
        ? consumers.map(([recipe, rate]) => goesToRow(spec, totals, item, recipe, rate))
        : [muted("Nothing consumes it.")]
    main.appendChild(frame("Goes to", "every consumer, largest first", goesToBody))

    // Real producing recipes only: excludes both the solver's sink
    // pseudo-recipes and the D- disabled/ex-nihilo recipe that stands in
    // for a supplied item.
    let producers = [...(totals.producers.get(item) || new Map())]
        .filter(([recipe]) => recipe.isReal() && !recipe.isDisable())
        .sort((a, b) => b[1].toFloat() - a[1].toFloat())
    let comesFromBody = producers.length
        ? producers.map(([recipe, rate]) => comesFromRow(spec, recipe, rate))
        : [row(slot(item.icon, 28), text(NOTHING_BUILDS_IT, "flex: 1;"))]
    main.appendChild(frame("Comes from", null, comesFromBody))

    if (supplied) {
        main.appendChild(whatIfSection(spec, totals, item))
    }

    main.appendChild(muted(OPEN_FROM_ANY_ITEM, "font-size: 13px; padding: 0 4px;"))
}

export function renderWhere(spec, totals) {
    renderWhereList(spec, totals)
    renderWhereMain(spec, totals)
}

export function initWhere() {
    document.addEventListener("calc:where", e => {
        spec.whereItem = e.detail.item
        clickTab("where")
        renderWhere(spec, spec.lastTotals)
    })
    // The filter only narrows the left-hand list; re-rendering the main
    // column too would re-run the what-if solve() on every keystroke.
    document.getElementById("where-filter").addEventListener("input", () => renderWhereList(spec, spec.lastTotals))
    registerRenderer(renderWhere)
}
