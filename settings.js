/*Copyright 2019-2021 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { DEFAULT_RATE, DEFAULT_RATE_PRECISION, DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT, longRateNames } from "./align.js"
import { spec, DEFAULT_PLANET, DEFAULT_BELT, DEFAULT_FUEL, buildingSort } from "./factory.js"
import { getRecipeGroups } from "./groups.js"
import { changeMod } from "./init.js"
import { shortModules, moduleRows, moduleDropdown } from "./module.js"
import { Rational, zero } from "./rational.js"
import { registerRenderer } from "./render.js"
import { markOverride, clearOverrides } from "./savesettings.js"
import { excludedMachines } from "./machines-core.js"
import { sorted } from "./sort.js"

// Category keys (spec.buildings' Map keys, also the C5 payload's
// `buildings.<key>` names) that get a friendly label in the "From your
// save"/Overrides panels; anything else falls back to a title-cased key.
const CATEGORY_LABELS = new Map([
    ["crafting", "Assembling"],
    ["smelting", "Smelting"],
    ["basic-solid", "Mining"],
])

// data set

// This setting is somewhat special. It prompts a reset of the full calculator
// state.
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

// Ideally we'd write this as a generalized function, but for now we can hard-
// code these version upgrades.
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

// Unlike most "renderSetting" functions, this is called exactly once, on
// initialization, and so does not need to wipe and re-render its UI elements.
export function renderDataSetOptions(settings) {
    let modSelector = document.getElementById("data_set")
    d3.select(modSelector).on("change", function(event) {
        changeMod()
    })
    let configuredMod = normalizeDataSetName(settings.get("data"))
    for (let [modName, mod] of MODIFICATIONS) {
        let option = document.createElement("option")
        option.textContent = mod.name
        option.value = modName
        if (configuredMod && configuredMod === modName || !configuredMod && modName === DEFAULT_MODIFICATION) {
            option.selected = true
        }
        modSelector.appendChild(option)
    }
    // The mock shows this as read-only text: search.js/board.js build their
    // catalog entries once per page life off the dataset that was loaded at
    // boot, so switching data sets from here without a full reload would
    // leave them stale.
    modSelector.disabled = true
}

// Returns currently-selected data set.
export function currentMod() {
    let elem = document.getElementById("data_set")
    return elem.value
}

// There are several things going on with this control flow. Settings should
// work like this:
// 1) Settings are parsed from the URL fragment into the settings Map.
// 2) Each setting's `render` function is called.
// 3) If the setting is not present in the map, a default value is used.
// 4) The setting is applied.
// 5) The setting's GUI is placed into a consistent state.
// Remember to add the setting to fragment.js, too!

// The page is one screen now (calc/events.js); "tab=" in the fragment is a
// leftover key from before the redesign, read but no longer acted on.

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
    // No `items=` in the fragment: unlike upstream Kirk, a fresh open shows
    // the empty state (calc.html's #flow-empty) rather than a default item.
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

// NOTE: Buildings must be configured before modules!
function renderModules(settings) {
    let two = Rational.from_float(2)
    let moduleString = settings.get("modules")
    if (moduleString !== undefined && moduleString !== "") {
        for (let recipeSetting of moduleString.split(",")) {
            let [buildingModuleSettings, beaconSettings] = recipeSetting.split(";")
            let [recipeKey, ...moduleKeyList] = buildingModuleSettings.split(":")
            let recipe = spec.recipes.get(recipeKey)
            if (recipe === undefined) {
                console.log("unknown recipe:", recipeKey)
                continue
            }
            let moduleSpec = spec.getModuleSpec(recipe)
            for (let i = 0; i < moduleKeyList.length; i++) {
                let moduleKey = moduleKeyList[i]
                if (moduleKey === "") {
                    continue
                }
                let module = getModule(moduleKey)
                if (module !== undefined) {
                    moduleSpec.setModule(i, module)
                }
            }
            if (beaconSettings !== undefined) {
                let beaconParts = beaconSettings.split(":")
                // The legacy beacon config was simply in the form
                // "module:module count". If the count is even, then it is
                // adapted to the new format by dividing it by two and placing
                // the specified module in both slots. Otherwise, a single slot
                // is filled and the count is used as the beacon count.
                let module1
                let module2
                let count
                if (beaconParts.length === 2) {
                    let module = getModule(beaconParts[0])
                    count = Rational.from_string(beaconParts[1])
                    let divmod = count.divmod(two)
                    if (divmod.remainder.isZero()) {
                        module1 = module
                        module2 = module
                        count = divmod.quotient
                    } else {
                        module1 = module
                        module2 = null
                    }
                } else {
                    module1 = getModule(beaconParts[0])
                    module2 = getModule(beaconParts[1])
                    count = Rational.from_string(beaconParts[2])
                }
                moduleSpec.setBeaconModule(module1, 0)
                moduleSpec.setBeaconModule(module2, 1)
                moduleSpec.setBeaconCount(count)
            }
        }
    }
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

// title

export const DEFAULT_TITLE = "Factorio Calculator"

export function setTitle(s) {
    if (s === "") {
        document.title = DEFAULT_TITLE
    } else {
        document.title = s
    }
}

function renderTitle(settings) {
    let input = d3.select("#title_setting").node()
    let title = ""
    if (settings.has("title")) {
        title = decodeURIComponent(settings.get("title"))
    }
    input.value = title
    setTitle(title)
}

// display rate

function rateHandler() {
    spec.format.setDisplayRate(this.value)
    spec.display()
}

function renderRateOptions(settings) {
    let rateName = DEFAULT_RATE
    if (settings.has("rate")) {
        rateName = settings.get("rate")
    }
    spec.format.setDisplayRate(rateName)
    let rates = []
    for (let [rateName, longRateName] of longRateNames) {
        rates.push({rateName, longRateName})
    }
    let form = d3.select("#display_rate")
    form.selectAll("*").remove()
    let rateOption = form.selectAll("span")
        .data(rates)
        .join("span")
    rateOption.append("input")
        .attr("id", d => d.rateName + "_rate")
        .attr("type", "radio")
        .attr("name", "rate")
        .attr("value", d => d.rateName)
        .property("checked", d => d.rateName === rateName)
        .on("change", rateHandler)
    rateOption.append("label")
        .attr("for", d => d.rateName + "_rate")
        .text(d => "items/" + d.longRateName)
    rateOption.append("br")
}

// precisions

function renderPrecisions(settings) {
    spec.format.ratePrecision = DEFAULT_RATE_PRECISION
    if (settings.has("rp")) {
        spec.format.ratePrecision = Number(settings.get("rp"))
    }
    d3.select("#rprec").attr("value", spec.format.ratePrecision)
    spec.format.countPrecision = DEFAULT_COUNT_PRECISION
    if (settings.has("cp")) {
        spec.format.countPrecision = Number(settings.get("cp"))
    }
    d3.select("#cprec").attr("value", spec.format.countPrecision)
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
    let input = document.getElementById(spec.format.displayFormat + "_format")
    input.checked = true
}

// mining productivity

function renderMiningProd(settings) {
    let mprod = "0"
    if (settings.has("mprod")) {
        mprod = settings.get("mprod")
    }
    let mprodInput = document.getElementById("mprod")
    mprodInput.value = mprod
    spec.miningProd = Rational.from_string(mprod).div(Rational.from_float(100))
    // calc.html wires #mprod's own onchange to handlers.changeMprod (which
    // sets spec.miningProd and re-solves); this is an *additional* listener
    // (own d3 namespace, doesn't replace the inline one) so a save-derived
    // mprod stays "from save" but a hand edit marks the override.
    d3.select("#mprod").on("change.override", () => markOverride("mprod"))
}

// buildings

function categoryLabel(group) {
    let cats = []
    for (let [cat, g] of spec.buildings) {
        if (g === group) {
            cats.push(cat)
        }
    }
    for (let cat of cats) {
        if (CATEGORY_LABELS.has(cat)) {
            return CATEGORY_LABELS.get(cat)
        }
    }
    if (cats.length > 0) {
        return cats[0].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    }
    return "Building"
}

function buildingHandler(building) {
    spec.setMinimumBuilding(building)
    markOverride("buildings")
    // updateSolution()'s renderAll pass refreshes everything else, but the
    // slot highlight itself must update here: it's this function's own DOM,
    // not something any registered renderer touches.
    d3.selectAll("#building_selector button.slot")
        .classed("sel", b => spec.getBuildingGroup(b).building === b)
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

    // It doesn't really matter how we order these, but pick something just to
    // make it consistent.
    let groups = sorted(groupSet, g => g.getDefault().name)
    let div = d3.select("#building_selector")
    div.selectAll("*").remove()
    let rows = div.selectAll("div.kv")
        .data(groups)
        .join("div")
            .classed("kv", true)
    rows.append("span")
        .classed("muted", true)
        .style("width", "110px")
        .text(categoryLabel)
    let slots = rows.append("span").style("display", "flex").style("gap", "4px")
    slots.selectAll("button.slot")
        .data(d => d.buildings)
        .join("button")
            .attr("type", "button")
            .attr("class", b => "slot" + (spec.getBuildingGroup(b).building === b ? " sel" : ""))
            .attr("title", b => b.name)
            .on("click", (event, b) => buildingHandler(b))
            .append(b => b.icon.make(28, false))
    renderMachineAllow()
}

// Settings -> Machines -> Available: every machine in a multi-machine group
// as an on/off slot. Off machines are never planned with (factory.js's
// excludedBuildings); the save sets the default and a click overrides it.
function renderMachineAllow() {
    let machines = []
    for (let group of new Set(spec.buildings.values())) {
        if (group.buildings.length > 1) {
            machines.push(...group.buildings)
        }
    }
    machines = sorted(new Set(machines), b => b.name)
    let div = d3.select("#machine_allow")
    div.selectAll("*").remove()
    div.style("display", "flex").style("flex-wrap", "wrap").style("gap", "4px")
    div.selectAll("button.slot")
        .data(machines)
        .join("button")
            .attr("type", "button")
            .attr("class", b => "slot" + (spec.excludedBuildings.has(b.key) ? " off" : ""))
            .attr("title", b => b.name + (spec.excludedBuildings.has(b.key) ? " (off)" : ""))
            .on("click", (event, b) => {
                spec.toggleExcludedBuilding(b)
                markOverride("machines")
                renderMachineAllow()
                spec.updateSolution()
            })
            .append(b => b.icon.make(28, false))
}

// A planet switch re-derives the save's default for the new planet, unless
// the user has set the machines by hand.
function syncMachinesToPlanet() {
    let fetched = spec.saveState.fetched
    if (!fetched || !fetched.machines || spec.saveState.overrides.has("machines")) {
        return
    }
    let planets = [...spec.selectedPlanets].map(p => p.key)
    spec.setExcludedBuildings(excludedMachines(fetched.machines, planets))
    renderMachineAllow()
}

// belt

function beltSummaryText() {
    return `${spec.belt.name} · ${spec.format.rate(spec.belt.rate)}/${spec.format.longRate} · ${spec.format.rate(spec.belt.rate.div(Rational.from_float(2)))} per lane`
}

function beltHandler(belt) {
    spec.belt = belt
    markOverride("belt")
    // As with buildingHandler: the slot highlight and the summary text are
    // this function's own DOM, not refreshed by any registered renderer.
    d3.selectAll("#belt_selector button.slot").classed("sel", d => d === belt)
    d3.select("#belt_selector span.belt-summary").text(beltSummaryText)
    spec.display()
}

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

    let belts = []
    for (let [beltKey, belt] of spec.belts) {
        belts.push(belt)
    }
    let form = d3.select("#belt_selector")
    form.selectAll("*").remove()
    form.selectAll("button.slot")
        .data(belts)
        .join("button")
            .attr("type", "button")
            .attr("class", d => "slot" + (d === spec.belt ? " sel" : ""))
            .attr("title", d => d.name)
            .on("click", (event, d) => beltHandler(d))
            .append(d => d.icon.make(28, false))
    form.append("span")
        .classed("muted belt-summary", true)
        .style("margin-left", "10px")
        .style("font-size", "13px")
        .text(beltSummaryText)
}

// fuel

function fuelHandler(fuel) {
    spec.fuel = fuel
    d3.selectAll("#fuel_selector button.slot").classed("sel", d => d === fuel)
    spec.updateSolution()
}

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

    let fuels = Array.from(spec.fuels.values())
    let form = d3.select("#fuel_selector")
    form.selectAll("*").remove()
    form.selectAll("button.slot")
        .data(fuels)
        .join("button")
            .attr("type", "button")
            .attr("class", d => "slot" + (d === spec.fuel ? " sel" : ""))
            .attr("title", d => d.name)
            .on("click", (event, d) => fuelHandler(d))
            .append(d => d.icon.make(28, false))
    form.append("span")
        .classed("muted", true)
        .style("margin-left", "10px")
        .style("font-size", "13px")
        .text("for boilers and burner machines")
}

// default module

class DefaultModuleInput {
    constructor(cell, module) {
        this.cell = cell
        this.module = module
    }
    checked() {
        return this.module === spec.defaultModule
    }
    choose() {
        spec.setDefaultModule(this.module)
        spec.updateSolution()
    }
}
class DefaultModuleCell {
    constructor() {
        this.name = "default_module_dropdown"
        this.inputRows = []
        for (let row of moduleRows) {
            let inputRow = []
            for (let module of row) {
                inputRow.push(new DefaultModuleInput(this, module))
            }
            this.inputRows.push(inputRow)
        }
    }
}
class SecondaryModuleInput {
    constructor(cell, module) {
        this.cell = cell
        this.module = module
    }
    checked() {
        return this.module === spec.secondaryDefaultModule
    }
    choose() {
        spec.setSecondaryDefaultModule(this.module)
        spec.updateSolution()
    }
}
class SecondaryModuleCell {
    constructor() {
        this.name = "secondary_module_dropdown"
        this.inputRows = []
        for (let row of moduleRows) {
            let inputRow = []
            for (let module of row) {
                inputRow.push(new SecondaryModuleInput(this, module))
            }
            this.inputRows.push(inputRow)
        }
    }
}

function renderDefaultModule(settings) {
    let defaultModule = null
    if (settings.has("dm")) {
        defaultModule = getModule(settings.get("dm"))
    }
    spec.setDefaultModule(defaultModule)
    let secondaryModule = null
    if (settings.has("dm2")) {
        secondaryModule = getModule(settings.get("dm2"))
    }
    spec.setSecondaryDefaultModule(secondaryModule)

    let cell = new DefaultModuleCell()
    let select = d3.select("#default_module")
    select.selectAll("*").remove()
    moduleDropdown(select, [cell])
    cell = new SecondaryModuleCell()
    select = d3.select("#secondary_module")
    select.selectAll("*").remove()
    moduleDropdown(select, [cell])
}

// default beacon

class DefaultBeaconInput {
    constructor(cell, module) {
        this.cell = cell
        this.module = module
    }
    checked() {
        return this.module === spec.defaultBeacon[this.cell.index]
    }
    choose() {
        let self = this
        let oldModule = spec.defaultBeacon[this.cell.index]
        spec.setDefaultBeacon(this.module, this.cell.index)
        if (this.cell.index === 0) {
            let modules = spec.defaultBeacon
            if (oldModule === modules[1]) {
                spec.setDefaultBeacon(this.module, 1)
                d3.selectAll("#default_beacon span.module-wrapper:nth-child(2) input")
                    .property("checked", d => self.module === d.module)
            }
        }
        spec.updateSolution()
    }
}
class DefaultBeaconCell {
    constructor(index) {
        this.name = `default_beacon_dropdown_${index}`
        this.index = index
        this.inputRows = []
        for (let row of moduleRows) {
            let inputRow = []
            for (let module of row) {
                if (module === null || module.canBeacon()) {
                    inputRow.push(new DefaultBeaconInput(this, module))
                }
            }
            this.inputRows.push(inputRow)
        }
    }
}

function renderDefaultBeacon(settings) {
    let defaultBeacon = [null, null]
    let defaultCount = zero
    let legacy = false
    if (settings.has("db")) {
        let keys = settings.get("db").split(":")
        if (keys.length === 1) {
            legacy = true
        }
        for (let i = 0; i < keys.length; i++) {
            defaultBeacon[i] = getModule(keys[i])
        }
    }
    if (settings.has("dbc")) {
        defaultCount = Rational.from_string(settings.get("dbc"))
    }
    if (legacy) {
        let two = Rational.from_float(2)
        let divmod = defaultCount.divmod(two)
        if (divmod.remainder.isZero()) {
            defaultBeacon = [defaultBeacon[0], defaultBeacon[0]]
            defaultCount = divmod.quotient
        }
    }
    for (let i = 0; i < defaultBeacon.length; i++) {
        spec.setDefaultBeacon(defaultBeacon[i], i)
    }
    spec.setDefaultBeaconCount(defaultCount)

    let cells = [new DefaultBeaconCell(0), new DefaultBeaconCell(1)]
    let select = d3.select("#default_beacon")
    select.selectAll("*").remove()
    moduleDropdown(select, cells)
    d3.select("#default_beacon_count")
        .attr("value", defaultCount.toDecimal())
        .on("change", (event) => {
            spec.setDefaultBeaconCount(Rational.from_string(event.target.value))
            spec.updateSolution()
        })
}

// recipe disabling

function renderRecipes(settings) {
    let havePlanets = spec.planets && spec.planets.size > 1
    let planetRow = d3.select("#planet_setting_row")
    if (havePlanets) {
        planetRow.style("display", null)
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
    } else {
        planetRow.style("display", "none")
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

    let planetDiv = d3.select("#planet_selector")
    planetDiv.selectAll("*").remove()
    if (havePlanets) {
        let planets = sorted(spec.planets.values(), p => p.order)
        planetDiv.selectAll("span.radio")
            .data(planets)
            .join("span")
                .attr("class", "radio")
                .style("cursor", "pointer")
                .each(function(d) {
                    d3.select(this).append("span")
                        .classed("check", true)
                        .text(spec.selectedPlanets.has(d) ? "✓" : "")
                    d3.select(this).append(() => new Text(" " + d.name))
                })
                .on("click", function(event, d) {
                    if (event.shiftKey) {
                        event.preventDefault()
                        let selected = spec.selectedPlanets.has(d)
                        if (selected) {
                            spec.unselectPlanet(d)
                        } else {
                            spec.selectPlanet(d)
                        }
                    } else {
                        spec.selectOnePlanet(d)
                    }
                    d3.selectAll("#planet_selector span.check")
                        .text(dd => spec.selectedPlanets.has(dd) ? "✓" : "")
                    d3.selectAll("#recipe_toggles .toggle")
                        .classed("selected", d => !spec.disable.has(d))
                    syncMachinesToPlanet()
                    markOverride("planet")
                    spec.updateSolution()
                })
    }

    let allGroups = getRecipeGroups(new Set(spec.recipes.values()))
    let groups = []
    for (let group of allGroups) {
        if (group.size > 1) {
            groups.push(sorted(group, d => d.order))
        }
    }

    let div = d3.select("#recipe_toggles")
        .classed("toggle-list", true)
    div.selectAll("*").remove()
    let recipe = div.selectAll("div")
        .data(groups)
        .join("div")
            .classed("toggle-row", true)
            .selectAll("div")
            .data(d => d)
            .join("div")
                .classed("toggle recipe", true)
                .classed("selected", d => !spec.disable.has(d))
                .on("click", function(event, d) {
                    let disabled = spec.disable.has(d)
                    d3.select(this).classed("selected", disabled)
                    if (disabled) {
                        spec.setEnable(d)
                    } else {
                        spec.setDisable(d)
                    }
                    markOverride("recipes")
                    spec.updateSolution()
                })
    recipe.append(d => d.icon.make(32))
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
                // Backward compatibility: If this is using the old format,
                // ignore the whole thing and bail.
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

// --- the Settings tab: from-save panel, Machines precision toggle, and the
// override tags beside the Overrides frame's fields. The controls those
// fields render into (belt/building slots, planet checks, recipe toggles,
// ...) are (re)built by the render* functions above, only when the fragment
// is (re)loaded; this section refreshes cheaply, on every solve. ---

// From your save

function appendKV(container, label, build) {
    let row = container.append("div").classed("kv", true)
    row.append("span").classed("muted", true).style("width", "90px").text(label)
    build(row)
    return row
}

// `thing` is any game-data object with `.icon`/`.name` (Belt, Building, ...),
// or null/undefined when the save didn't tell us (an empty `buildings: {}`,
// e.g. before calcroutes has read a save).
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

// Display: "Machines: rounded up / exact", bound to spec.roundMachines
// (read by table.js). calc.html has no id for this row (it predates
// roundMachines), so it's built once, on demand, into #settings-display.
//
// The choice itself lives here, not only on spec: reloadFromHash() calls
// resetSpec(), which throws the old spec (and any field hung off it) away,
// so a value kept solely on spec.roundMachines would silently revert to the
// default on the next save-driven reload.
let roundMachinesChoice = true

function renderMachinesToggle() {
    let display = document.getElementById("settings-display")
    if (!display) {
        return
    }
    let row = document.getElementById("machines-round-toggle")
    if (!row) {
        row = document.createElement("div")
        row.id = "machines-round-toggle"
        row.className = "kv"
        let label = document.createElement("span")
        label.className = "muted"
        label.style.width = "90px"
        label.textContent = "Machines"
        row.appendChild(label)
        for (let [value, text] of [["up", "rounded up"], ["exact", "exact"]]) {
            let option = document.createElement("span")
            option.className = "radio"
            option.style.cursor = "pointer"
            option.dataset.value = value
            let dot = document.createElement("span")
            dot.className = "dot"
            option.appendChild(dot)
            option.appendChild(document.createTextNode(text))
            option.addEventListener("click", () => {
                roundMachinesChoice = value === "up"
                spec.roundMachines = roundMachinesChoice
                spec.display()
            })
            row.appendChild(option)
        }
        display.appendChild(row)
    }
    for (let option of row.querySelectorAll(".radio")) {
        option.querySelector(".dot").classList.toggle("on", (option.dataset.value === "up") === spec.roundMachines)
    }
}

// Overrides: "Reset all" and the per-field "override"/"from save" tags.
// FIELDS in savesettings-core.js; each anchor resolves to an element this
// file already fully owns the *contents* of (belt/building/planet
// selectors), or, for #mprod, its parent .kv row (calc.html's own markup),
// or, for recipes, the collapsed <details>' own summary row (#recipe_toggles
// itself is hidden until the details is opened).
const OVERRIDE_ANCHORS = [
    [() => document.getElementById("belt_selector"), "belt"],
    [() => document.getElementById("building_selector"), "buildings"],
    [() => document.getElementById("machine_allow")?.parentElement, "machines"],
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
        tag.className = "muted override-tag"
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

// calc.html's Overrides titlebar already carries "anything you set here
// sticks until you reset it"; this row is just the button.
function ensureResetAllButton() {
    let container = document.getElementById("settings-overrides")
    if (!container || document.getElementById("overrides-reset-all")) {
        return
    }
    let row = document.createElement("div")
    row.className = "kv"
    let btn = document.createElement("button")
    btn.id = "overrides-reset-all"
    btn.type = "button"
    btn.className = "btn btn-sm"
    btn.textContent = "Reset all"
    btn.addEventListener("click", () => clearOverrides())
    row.appendChild(btn)
    container.insertBefore(row, container.firstChild)
}

function renderSettingsTab(spec) {
    spec.roundMachines = roundMachinesChoice
    renderFromSave()
    renderMachinesToggle()
    ensureResetAllButton()
    refreshOverrideTags()
}

// init.js calls this once at boot, after the dataset loads.
export function initSettingsTab() {
    spec.roundMachines = roundMachinesChoice
    registerRenderer(renderSettingsTab)
}

export function renderSettings(settings) {
    // Must land before spec.updateSolution() (the caller runs it right after
    // this): table.js's renderer is registered ahead of ours, so if
    // spec.roundMachines were only set from renderSettingsTab, the first
    // render after a reloadFromHash() rebuild would see it undefined.
    spec.roundMachines = roundMachinesChoice
    renderTitle(settings)
    renderIgnore(settings)
    renderRateOptions(settings)
    renderPrecisions(settings)
    renderValueFormat(settings)
    renderMiningProd(settings)
    renderBuildings(settings)
    renderBelts(settings)
    renderFuel(settings)
    renderDefaultModule(settings)
    renderDefaultBeacon(settings)
    renderResourcePriorities(settings)
    renderRecipes(settings)
    renderTargets(settings)
    renderModules(settings)
}
