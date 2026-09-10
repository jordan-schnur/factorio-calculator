// The "Supplied from elsewhere" chip strip and the Factory settings
// mini-list (both live in the left column, both driven off the same
// solve).
import { spec } from "./factory.js"
import { registerRenderer } from "./render.js"

// spec.format.rateName is the fragment key (s|m|h), not the display suffix.
const RATE_SUFFIX = new Map([["s", "s"], ["m", "min"], ["h", "h"]])

export function initSupplied() {
    document.addEventListener("calc:toggle-supplied", event => {
        let item = spec.items.get(event.detail.item)
        // A target can't be supplied from elsewhere: there would be nothing
        // left to compute. ensureTargetsProducible() would undo it anyway.
        if (item && !spec.buildTargets.some(t => t.item === item)) {
            // toggleIgnore alone doesn't re-solve; it only flips membership.
            spec.toggleIgnore(item)
            spec.updateSolution()
        }
    })
    registerRenderer(renderSupplied)
}

function renderSupplied(spec) {
    renderChips(spec)
    renderSettingsSummary(spec)
}

function renderChips(spec) {
    let container = document.getElementById("supplied-chips")
    if (!container) {
        return
    }
    container.textContent = ""
    if (spec.ignore.size === 0) {
        let empty = document.createElement("span")
        empty.className = "muted"
        empty.textContent = "Nothing yet. Once you have a factory, click an item's icon in the table to mark it as an input you bring in."
        container.appendChild(empty)
        return
    }
    for (let item of spec.ignore) {
        container.appendChild(makeChip(item))
    }
}

function makeChip(item) {
    let chip = document.createElement("span")
    chip.className = "chip"

    let slot = document.createElement("span")
    slot.className = "slot slot-sm"
    slot.appendChild(item.icon.make(20, true))
    chip.appendChild(slot)

    chip.appendChild(document.createTextNode(" " + item.name + " "))

    let remove = document.createElement("span")
    remove.className = "muted"
    remove.textContent = "×"
    remove.addEventListener("click", () => {
        spec.toggleIgnore(item)
        spec.updateSolution()
    })
    chip.appendChild(remove)

    return chip
}

function renderSettingsSummary(spec) {
    let container = document.getElementById("settings-summary")
    if (!container) {
        return
    }
    container.textContent = ""

    container.appendChild(beltRow(spec))
    container.appendChild(buildingRow(spec, "crafting"))
    container.appendChild(buildingRow(spec, "smelting"))
    container.appendChild(buildingRow(spec, "basic-solid", miningProdText(spec)))

    let notes = []
    if (spec.defaultModule === null && spec.defaultBeaconCount && spec.defaultBeaconCount.isZero()) {
        notes.push("No default modules, no beacons")
    }
    let planetNames = Array.from(spec.selectedPlanets || [])
        .map(planet => planet && planet.name)
        .filter(Boolean)
    if (planetNames.length > 0) {
        notes.push(planetNames.join(", "))
    }
    if (notes.length > 0) {
        let row = document.createElement("div")
        row.className = "kv"
        let note = document.createElement("span")
        note.className = "muted"
        note.textContent = notes.join(" · ")
        row.appendChild(note)
        container.appendChild(row)
    }
}

// Any of these can be missing before the dataset finishes loading or if a
// building group has no default; a dash beats a thrown renderer.
function buildingRow(spec, category, rightText) {
    let row = document.createElement("div")
    row.className = "kv"

    let building = null
    try {
        let group = spec.buildings && spec.buildings.get(category)
        building = group && group.building
    } catch (err) {
        building = null
    }

    if (building) {
        let slot = document.createElement("span")
        slot.className = "slot slot-sm"
        slot.appendChild(building.icon.make(20, true))
        row.appendChild(slot)

        let name = document.createElement("span")
        name.textContent = building.name
        row.appendChild(name)
    } else {
        let dash = document.createElement("span")
        dash.className = "muted"
        dash.textContent = "—"
        row.appendChild(dash)
    }

    if (rightText) {
        let right = document.createElement("span")
        right.className = "muted"
        right.style.marginLeft = "auto"
        right.textContent = rightText
        row.appendChild(right)
    }

    return row
}

function beltRow(spec) {
    let row = document.createElement("div")
    row.className = "kv"

    if (spec.belt) {
        let slot = document.createElement("span")
        slot.className = "slot slot-sm"
        slot.appendChild(spec.belt.icon.make(20, true))
        row.appendChild(slot)

        let name = document.createElement("span")
        name.textContent = spec.belt.name
        row.appendChild(name)

        let rate = document.createElement("span")
        rate.className = "muted num"
        rate.style.marginLeft = "auto"
        rate.textContent = spec.format.rate(spec.belt.rate) + "/" + (RATE_SUFFIX.get(spec.format.rateName) || spec.format.rateName)
        row.appendChild(rate)
    } else {
        let dash = document.createElement("span")
        dash.className = "muted"
        dash.textContent = "—"
        row.appendChild(dash)
    }

    return row
}

function miningProdText(spec) {
    if (!spec.miningProd) {
        return null
    }
    try {
        let percent = Math.round(spec.miningProd.toFloat() * 100)
        return "+" + percent + "% prod"
    } catch (err) {
        return null
    }
}
