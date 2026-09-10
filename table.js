// The staged Factory table (#factory-table): one .row per craftable recipe,
// grouped and ordered by calc/table-core.js, with a per-row expansion for
// machine/module/beacon choices.
import { spec } from "./factory.js"
import { formatPower } from "./power.js"
import { Rational, zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { groupRows, RATE_LABEL } from "./table-core.js"

// Recipe keys with their row expanded, kept module-level so a re-render
// (every solve) doesn't collapse what the user opened.
const expandedRows = new Set()

// data-value is what the scratch pad inserts verbatim on click, so it must
// be exactly the decimal string on screen -- never a differently-rounded or
// differently-scaled number (e.g. the raw per-second Rational).
function numSpan(text, extraClass) {
    const span = document.createElement("span")
    span.className = extraClass ? `num ${extraClass}` : "num"
    span.dataset.value = text
    span.textContent = text
    return span
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

// The building total in #factory-totals/#inputs must always agree, and
// neither can be a fraction of a building: roundMachines only controls what
// a single row's own cell displays, not what the two totals add up.
export function buildingCount(row) {
    if (!row.isReal) {
        return 0
    }
    const building = spec.getBuilding(row.recipe)
    if (building === null) {
        return 0
    }
    return Math.ceil(spec.getCount(row.recipe, row.recipeRate).toFloat())
}

function machinesCell(row) {
    const cell = document.createElement("span")
    const building = row.isReal ? spec.getBuilding(row.recipe) : null
    if (building === null) {
        cell.className = "machines muted"
        cell.style.fontSize = "13px"
        cell.textContent = "input"
        return { cell, building: null, power: zero }
    }
    cell.className = "machines"
    const icon = document.createElement("span")
    icon.className = "slot slot-sm"
    icon.appendChild(building.icon.make(20, true))
    cell.appendChild(icon)

    const roundedUp = spec.roundMachines !== false
    const countRat = spec.getCount(row.recipe, row.recipeRate)
    const countText = roundedUp ? String(Math.ceil(countRat.toFloat())) : spec.format.count(countRat)
    cell.appendChild(numSpan(countText))

    const power = spec.getPowerUsage(row.recipe, row.recipeRate).power
    return { cell, building, power }
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

// Beacons only accept modules with no productivity effect (canBeacon()),
// on top of the recipe-applicability check every module slot uses.
function beaconChoices(recipe) {
    return [null, ...spec.modules.values()].filter(m => !m || (m.canBeacon() && m.canUse(recipe)))
}

function slotPicker(current, choices, onPick, dim) {
    const slot = document.createElement("span")
    slot.className = current ? "slot slot-sm" : `slot slot-sm ${dim ? "dim" : ""}`.trim()
    if (current) {
        slot.appendChild(current.icon.make(20, true))
    }
    slot.addEventListener("click", () => {
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
        const choices = beaconChoices(row.recipe)
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
        span.appendChild(document.createTextNode(` ${spec.format.rate(amount)} ${RATE_LABEL[spec.format.rateName] || "/min"} ${ing.item.name}`))
        ingLine.appendChild(span)
    }
    const whereLink = document.createElement("a")
    whereLink.style.marginLeft = "auto"
    whereLink.style.cursor = "pointer"
    whereLink.textContent = "Where it goes →"
    whereLink.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("calc:where", { detail: { item: row.item.key } }))
    })
    ingLine.appendChild(whereLink)
    wrap.appendChild(ingLine)

    // Every widget above wants its own click (slot pickers, the beacon-count
    // input, the link) rather than toggling the row's expansion; stopping
    // it once here, on the wrapper, covers the wrapper's own whitespace too
    // instead of guarding each interactive child individually.
    wrap.addEventListener("click", event => event.stopPropagation())

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

    const { cell: machines, building, power } = machinesCell(row)
    div.appendChild(machines)

    div.appendChild(numSpan(spec.format.rate(row.itemRate), "c-out"))

    const belt = document.createElement("span")
    belt.className = "num muted c-belt"
    if (row.item.phase !== "fluid") {
        const beltText = spec.getBeltCount(row.itemRate).toDecimal(2)
        belt.dataset.value = beltText
        belt.textContent = beltText
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

    return { el: div, power: row.isReal ? power : zero }
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
            const { el, power } = renderRow(row)
            container.appendChild(el)
            totalBuildings += buildingCount(row)
            totalPower = totalPower.add(power)
        }
    }

    const totalsSpan = document.getElementById("factory-totals")
    if (totalsSpan) {
        totalsSpan.textContent = `${totalBuildings} buildings · ${formatPower(totalPower)}`
    }
}

export function initTable() {
    registerRenderer(renderTable)
}

// Shared with inputs.js: the same row shape (so the Inputs frame doesn't
// re-derive it), the power formatter for its Totals section, and
// buildingCount (needs spec.getBuilding/getCount) so both frames' totals
// always agree. inputs.js still imports this as `powerRepr`, so it is
// re-exported under that name rather than touching inputs.js.
export { buildRows, formatPower as powerRepr }
