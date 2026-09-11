// calc/header.js — topbar controls: assembler tier, rate unit, ledger
// drawer toggle, settings drawer, save line.
import { registerRenderer } from "./render.js"
import { markOverride } from "./savesettings.js"

// The ledger is an overlay drawer over the graph: opening it changes no
// layout and requires no refit. Closed on every load.
function applyLedgerOpen(open) {
    let ledger = document.getElementById("ledger")
    let toggle = document.getElementById("ledger-toggle")
    let frame = document.getElementById("flow-frame")
    if (ledger) ledger.hidden = !open
    if (toggle) toggle.classList.toggle("on", open)
    if (frame) frame.classList.toggle("ledger-open", open)
}

function openSettings() {
    let drawer = document.getElementById("settings-drawer")
    if (drawer) drawer.hidden = false
}

function closeSettings() {
    let drawer = document.getElementById("settings-drawer")
    if (drawer) drawer.hidden = true
}

function assemblingGroup(spec) {
    for (let group of new Set(spec.buildings.values())) {
        if (group.buildings.some(b => b.key.startsWith("assembling-machine"))) {
            return group
        }
    }
    return null
}

function furnaceGroup(spec) {
    for (let group of new Set(spec.buildings.values())) {
        if (group.buildings.some(b => b.key.includes("furnace"))) {
            return group
        }
    }
    return null
}

function renderAsmSeg(spec) {
    let seg = document.getElementById("asm-seg")
    if (!seg) return
    let lbl = seg.previousElementSibling
    let group = assemblingGroup(spec)
    if (!group) {
        seg.hidden = true
        if (lbl && lbl.classList.contains("lbl")) lbl.hidden = true
        return
    }
    let tiers = group.buildings
        .filter(b => b.key.startsWith("assembling-machine"))
        .sort((a, b) => Number(a.key.match(/(\d+)$/)[1]) - Number(b.key.match(/(\d+)$/)[1]))
    if (tiers.length === 0) {
        seg.hidden = true
        if (lbl && lbl.classList.contains("lbl")) lbl.hidden = true
        return
    }
    seg.hidden = false
    if (lbl && lbl.classList.contains("lbl")) lbl.hidden = false
    seg.innerHTML = ""
    for (let building of tiers) {
        let tier = building.key.match(/(\d+)$/)[1]
        let button = document.createElement("button")
        button.dataset.building = building.key
        button.textContent = tier
        button.title = building.name
        button.classList.toggle("on", group.building === building)
        button.addEventListener("click", () => {
            spec.setMinimumBuilding(building)
            markOverride("buildings")
            // buildingHandler in settings.js refreshes this same slot
            // highlight itself, since it's not touched by any registered
            // renderer -- mirror it so the drawer doesn't show a stale pick.
            d3.selectAll("#building_selector button.slot")
                .classed("sel", b => spec.getBuildingGroup(b).building === b)
            spec.updateSolution()
        })
        seg.appendChild(button)
    }
}

function renderRateSeg(spec) {
    let seg = document.getElementById("rate-seg")
    if (!seg) return
    let rateName = spec.format.rateName
    for (let button of seg.querySelectorAll("button[data-rate]")) {
        button.classList.toggle("on", button.dataset.rate === rateName)
    }
}

function renderSaveLine(spec) {
    let line = document.getElementById("save-line")
    if (!line) return
    let fetched = spec.saveState && spec.saveState.fetched
    if (!fetched || !fetched.save || !spec.saveState.follow) {
        line.textContent = "not following a save"
        return
    }
    let name = fetched.save.name
    let planets = Array.from(spec.selectedPlanets).map(p => p.name).join(", ")
    let belt = spec.belt.name
    let group = furnaceGroup(spec)
    let furnace = group ? group.building.name : ""
    line.textContent = `Reading ${name} · ${planets} · ${belt} · ${furnace}`
}

function render(spec, totals) {
    renderRateSeg(spec)
    renderAsmSeg(spec)
    renderSaveLine(spec)
}

function rateButtonClick(button) {
    let rate = button.dataset.rate
    let radio = document.querySelector(`#display_rate input[value="${rate}"]`)
    if (!radio) return
    radio.checked = true
    radio.dispatchEvent(new Event("change", {bubbles: true}))
}

export function initHeader() {
    registerRenderer(render)

    let rateSeg = document.getElementById("rate-seg")
    if (rateSeg) {
        rateSeg.addEventListener("click", event => {
            let button = event.target.closest("button[data-rate]")
            if (button) rateButtonClick(button)
        })
    }

    let ledgerToggle = document.getElementById("ledger-toggle")
    if (ledgerToggle) {
        ledgerToggle.addEventListener("click", () => {
            let ledger = document.getElementById("ledger")
            applyLedgerOpen(ledger ? ledger.hidden : false)
        })
    }
    document.addEventListener("calc:ledger", event => {
        applyLedgerOpen(event.detail.open)
    })
    applyLedgerOpen(false)

    let settingsOpen = document.getElementById("settings-open")
    if (settingsOpen) settingsOpen.addEventListener("click", openSettings)
    let settingsClose = document.getElementById("settings-close")
    if (settingsClose) settingsClose.addEventListener("click", closeSettings)
    let drawer = document.getElementById("settings-drawer")
    if (drawer) {
        drawer.addEventListener("click", event => {
            if (event.target === drawer) closeSettings()
        })
    }
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return
        let drawer = document.getElementById("settings-drawer")
        if (drawer && !drawer.hidden) { closeSettings(); return }
        let ledger = document.getElementById("ledger")
        if (ledger && !ledger.hidden) applyLedgerOpen(false)
    })
}
