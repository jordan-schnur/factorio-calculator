import * as d3 from "d3"
// calc/header.js — topbar controls: view switch (table/graph), assembler
// tier, save line, settings drawer, and page-visibility (intro vs. table vs.
// graph) driven by spec.buildTargets/spec.view.
import { spec } from "./factory.js"
import { registerRenderer } from "./render.js"
import { markOverride } from "./savesettings.js"

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

// From spec.buildTargets/spec.view: which top-level frames show. The intro
// (no targets yet) hides everything below the search box; once there are
// targets, exactly one of #table-frame/#graph-frame is visible.
export function applyVisibility() {
    let makePanel = document.getElementById("make-panel")
    let hasTargets = spec.buildTargets.length > 0
    if (makePanel) makePanel.classList.toggle("intro", !hasTargets)

    let viewSeg = document.getElementById("view-seg")
    let boardButton = document.getElementById("board-button")
    let tableFrame = document.getElementById("table-frame")
    let graphFrame = document.getElementById("graph-frame")
    let footer = document.getElementById("footer")
    let scratchpadFrame = document.getElementById("scratchpad-frame")

    if (viewSeg) viewSeg.hidden = !hasTargets
    if (boardButton) boardButton.hidden = !hasTargets
    if (footer) footer.hidden = !hasTargets
    if (scratchpadFrame) scratchpadFrame.hidden = !hasTargets

    if (!hasTargets) {
        if (tableFrame) tableFrame.hidden = true
        if (graphFrame) graphFrame.hidden = true
        return
    }

    let view = spec.view === undefined ? "table" : spec.view
    if (tableFrame) tableFrame.hidden = view !== "table"
    if (graphFrame) graphFrame.hidden = view !== "graph"

    if (viewSeg) {
        for (let button of viewSeg.querySelectorAll("button[data-view]")) {
            button.classList.toggle("on", button.dataset.view === view)
        }
    }
}

function render(spec, totals) {
    renderAsmSeg(spec)
    renderSaveLine(spec)
    applyVisibility()
}

export function initHeader() {
    registerRenderer(render)

    let viewSeg = document.getElementById("view-seg")
    if (viewSeg) {
        viewSeg.addEventListener("click", event => {
            let button = event.target.closest("button[data-view]")
            if (!button) return
            spec.view = button.dataset.view
            spec.setHash()
            document.dispatchEvent(new CustomEvent("calc:view", {detail: {view: spec.view}}))
            applyVisibility()
        })
    }

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
