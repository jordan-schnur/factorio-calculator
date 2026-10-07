// SPDX-License-Identifier: Apache-2.0 · Copyright 2019-2021 Kirk McDonald
import * as d3 from "d3"
import { DEFAULT_RATE, DEFAULT_RATE_PRECISION, DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT, DEFAULT_BELT_FORMAT } from "./align.js"
import { spec, DEFAULT_PLANET, DEFAULT_BELT, DEFAULT_FUEL } from "./factory.js"
import { beaconData, shortModules } from "./module.js"
import { Rational, zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { markOverride } from "./savesettings.js"
import { excludedMachines, parseRecipeMachines } from "./machines-core.js"
import { canBeacon, canUse, parseModuleList } from "./modules-core.js"
import { parseMachineQuality, qualityFromSave, splitModuleToken, tierOf as qualityTier } from "./quality-core.js"

// data set

// This setting is somewhat special and prompts a reset of the full calculator state.
class Modification {
    constructor(name, filename, legacy) {
        this.name = name
        this.filename = filename
        this.legacy = legacy
    }
}

export let MODIFICATIONS = new Map([
    ["2-0-55", new Modification("Vanilla 2.0.55", "vanilla-2.0.55.json", false)],
    ["1-1-110", new Modification("Vanilla 1.1.110", "vanilla-1.1.110.json", true)],
    ["1-1-110x", new Modification("Vanilla 1.1.110 - Expensive", "vanilla-1.1.110-expensive.json", true)],
    ["space-age-2-0-77", new Modification("Space Age 2.0.77 (this install)", "space-age-2.0.77.json", false)],
    ["space-age-2-0-55", new Modification("Space Age 2.0.55 (WORK IN PROGRESS)", "space-age-2.0.55.json", false)],
])

let DEFAULT_MODIFICATION = "space-age-2-0-77"

// Hard-coded version upgrades (ideally a generalized function).
var modUpdates = new Map([
    ["2-0-6", "2-0-55"],
    ["2-0-7", "2-0-55"],
    ["2-0-10", "2-0-55"],
    ["1-1-19", "1-1-110"],
    ["1-1-19x", "1-1-110x"],
    ["space-age-2-0-10", "space-age-2-0-55"],
    ["space-age-2-0-11", "space-age-2-0-55"],
])

function normalizeDataSetName(modName) {
    let newName = modUpdates.get(modName)
    if (newName !== undefined) {
        modName = newName
    }
    if (MODIFICATIONS.has(modName)) {
        return modName
    }
    return DEFAULT_MODIFICATION
}

let dataSet = DEFAULT_MODIFICATION

// Read once, at boot: the drawer shows it read-only, as search.js/board.js keep the boot dataset's catalog.
export function selectDataSet(settings) {
    dataSet = normalizeDataSetName(settings.get("data"))
}

export function currentMod() {
    return dataSet
}

// Each render* applies one fragment setting (or its default) to the spec; add new ones to fragment.js too.

// "tab=" in the fragment is a leftover key from before the redesign, read but no longer acted on.

// build targets

function renderTargets(settings) {
    spec.buildTargets = []
    d3.selectAll("#targets li.target").remove()

    let targetSetting = settings.get("items")
    if (targetSetting !== undefined && targetSetting !== "") {
        let targets = targetSetting.split(",")
        for (let targetString of targets) {
            let parts = targetString.split(":")
            let itemKey = parts[0]
            if (!spec.items.has(itemKey)) {
                console.log("unknown item:", itemKey)
                continue
            }
            let target = spec.addTarget(itemKey)
            let type = parts[1]
            if (type === "f") {
                let recipe = null
                if (parts.length > 3) {
                    let recipeKey = parts[3]
                    if (!spec.recipes.has(recipeKey)) {
                        console.log("unknown recipe:", recipeKey)
                        continue
                    }
                    recipe = spec.recipes.get(recipeKey)
                }
                target.setBuildings(parts[2], recipe)
                target.displayRecipes()
            } else if (type === "r") {
                target.setRate(parts[2])
            } else {
                throw new Error("unknown target type")
            }
        }
    }
    // No `items=` in the fragment: fresh opens show the empty state, not a default item.
}

// modules

function getModule(moduleKey) {
    let module
    if (spec.modules.has(moduleKey)) {
        module = spec.modules.get(moduleKey)
    } else if (shortModules.has(moduleKey)) {
        module = shortModules.get(moduleKey)
    } else if (moduleKey === "null") {
        module = null
    }
    if (module === undefined) {
        console.log("unknown module:", moduleKey)
        return null
    }
    return module
}

const NO_MODULE = {module: null, tier: "normal"}

// Module token from link, e.g. "p3" or "p3@legendary"; backstops handle unknown/empty modules.
function getModuleToken(token) {
    if (token === undefined || token === null) {
        return NO_MODULE
    }
    let {key, tier} = splitModuleToken(token)
    let module = getModule(key)
    return {module, tier: module === null ? "normal" : tier}
}

const MAX_BEACONS = 16

// Beacon count from link (0-16); non-numeric defaults to 0 to prevent crashes.
function parseBeaconCount(text, max = MAX_BEACONS) {
    let n = /^\d+$/.test(text ?? "") ? Number(text) : NaN
    return n <= max ? Rational.from_float(n) : zero
}

// Legacy beacon form "module:count"; even count puts module in both slots at half count.
function legacyBeaconCount(text) {
    let n = /^\d+$/.test(text) ? Number(text) : 0
    let both = n % 2 === 0
    let count = both ? n / 2 : n
    return {both, count: count <= MAX_BEACONS ? Rational.from_float(count) : zero}
}

// Buildings before modules; plan/machine layers before rows; layer slots overwritten by listed ones.
function renderModules(settings) {
    for (let entry of parseModuleList(settings.get("modules"))) {
        let recipe = spec.recipes.get(entry.key)
        if (recipe === undefined) {
            console.log("unknown recipe:", entry.key)
            continue
        }
        let moduleSpec = spec.getModuleSpec(recipe)
        if (moduleSpec === undefined) {
            console.log("no module slots:", entry.key)
            continue
        }
        for (let i = 0; i < entry.slots.length; i++) {
            if (entry.slots[i] !== "") {
                let {module, tier} = getModuleToken(entry.slots[i])
                moduleSpec.setModule(i, module, tier)
            }
        }
        if (entry.beacon !== null) {
            // Legacy form "module:count" vs. new form "b1:b2:count[:quality]".
            let first
            let second
            let count
            let beaconTier = "normal"
            if (entry.beacon.length === 2) {
                let single = getModuleToken(entry.beacon[0])
                let legacy = legacyBeaconCount(entry.beacon[1])
                first = single
                second = legacy.both ? single : NO_MODULE
                count = legacy.count
            } else {
                first = getModuleToken(entry.beacon[0])
                second = getModuleToken(entry.beacon[1])
                count = parseBeaconCount(entry.beacon[2])
                beaconTier = qualityTier(entry.beacon[3]).key
            }
            moduleSpec.setBeaconModule(first.module, 0, first.tier)
            moduleSpec.setBeaconModule(second.module, 1, second.tier)
            moduleSpec.setBeaconCount(count)
            moduleSpec.setBeaconTier(beaconTier)
        }
        // Hand-written links can name invalid modules; fall back to layers or empty slot.
        let resolved = null
        for (let i = 0; i < moduleSpec.modules.length; i++) {
            let module = moduleSpec.modules[i]
            if (module !== null && !canUse(module, recipe, moduleSpec.building)) {
                resolved = resolved || spec.resolveFor(recipe, moduleSpec.building)
                moduleSpec.setModule(i, resolved.modules[i] ?? null, resolved.moduleTiers[i])
            }
        }
        for (let i = 0; i < moduleSpec.beaconModules.length; i++) {
            let module = moduleSpec.beaconModules[i]
            if (module !== null && !canBeacon(module, beaconData.allowedEffects)) {
                moduleSpec.setBeaconModule(null, i)
            }
        }
        spec.handSet.add(recipe.key)
    }
}

// Machine layer `mm=<machine>:<m>:...;<b1>:<b2>:<count>[:<tier>],...`; runs after plan, before rows.
function renderMachineModules(settings) {
    let layer = new Map()
    for (let entry of parseModuleList(settings.get("mm"))) {
        let building = spec.buildingKeys.get(entry.key)
        if (building === undefined) {
            console.log("unknown machine:", entry.key)
            continue
        }
        // Hand-written links can name invalid modules; check once like `modules=`.
        let modules = []
        let moduleTiers = []
        for (let i = 0; i < building.moduleSlots; i++) {
            let key = entry.slots[i]
            let token = key === undefined || key === "" ? NO_MODULE : getModuleToken(key)
            let ok = token.module !== null && canUse(token.module, null, building)
            modules.push(ok ? token.module : null)
            moduleTiers.push(ok ? token.tier : "normal")
        }
        let beaconModules = [null, null]
        let beaconModuleTiers = ["normal", "normal"]
        let beaconCount = zero
        let beaconTier = "normal"
        if (entry.beacon !== null && entry.beacon.length >= 3) {
            let tokens = [getModuleToken(entry.beacon[0]), getModuleToken(entry.beacon[1])]
                .map(t => t.module !== null && !canBeacon(t.module, beaconData.allowedEffects) ? NO_MODULE : t)
            beaconModules = tokens.map(t => t.module)
            beaconModuleTiers = tokens.map(t => t.tier)
            beaconCount = parseBeaconCount(entry.beacon[2])
            beaconTier = qualityTier(entry.beacon[3]).key
        }
        layer.set(building.key, {modules, moduleTiers, beaconModules, beaconModuleTiers, beaconCount, beaconTier})
    }
    spec.setMachineLayer(layer)
}

// ignore

function renderIgnore(settings) {
    spec.ignore.clear()
    // UI will be rendered later, as part of the solution.
    let ignoreSetting = settings.get("ignore")
    if (ignoreSetting !== undefined && ignoreSetting !== "") {
        let ignore = ignoreSetting.split(",")
        for (let itemKey of ignore) {
            let item = spec.items.get(itemKey)
            if (item === undefined) {
                console.log("unknown item:", itemKey)
                continue
            }
            spec.ignore.add(item)
        }
    }
}

// out: leftovers sent out on purpose (byproducts.js), stored as keys not items.

function renderSendOut(settings) {
    spec.sendOut.clear()
    let setting = settings.get("out")
    if (setting !== undefined && setting !== "") {
        for (let key of setting.split(",")) {
            if (spec.items.has(key)) spec.sendOut.add(key)
        }
    }
}

// title

export const DEFAULT_TITLE = "Factorio Calculator"

// Tab title with nothing planned yet (search engines index this); kept in step with calc.html.
export const INTRO_TITLE = "Factorio Calculator – Space Age & 2.0 Production Ratios"

// Title setting (in fragment only); tab title otherwise names what the plan makes for history.
export let customTitle = ""

export function setTitle(s) {
    customTitle = s
    renderPageTitle(spec)
}

// Example: "Electronic circuit 60/min, Plastic bar 30/min · Factorio Calculator".
export function targetsTitle(targets) {
    let parts = targets.map(t => {
        let unit = t.unitSelect.value
        let amount = unit.startsWith("/") ? t.numInput.value + unit : t.numInput.value + " " + unit
        return t.item.name + " " + amount
    })
    return parts.length ? parts.join(", ") + " · " + DEFAULT_TITLE : INTRO_TITLE
}

function renderPageTitle(spec) {
    document.title = customTitle !== "" ? customTitle : targetsTitle(spec.buildTargets)
}

function renderTitle(settings) {
    setTitle(settings.has("title") ? decodeURIComponent(settings.get("title")) : "")
}

// display rate

function renderRateOptions(settings) {
    spec.format.setDisplayRate(settings.has("rate") ? settings.get("rate") : DEFAULT_RATE)
}

// precisions

function renderPrecisions(settings) {
    spec.format.ratePrecision = DEFAULT_RATE_PRECISION
    if (settings.has("rp")) {
        spec.format.ratePrecision = Number(settings.get("rp"))
    }
    spec.format.countPrecision = DEFAULT_COUNT_PRECISION
    if (settings.has("cp")) {
        spec.format.countPrecision = Number(settings.get("cp"))
    }
}

// value format

let displayFormats = new Map([
    ["d", "decimal"],
    ["r", "rational"],
])

function renderValueFormat(settings) {
    spec.format.displayFormat = DEFAULT_FORMAT
    if (settings.has("vf")) {
        spec.format.displayFormat = displayFormats.get(settings.get("vf"))
    }
}

// mining productivity

function renderBeltFormat(settings) {
    spec.format.beltFormat = settings.get("bf") === "d" ? "decimal" : DEFAULT_BELT_FORMAT
}

function renderMiningProd(settings) {
    let mprod = "0"
    if (settings.has("mprod")) {
        mprod = settings.get("mprod")
    }
    spec.miningProd = Rational.from_string(mprod).div(Rational.from_float(100))
}

// buildings

export function pickBuilding(building) {
    spec.setMinimumBuilding(building)
    markOverride("buildings")
    spec.updateSolution()
}

function renderBuildings(settings) {
    let groupSet = new Set()
    for (let [cat, group] of spec.buildings) {
        if (group.buildings.length > 1) {
            groupSet.add(group)
        }
    }
    for (let group of groupSet) {
        group.building = group.getDefault()
    }
    let nomach = settings.get("nomach")
    spec.setExcludedBuildings(nomach ? nomach.split(",") : [])
    if (settings.has("buildings")) {
        let buildingKeys = settings.get("buildings").split(",")
        for (let key of buildingKeys) {
            let building = spec.buildingKeys.get(key)
            if (building === undefined) {
                console.log("unknown building:", key)
                continue
            }
            spec.setMinimumBuilding(building)
        }
    }
    spec.setRecipeBuildings(parseRecipeMachines(settings.get("mach")))
}

// Planet switch re-derives save's default, unless user has set machines by hand.
function syncMachinesToPlanet() {
    let fetched = spec.saveState.fetched
    if (!fetched || !fetched.machines || spec.saveState.overrides.has("machines")) {
        return
    }
    let planets = [...spec.selectedPlanets].map(p => p.key)
    spec.setExcludedBuildings(excludedMachines(fetched.machines, planets))
}

// Planet switch re-derives save's machine quality, unless user has set it by hand.
function syncQualityToPlanet() {
    let fetched = spec.saveState.fetched
    if (!fetched || !fetched.machine_quality || spec.saveState.overrides.has("quality")) {
        return
    }
    let planets = [...spec.selectedPlanets].map(p => p.key)
    spec.setMachineQualityMap(qualityFromSave(fetched.machine_quality, planets))
}

// belt

function renderBelts(settings) {
    let beltKey = DEFAULT_BELT
    if (settings.has("belt")) {
        let b = settings.get("belt")
        if (spec.belts.has(b)) {
            beltKey = b
        } else {
            console.log("unknown belt:", b)
        }
    }
    spec.belt = spec.belts.get(beltKey)
}

// fuel

function renderFuel(settings) {
    let fuelKey = DEFAULT_FUEL
    if (settings.has("fuel")) {
        let f = settings.get("fuel")
        if (spec.fuels.has(f)) {
            fuelKey = f
        } else {
            console.log("unknown fuel:", f)
        }
    }
    spec.fuel = spec.fuels.get(fuelKey)
}

// Plan layer from dm/dm2 and db/dbc; Settings -> Modules draws it on every render.

function renderDefaultModule(settings) {
    let dm = settings.has("dm") ? getModuleToken(settings.get("dm")) : NO_MODULE
    let dm2 = settings.has("dm2") ? getModuleToken(settings.get("dm2")) : NO_MODULE
    spec.setDefaultModule(dm.module, dm.tier)
    spec.setSecondaryDefaultModule(dm2.module, dm2.tier)
}

// Legacy `db=` with even `dbc` puts module in both slots at half count; `dbq=` is beacon quality.
function renderDefaultBeacon(settings) {
    let defaultBeacon = [NO_MODULE, NO_MODULE]
    let defaultCount = zero
    let legacy = false
    if (settings.has("db")) {
        let keys = settings.get("db").split(":")
        if (keys.length === 1) {
            legacy = true
        }
        for (let i = 0; i < keys.length && i < 2; i++) {
            defaultBeacon[i] = getModuleToken(keys[i])
        }
    }
    if (legacy) {
        let parsed = legacyBeaconCount(settings.get("dbc") ?? "0")
        if (parsed.both) {
            defaultBeacon = [defaultBeacon[0], defaultBeacon[0]]
        }
        defaultCount = parsed.count
    } else if (settings.has("dbc")) {
        defaultCount = parseBeaconCount(settings.get("dbc"))
    }
    // Hand-written `db=` can name invalid modules; checked here like `modules=`/`mm=`.
    defaultBeacon = defaultBeacon.map(t => t.module !== null && !canBeacon(t.module, beaconData.allowedEffects) ? NO_MODULE : t)
    for (let i = 0; i < defaultBeacon.length; i++) {
        spec.setDefaultBeacon(defaultBeacon[i].module, i, defaultBeacon[i].tier)
    }
    spec.setDefaultBeaconCount(defaultCount)
    spec.setDefaultBeaconTier(settings.get("dbq"))
}

// Machine quality `mq=<machine>:<tier>,...` (1.3.0); unknown machines/tiers dropped gracefully.
function renderMachineQuality(settings) {
    spec.setMachineQualityMap(parseMachineQuality(settings.get("mq")))
}

// recipe disabling

function renderRecipes(settings) {
    let havePlanets = spec.planets && spec.planets.size > 1
    if (havePlanets) {
        let planetKeys = []
        if (settings.has("planet")) {
            let s = settings.get("planet")
            if (s !== "") {
                planetKeys = s.split(",")
            }
        } else {
            planetKeys = [DEFAULT_PLANET]
        }
        for (let key of planetKeys) {
            if (spec.planets.has(key)) {
                spec.selectPlanet(spec.planets.get(key))
            }
        }
    }

    if (settings.has("disable") || settings.has("enable")) {
        if (settings.has("disable")) {
            let keys = settings.get("disable").split(",")
            for (let k of keys) {
                let recipe = spec.recipes.get(k)
                if (recipe) {
                    spec.setDisable(recipe)
                }
            }
        }
        if (settings.has("enable")) {
            let keys = settings.get("enable").split(",")
            for (let k of keys) {
                let recipe = spec.recipes.get(k)
                if (recipe) {
                    spec.setEnable(recipe)
                }
            }
        }
    } else if (!havePlanets) {
        spec.setDefaultDisable()
    }
}

// A plain pick selects only that planet; `add` (shift-click) toggles it in the selection.
export function pickPlanet(planet, add) {
    if (!add) {
        spec.selectOnePlanet(planet)
    } else if (spec.selectedPlanets.has(planet)) {
        spec.unselectPlanet(planet)
    } else {
        spec.selectPlanet(planet)
    }
    syncMachinesToPlanet()
    syncQualityToPlanet()
    markOverride("planet")
    spec.updateSolution()
}

// resource priority

function renderResourcePriorities(settings) {
    spec.setDefaultPriority()
    if (settings.has("priority")) {
        let tiers = []
        let keys = settings.get("priority").split(";")
        outer: for (let tierStr of keys) {
            let tier = []
            for (let pair of tierStr.split(",")) {
                // Backward compatibility: reject old format and bail.
                if (pair.indexOf("=") === -1) {
                    console.log("bailing:", pair)
                    tiers = null
                    break outer
                }
                let [key, weightStr] = pair.split("=")
                if (!spec.isValidPriorityKey(key)) {
                    console.log("invalid priority key:", key)
                    continue
                }
                tier.push([key, Rational.from_string(weightStr)])
            }
            tiers.push(tier)
        }
        if (tiers !== null) {
            spec.setPriorities(tiers)
        }
    }
}

// The drawer's legacy parts, redrawn on every solve: the from-save panel and the override tags.

// From your save

function appendKV(container, label, build) {
    let row = container.append("div").classed("kv", true)
    row.append("span").classed("muted", true).style("width", "90px").text(label)
    build(row)
    return row
}

// `thing` is a game-data object with `.icon`/`.name` (Belt, Building, ...), or null.
function appendSetRow(container, label, thing, extra) {
    appendKV(container, label, row => {
        if (thing) {
            row.append("span").attr("class", "slot slot-sm").append(() => thing.icon.make(20, true))
            row.append("span").text(thing.name)
        } else {
            row.append("span").classed("muted", true).text("unknown")
        }
        if (extra) {
            row.append("span").classed("muted", true).style("margin-left", "auto").style("font-size", "13px").text(extra)
        }
    })
}

function renderFromSave() {
    let container = d3.select("#settings-fromsave")
    if (container.empty()) {
        return
    }
    container.selectAll("*").remove()

    let fetched = spec.saveState.fetched
    let saveLabel = spec.saveState.save === null
        ? "not following a save"
        : (fetched && fetched.save ? fetched.save.name : "newest")
    appendKV(container, "Save", row => {
        row.append("span")
            .style("background", "#1c1c1c")
            .style("padding", "4px 10px")
            .style("font-weight", "600")
            .style("flex", "1")
            .text(saveLabel)
    })
    appendKV(container, "Follow", row => {
        row.append("span")
            .attr("class", "check")
            .style("cursor", "pointer")
            .text(spec.saveState.follow ? "✓" : "")
            .on("click", () => {
                spec.saveState.follow = !spec.saveState.follow
                spec.setHash()
                spec.display()
            })
        row.append("span").text("Re-read the newest save every few minutes")
    })

    if (!fetched) {
        container.append("div").classed("muted", true).style("padding", "6px 2px").text("No save read yet.")
    } else {
        container.append("div").classed("sec", true).text("What it set")
        appendSetRow(container, "Belt", spec.belts && spec.belts.get(fetched.belt))
        appendSetRow(container, "Assembling", fetched.buildings.crafting && spec.buildingKeys.get(fetched.buildings.crafting))
        appendSetRow(container, "Smelting", fetched.buildings.smelting && spec.buildingKeys.get(fetched.buildings.smelting))
        appendSetRow(container, "Mining", fetched.buildings["basic-solid"] && spec.buildingKeys.get(fetched.buildings["basic-solid"]), `+${fetched.mining_productivity}% mining productivity`)
        let planet = spec.planets && spec.planets.get(fetched.planet)
        appendKV(container, "Planet", row => row.append("span").text(planet ? planet.name : fetched.planet))
        appendKV(container, "Recipes", row => row.append("span").text(`${fetched.disabled_recipes.length} recipes locked`))
        let saved = fetched.machine_quality
            ? qualityFromSave(fetched.machine_quality, [...spec.selectedPlanets].map(p => p.key))
            : new Map()
        let words = [...saved].map(([key, tier]) => `${(spec.buildingKeys.get(key) || {name: key}).name}: ${qualityTier(tier).name}`)
        appendKV(container, "Quality", row => row.append("span").text(words.length === 0 ? "every machine normal" : words.join(", ")))
    }

    appendKV(container, "", row => {
        row.style("padding-top", "8px").style("gap", "8px")
        row.select("span.muted").remove()
        row.append("button").attr("type", "button").attr("class", "btn btn-sm").text("Re-read now")
            .on("click", () => document.getElementById("save-picker").dispatchEvent(new Event("change")))
        row.append("button").attr("type", "button").attr("class", "btn btn-sm").text("Stop following")
            .on("click", () => {
                spec.saveState.follow = false
                spec.setHash()
                spec.display()
            })
        row.append("span").classed("muted", true).style("font-size", "13px").text("Overrides on the right win over these.")
    })
}

// Kept off spec, as reloadFromHash() replaces the spec and would revert it.
let roundMachinesChoice = true

export function setRoundMachines(on) {
    roundMachinesChoice = on
    spec.roundMachines = on
    spec.display()
}

// The "override"/"from save" tag of each FIELDS entry (savesettings-core.js), appended to its drawer row.
const OVERRIDE_ANCHORS = [
    [() => document.getElementById("belt_selector"), "belt"],
    [() => document.getElementById("building_selector"), "buildings"],
    [() => document.getElementById("machine_allow")?.parentElement, "machines"],
    [() => document.getElementById("machine_quality")?.parentElement, "quality"],
    [() => document.getElementById("mprod")?.parentElement, "mprod"],
    [() => document.getElementById("planet_setting_row"), "planet"],
    [() => document.getElementById("recipe_toggles")?.closest("details")?.querySelector(":scope > summary"), "recipes"],
]

function ensureOverrideTag(resolveHost) {
    let host = resolveHost()
    if (!host) {
        return null
    }
    let tag = host.querySelector(":scope > span.override-tag")
    if (!tag) {
        tag = document.createElement("span")
        tag.className = "muted override-tag needs-companion"
        tag.style.marginLeft = "auto"
        tag.style.fontSize = "13px"
        host.appendChild(tag)
    }
    return tag
}

function refreshOverrideTags() {
    for (let [resolveHost, field] of OVERRIDE_ANCHORS) {
        let tag = ensureOverrideTag(resolveHost)
        if (!tag) {
            continue
        }
        tag.textContent = spec.saveState.overrides.has(field)
            ? "override"
            : (spec.saveState.save !== null ? "from save" : "")
    }
}

function renderSettingsTab() {
    renderFromSave()
    refreshOverrideTags()
}

// init.js calls this once at boot, after the dataset loads.
export function initSettingsTab() {
    registerRenderer(renderSettingsTab)
    registerRenderer(renderPageTitle)
}

export function renderSettings(settings) {
    spec.roundMachines = roundMachinesChoice
    renderTitle(settings)
    renderIgnore(settings)
    renderSendOut(settings)
    renderRateOptions(settings)
    renderPrecisions(settings)
    renderValueFormat(settings)
    renderBeltFormat(settings)
    renderMiningProd(settings)
    renderBuildings(settings)
    renderMachineQuality(settings)
    renderBelts(settings)
    renderFuel(settings)
    renderDefaultModule(settings)
    renderDefaultBeacon(settings)
    renderMachineModules(settings)
    renderResourcePriorities(settings)
    renderRecipes(settings)
    renderTargets(settings)
    renderModules(settings)
}
