// The staged Factory table (#factory-table): one .row per craftable recipe,
// grouped and ordered by calc/table-core.js, with a per-row expansion for
// machine/module/beacon choices.
import { spec } from "./factory.js"
import { Rational, zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { groupRows } from "./table-core.js"

// Recipe keys with their row expanded, kept module-level so a re-render
// (every solve) doesn't collapse what the user opened.
const expandedRows = new Set()

const RATE_LABEL = { s: "/s", m: "/min", h: "/h" }

// Ported from the old calc/display.js's powerRepr: picks the largest SI
// power unit that keeps the mantissa above 1.
const POWER_SUFFIXES = [" W", "kW", "MW", "GW", "TW", "PW"]
function powerRepr(x) {
    let thousand = Rational.from_float(1000)
    let i = 0
    while (thousand.less(x) && i < POWER_SUFFIXES.length - 1) {
        x = x.div(thousand)
        i++
    }
    return spec.format.count(x) + POWER_SUFFIXES[i]
}

function numSpan(value, text, extraClass) {
    const span = document.createElement("span")
    span.className = extraClass ? `num ${extraClass}` : "num"
    span.dataset.value = String(value)
    span.textContent = text
    return span
}

// The rate actually shown to the user, in the current display unit -- what
// a click on this cell should hand the scratch pad.
function displayedRate(rate) {
    return rate.mul(spec.format.rateFactor).toFloat()
}

// A recipe row's raw material: totals.rates carries the real crafting
// recipes alongside two kinds of pseudo-recipe that are not factory rows --
// the solver's "output"/"surplus" sinks (isReal() false) and the "D-"
// DisabledRecipe standing in for an ignored/unproducible item (isDisable()
// true, isReal() true despite the name -- it is the item being *supplied*,
// not a sink).
function buildRows(totals) {
    const targets = new Set(spec.buildTargets.map(t => t.item))
    const rows = []
    for (const [recipe, recipeRate] of totals.rates) {
        if (!recipe.isReal()) {
            continue
        }
        const item = recipe.products[0].item
        const itemRate = totals.items.get(item) || zero
        const supplied = recipe.isDisable ? recipe.isDisable() : false
        rows.push({
            key: recipe.key,
            name: item.name,
            isReal: !supplied,
            isResource: recipe.isResource(),
            category: recipe.category,
            isTarget: recipe.products.some(p => targets.has(p.item)),
            rate: itemRate.toFloat(),
            recipe,
            item,
            recipeRate,
            itemRate,
        })
    }
    return rows
}

function headerRow() {
    const row = document.createElement("div")
    row.className = "row"
    row.style.background = "none"
    row.innerHTML = `<span style="width: 36px;"></span><span class="h c-name">Recipe</span><span class="h" style="width: 120px;">Machines</span><span class="h c-out">Output ${RATE_LABEL[spec.format.rateName] || "/min"}</span><span class="h c-belt">Belts</span><span class="h" style="flex: 1; text-align: right;">Modules</span>`
    return row
}

function machinesCell(row) {
    const cell = document.createElement("span")
    const building = row.isReal ? spec.getBuilding(row.recipe) : null
    if (building === null) {
        cell.className = "machines muted"
        cell.style.fontSize = "13px"
        cell.textContent = "input"
        return { cell, building: null, buildings: 0, power: zero }
    }
    cell.className = "machines"
    const icon = document.createElement("span")
    icon.className = "slot slot-sm"
    icon.appendChild(building.icon.make(20, true))
    cell.appendChild(icon)

    const roundedUp = spec.roundMachines !== false
    const countRat = spec.getCount(row.recipe, row.recipeRate)
    const countValue = roundedUp ? Math.ceil(countRat.toFloat()) : countRat.toFloat()
    const countText = roundedUp ? String(countValue) : spec.format.count(countRat)
    cell.appendChild(numSpan(countValue, countText))

    const power = spec.getPowerUsage(row.recipe, row.recipeRate).power
    return { cell, building, buildings: countValue, power }
}

function modulesCell(row, building) {
    const cell = document.createElement("span")
    cell.style.flex = "1"
    cell.style.display = "flex"
    cell.style.justifyContent = "flex-end"
    cell.style.gap = "3px"
    if (building !== null && building.canBeacon()) {
        const moduleSpec = spec.getModuleSpec(row.recipe)
        for (const m of moduleSpec.modules) {
            const slot = document.createElement("span")
            slot.className = m ? "slot slot-sm" : "slot slot-sm dim"
            if (m) {
                slot.appendChild(m.icon.make(20, true))
            }
            cell.appendChild(slot)
        }
    }
    return cell
}

function moduleChoices(recipe) {
    return [null, ...spec.modules.values()].filter(m => !m || m.canUse(recipe))
}

function slotPicker(current, choices, onPick, dim) {
    const slot = document.createElement("span")
    slot.className = current ? "slot slot-sm" : `slot slot-sm ${dim ? "dim" : ""}`.trim()
    if (current) {
        slot.appendChild(current.icon.make(20, true))
    }
    slot.addEventListener("click", event => {
        event.stopPropagation()
        const next = choices[(choices.indexOf(current) + 1) % choices.length]
        onPick(next)
    })
    return slot
}

function renderExpansion(row) {
    const wrap = document.createElement("div")
    wrap.style.width = "100%"
    wrap.style.padding = "8px 0 4px 46px"

    const grid = document.createElement("div")
    grid.style.display = "grid"
    grid.style.gridTemplateColumns = "1fr 1fr 1fr"
    grid.style.gap = "10px"
    wrap.appendChild(grid)

    const building = row.isReal ? spec.getBuilding(row.recipe) : null

    const machineCol = document.createElement("div")
    machineCol.innerHTML = '<div class="muted" style="font-size: 13px; margin-bottom: 4px;">Machine</div>'
    const machineRow = document.createElement("div")
    machineRow.style.display = "flex"
    machineRow.style.gap = "4px"
    if (building !== null) {
        for (const b of spec.getBuildingGroup(building).buildings) {
            const slot = document.createElement("span")
            slot.className = b === building ? "slot sel" : "slot"
            slot.appendChild(b.icon.make(28, true))
            slot.addEventListener("click", () => {
                spec.setMinimumBuilding(b)
                spec.updateSolution()
            })
            machineRow.appendChild(slot)
        }
    }
    machineCol.appendChild(machineRow)
    grid.appendChild(machineCol)

    const moduleSpec = building !== null && building.canBeacon() ? spec.getModuleSpec(row.recipe) : null
    const modCol = document.createElement("div")
    const modLabel = document.createElement("div")
    modLabel.className = "muted"
    modLabel.style.fontSize = "13px"
    modLabel.style.marginBottom = "4px"
    modLabel.textContent = `Modules · ${moduleSpec ? moduleSpec.modules.length : 0} slots`
    modCol.appendChild(modLabel)
    const modRow = document.createElement("div")
    modRow.style.display = "flex"
    modRow.style.gap = "4px"
    modRow.style.alignItems = "center"
    if (moduleSpec !== null) {
        const choices = moduleChoices(row.recipe)
        moduleSpec.modules.forEach((m, i) => {
            modRow.appendChild(slotPicker(m, choices, next => {
                moduleSpec.setModule(i, next)
                spec.updateSolution()
            }, true))
        })
    }
    modCol.appendChild(modRow)
    grid.appendChild(modCol)

    const beaconCol = document.createElement("div")
    beaconCol.innerHTML = '<div class="muted" style="font-size: 13px; margin-bottom: 4px;">Beacons</div>'
    const beaconRow = document.createElement("div")
    beaconRow.style.display = "flex"
    beaconRow.style.gap = "4px"
    beaconRow.style.alignItems = "center"
    if (moduleSpec !== null) {
        const choices = moduleChoices(row.recipe)
        for (let i = 0; i < moduleSpec.beaconModules.length; i++) {
            beaconRow.appendChild(slotPicker(moduleSpec.beaconModules[i], choices, next => {
                moduleSpec.setBeaconModule(next, i)
                spec.updateSolution()
            }, true))
        }
        const countInput = document.createElement("input")
        countInput.className = "num"
        countInput.style.width = "36px"
        countInput.style.textAlign = "right"
        countInput.value = spec.format.count(moduleSpec.beaconCount)
        countInput.addEventListener("click", event => event.stopPropagation())
        countInput.addEventListener("change", () => {
            moduleSpec.setBeaconCount(Rational.from_string(countInput.value))
            spec.updateSolution()
        })
        beaconRow.appendChild(countInput)
        const perMachine = document.createElement("span")
        perMachine.className = "muted"
        perMachine.style.fontSize = "13px"
        perMachine.textContent = "per machine"
        beaconRow.appendChild(perMachine)
    }
    beaconCol.appendChild(beaconRow)
    grid.appendChild(beaconCol)

    const ingLine = document.createElement("div")
    ingLine.style.width = "100%"
    ingLine.style.padding = "0 0 4px 0"
    ingLine.style.display = "flex"
    ingLine.style.gap = "16px"
    ingLine.style.fontSize = "13px"
    const ingLabel = document.createElement("span")
    ingLabel.className = "muted"
    ingLabel.textContent = "Ingredients:"
    ingLine.appendChild(ingLabel)
    for (const ing of row.recipe.ingredients || []) {
        const amount = ing.amount.mul(row.recipeRate)
        const span = document.createElement("span")
        const img = ing.item.icon.make(16, true)
        img.style.verticalAlign = "-3px"
        span.appendChild(img)
        span.appendChild(document.createTextNode(` ${amount.toDecimal(2)} ${ing.item.name}`))
        ingLine.appendChild(span)
    }
    const whereLink = document.createElement("a")
    whereLink.style.marginLeft = "auto"
    whereLink.style.cursor = "pointer"
    whereLink.textContent = "Where it goes →"
    whereLink.addEventListener("click", event => {
        event.stopPropagation()
        document.dispatchEvent(new CustomEvent("calc:where", { detail: { item: row.item.key } }))
    })
    ingLine.appendChild(whereLink)
    wrap.appendChild(ingLine)

    return wrap
}

function renderRow(row) {
    const isOpen = expandedRows.has(row.key)
    const div = document.createElement("div")
    div.className = isOpen ? "row hot" : "row"
    div.dataset.recipe = row.key
    div.style.flexWrap = "wrap"

    const slot = document.createElement("span")
    slot.className = row.isReal ? "slot" : "slot dim"
    slot.appendChild(row.item.icon.make(28, true))
    slot.addEventListener("click", event => {
        event.stopPropagation()
        document.dispatchEvent(new CustomEvent("calc:toggle-supplied", { detail: { item: row.item.key } }))
    })
    div.appendChild(slot)

    const name = document.createElement("span")
    name.className = row.isReal ? "c-name" : "c-name muted"
    name.textContent = row.name
    name.addEventListener("click", event => {
        event.stopPropagation()
        document.dispatchEvent(new CustomEvent("calc:where", { detail: { item: row.item.key } }))
    })
    div.appendChild(name)

    const { cell: machines, building, buildings, power } = machinesCell(row)
    div.appendChild(machines)

    div.appendChild(numSpan(displayedRate(row.itemRate), spec.format.rate(row.itemRate), "c-out"))

    const belt = document.createElement("span")
    belt.className = "num muted c-belt"
    if (row.item.phase !== "fluid") {
        const beltCount = spec.getBeltCount(row.itemRate)
        belt.dataset.value = beltCount.toFloat()
        belt.textContent = beltCount.toDecimal(2)
    }
    div.appendChild(belt)

    div.appendChild(modulesCell(row, building))

    div.addEventListener("click", () => {
        if (expandedRows.has(row.key)) {
            expandedRows.delete(row.key)
        } else {
            expandedRows.add(row.key)
        }
        spec.display()
    })

    if (isOpen) {
        div.appendChild(renderExpansion(row))
    }

    return { el: div, buildings: row.isReal ? buildings : 0, power: row.isReal ? power : zero }
}

function renderTable(spec, totals) {
    const container = document.getElementById("factory-table")
    if (!container) {
        return
    }
    container.innerHTML = ""
    container.appendChild(headerRow())

    let totalBuildings = 0
    let totalPower = zero
    for (const group of groupRows(buildRows(totals))) {
        const sec = document.createElement("div")
        sec.className = "sec"
        sec.textContent = group.name
        container.appendChild(sec)
        for (const row of group.rows) {
            const { el, buildings, power } = renderRow(row)
            container.appendChild(el)
            totalBuildings += buildings
            totalPower = totalPower.add(power)
        }
    }

    const totalsSpan = document.getElementById("factory-totals")
    if (totalsSpan) {
        totalsSpan.textContent = `${totalBuildings} buildings · ${powerRepr(totalPower)}`
    }
}

export function initTable() {
    registerRenderer(renderTable)
}

// Shared with inputs.js: the same row shape (so the Inputs frame doesn't
// re-derive it) and the power formatter for its Totals section.
export { buildRows, powerRepr }
