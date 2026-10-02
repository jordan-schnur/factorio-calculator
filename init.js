/*Copyright 2019 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { getBelts } from "./belt.js"
import { initBoard } from "./board.js"
import { getBuildings } from "./building.js"
import { initDetails } from "./details.js"
import { spec, resetSpec } from "./factory.js"
import { initFlow } from "./flow.js"
import { initFooter } from "./footer.js"
import { formatSettings, loadSettings, writeHash, isOwnHash } from "./fragment.js"
import { getFuel } from "./fuel.js"
import { getItemGroups } from "./group.js"
import { initHeader } from "./header.js"
import { getSprites } from "./icon.js"
import { getItems } from "./item.js"
import { initItemTable } from "./itemtable.js"
import { getModules } from "./module.js"
import { getPlanets } from "./planet.js"
import { getRecipes } from "./recipe.js"
import { registerRenderer } from "./render.js"
import { initSaveSettings, applySaveSettings } from "./savesettings.js"
import { initScratchpad } from "./scratchpad.js"
import { initSearch } from "./search.js"
import { currentMod, MODIFICATIONS, initSettingsTab, renderDataSetOptions, renderSettings } from "./settings.js"
import { initSource } from "./source.js"
import { initSupplied } from "./supplied.js"
import { initTargets } from "./targets.js"
import { reapTooltips } from "./tooltip.js"
import { applyColorblind } from "./colorblind.js"

export function changeMod() {
    let currentSettings = loadSettings("#" + formatSettings())
    currentSettings.delete("data")
    let modName = currentMod()
    writeHash("")
    resetSpec()
    applyPageState(currentSettings)
    loadData(modName, currentSettings)
}

// Re-parses the fragment into a fresh spec and re-solves. The UI modules are
// not re-initialized: their renderers are already registered, and renderAll()
// calls them again at the end of the solve.
// Every programmatic fragment write goes through here (or spec.setHash), so
// the hashchange listener below can tell our writes from back/forward.
export function navigateToHash(hash) {
    writeHash(hash)
    reloadFromHash()
}

export function reloadFromHash() {
    // Counted so the page tests can prove our own setHash() writes never
    // bounce back through the hashchange listener as a reload.
    window.__calcReloads = (window.__calcReloads || 0) + 1
    let settings = loadSettings(window.location.hash)
    resetSpec()
    applyPageState(settings)
    loadData(currentMod(), settings)
}

let OIL_EXCLUSION = new Map([
    ["basic", ["advanced-oil-processing"]],
    ["coal", ["advanced-oil-processing", "basic-oil-processing"]],
])

function fixLegacySettings(settings) {
    if ((settings.has("use_3") || settings.has("min") || settings.has("furnace")) && !settings.has("buildings")) {
        let parts = []
        if (settings.has("min")) {
            let n = settings.get("min")
            if (n === "4") {
                n = "3"
            }
            parts.push("assembling-machine-" + n)
            settings.delete("min")
        } else if (settings.has("use_3")) {
            parts.push("assembling-machine-3")
            settings.delete("use_3")
        }
        if (settings.has("furnace")) {
            parts.push(settings.get("furnace"))
            settings.delete("furnace")
        }
        settings.set("buildings", parts.join(","))
    }
    if ((settings.has("k") || settings.has("p")) && !settings.has("disable")) {
        let parts = []
        if (settings.has("k")) {
            settings.delete("k")
            parts.push("kovarex-processing")
        }
        if (settings.has("p")) {
            let p = settings.get("p")
            for (let r of OIL_EXCLUSION.get(p)) {
                parts.push(r)
            }
            settings.delete("p")
        }
        settings.set("disable", parts.join(","))
    }
}

// The page state that lives on the spec rather than in Kirk's render*
// functions. Runs before the dataset is loaded, so it must not call anything
// that reads the spec's game data -- notably spec.setHash().
function applyPageState(settings) {
    spec.saveState.save = settings.has("save") ? decodeURIComponent(settings.get("save")) : null
    spec.saveState.follow = settings.get("follow") === "1"
    let ov = settings.get("ov")
    spec.saveState.overrides = new Set(ov ? ov.split(",") : [])
    spec.whereItem = settings.has("item") ? settings.get("item") : null
    // Kirk's calculator links say "tab=graph" for its graph tab; with no
    // view= of our own, that opens our graph. Any other "tab=" (ours from
    // before the redesign, or Kirk's totals/settings) is still read so old
    // links round-trip, but is never acted on.
    let kirkGraph = !settings.has("view") && settings.get("tab") === "graph"
    spec.view = settings.get("view") === "graph" || kirkGraph ? "graph" : "table"
}

// display() is now nothing but renderAll(), so the bookkeeping it used to do
// runs as the first renderer: before any module renders, the fragment and the
// build-target inputs match the solution that is about to be drawn.
function renderHousekeeping(spec) {
    for (let target of spec.buildTargets) {
        target.getRate()
    }
    reapTooltips()
    spec.setHash()
}

let modulesInitialized = false

function initModules() {
    if (modulesInitialized) {
        return
    }
    modulesInitialized = true
    registerRenderer(renderHousekeeping)
    initSearch()
    initTargets()
    initSupplied()
    initScratchpad()
    initFlow()
    initSource()
    initSettingsTab()
    initBoard()
    initSaveSettings()
    initHeader()
    initItemTable()
    initDetails()
    initFooter()
}

export let useLegacyCalculation

function loadData(modName, settings) {
    let mod = MODIFICATIONS.get(modName)
    useLegacyCalculation = mod.legacy
    let filename = "data/" + mod.filename
    return d3.json(filename, {cache: "reload"}).then(function(data) {
        let items = getItems(data)
        let recipes = getRecipes(data, items)
        let planets = getPlanets(data, recipes)
        let modules = getModules(data, items)
        let buildings = getBuildings(data, items)
        let belts = getBelts(data)
        let fuel = getFuel(data, items)
        getSprites(data)
        let itemGroups = getItemGroups(items, data)
        spec.setData(items, recipes, planets, modules, buildings, belts, fuel, itemGroups)

        fixLegacySettings(settings)
        renderSettings(settings)

        initModules()

        spec.updateSolution()
    })
}

// setHash() writes a new history entry on every state change, so the
// browser's back/forward moves the fragment; nothing re-read it.
export function init() {
    applyColorblind()
    window.addEventListener("hashchange", () => {
        if (!isOwnHash(window.location.hash)) {
            reloadFromHash()
        }
    })
    let settings = loadSettings(window.location.hash)
    renderDataSetOptions(settings)
    applyPageState(settings)
    // applySaveSettings starts the follow timer, so it runs once per page
    // life -- not on the reloads it may itself trigger.
    loadData(currentMod(), settings).then(() => applySaveSettings(settings))
}
