// calc/header.js — Task 6 of the graph-first plan: assembler tier, rate
// unit, ledger toggle, settings drawer, save line.
import { registerRenderer } from "./render.js"

const LEDGER_KEY = "calc.ledger"

function readLedgerOpen() {
    try {
        let v = localStorage.getItem(LEDGER_KEY)
        return v === null ? true : v === "1"
    } catch (err) {
        return true
    }
}

function writeLedgerOpen(open) {
    try {
        localStorage.setItem(LEDGER_KEY, open ? "1" : "0")
    } catch (err) {
        // storage may be unavailable (private mode, quota); the toggle
        // still works for the current page load.
    }
}

function applyLedgerOpen(open) {
    writeLedgerOpen(open)
    let ledger = document.getElementById("ledger")
    let toggle = document.getElementById("ledger-toggle")
    if (ledger) ledger.hidden = !open
    if (toggle) toggle.classList.toggle("on", open)
    document.dispatchEvent(new CustomEvent("calc:layout"))
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
    seg.hidden = false
    if (lbl && lbl.classList.contains("lbl")) lbl.hidden = false
    seg.innerHTML = ""
    for (let building of group.buildings) {
        let tier = building.key.match(/(\d+)$/)
        let button = document.createElement("button")
        button.dataset.building = building.key
        button.textContent = tier ? tier[1] : building.name
        button.title = building.name
        button.classList.toggle("on", group.building === building)
        button.addEventListener("click", () => {
            spec.setMinimumBuilding(building)
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
    if (!fetched || !fetched.save) {
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
    applyLedgerOpen(readLedgerOpen())

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
        if (drawer && !drawer.hidden) closeSettings()
    })
}
