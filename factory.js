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
import { Formatter } from "./align.js"
import { formatSettings, writeHash } from "./fragment.js"
import { ModuleSpec } from "./module.js"
import { PriorityList } from "./priority.js"
import { Rational, zero, half, one } from "./rational.js"
import { DISABLED_RECIPE_PREFIX } from "./recipe.js"
import { renderAll } from "./render.js"
import { solve } from "./solve.js"
import { BuildTarget } from "./target.js"
import { capableBuildings, pickBuilding } from "./machines-core.js"
import { resolveModules } from "./modules-core.js"

const DEFAULT_ITEM_KEY = "advanced-circuit"

export let DEFAULT_PLANET = "nauvis"
export let DEFAULT_BELT = "transport-belt"
export let DEFAULT_FUEL = "coal"
let DEFAULT_BUILDINGS = new Set([
    "assembling-machine-1",
    "electric-furnace",
    "electric-mining-drill",
])

class BuildingSet {
    constructor(building) {
        this.categories = new Set(building.categories)
        this.buildings = new Set([building])
    }
    merge(other) {
        for (let category of other.categories) {
            this.categories.add(category)
        }
        for (let building of other.buildings) {
            this.buildings.add(building)
        }
    }
    overlap(other) {
        for (let category of this.categories) {
            if (other.categories.has(category)) {
                return true
            }
        }
        return false
    }
}

// A beacon count from the page (a number) or a fragment (a Rational).
function toCount(count) {
    return typeof count === "number" ? Rational.from_float(count) : count
}

// {modules, beaconModules, beaconCount} with no undefined slots and a
// Rational count.
function normalEntry(entry) {
    return {
        modules: entry.modules.map(m => m ?? null),
        beaconModules: [entry.beaconModules[0] ?? null, entry.beaconModules[1] ?? null],
        beaconCount: toCount(entry.beaconCount),
    }
}

export function buildingSort(buildings) {
    buildings.sort(function(a, b) {
        if (a.less(b)) {
            return -1
        } else if (b.less(a)) {
            return 1
        }
        return 0
    })
}

class BuildingGroup {
    constructor(bSet) {
        this.buildings = Array.from(bSet)
        buildingSort(this.buildings)
        this.building = this.getDefault()
    }
    getDefault() {
        for (let building of this.buildings) {
            if (DEFAULT_BUILDINGS.has(building.key)) {
                return building
            }
        }
        return this.buildings[this.buildings.length - 1]
    }
    // {building, fallback} -- see machines-core.js's pickBuilding.
    pick(recipe, excluded, chosen) {
        return pickBuilding(this.buildings, this.building, recipe.category, excluded, chosen)
    }
}

function getBuildingGroups(buildings) {
    let sets = new Set()
    for (let building of buildings) {
        let set = new BuildingSet(building)
        for (let s of Array.from(sets)) {
            if (set.overlap(s)) {
                set.merge(s)
                sets.delete(s)
            }
        }
        sets.add(set)
    }
    let groups = new Map()
    for (let {categories, buildings} of sets) {
        let group = new BuildingGroup(buildings)
        for (let cat of categories) {
            groups.set(cat, group)
        }
    }
    return groups
}

class FactorySpecification {
    constructor() {
        // Game data definitions
        this.items = null
        this.recipes = null
        this.modules = null
        this.planets = null
        this.buildings = null
        this.buildingKeys = null
        this.belts = null
        this.fuels = null

        this.itemGroups = null

        this.buildTargets = []

        // Maps recipe to ModuleSpec
        this.spec = new Map()
        this.defaultModule = null
        this.secondaryDefaultModule = null
        this.defaultBeacon = [null, null]
        this.defaultBeaconCount = zero
        // The other two module layers (docs/superpowers/specs/
        // 2026-10-04-per-recipe-modules-design.md). Machine key ->
        // {modules, beaconModules, beaconCount} for every recipe made in that
        // machine (fragment `mm=`), and the keys of recipes whose modules
        // were set by hand on their row (`modules=`), which no plan or
        // machine change touches.
        this.machineModules = new Map()
        this.handSet = new Set()
        // Bumped by every commitModules(); renderers that don't otherwise
        // see a change (display() re-renders with the same totals object)
        // fold this into their own "did anything change" key -- see
        // flow.js's renderKey().
        this.modulesVersion = 0

        this.belt = null

        this.fuel = null

        this.miningProd = null

        this.ignore = new Set()
        this.targetNotes = []
        this.disable = new Set()
        this.selectedPlanets = new Set()
        this.planetaryBaseline = null

        this.priority = null
        this.defaultPriority = null

        // Which save the settings came from, and which of them the user has
        // since overridden by hand. Fragment keys save=, follow=, ov=.
        this.saveState = {save: null, follow: false, overrides: new Set()}
        // Keys of machines the page must not plan with (fragment `nomach`):
        // the save's default for the selected planet, or the user's picks.
        this.excludedBuildings = new Set()
        // Recipe key -> machine key, picked by hand in a row's details
        // (`mach=`); wins over the automatic pick above.
        this.recipeBuildings = new Map()
        // The item the "Where it goes" tab is open on. Fragment key item=.
        this.whereItem = null

        this.format = new Formatter()

        this.lastTotals = null

        this.lastPartial = null
        this.lastTableau = null
        this.lastMetadata = null
        this.lastSolution = null

        this.debug = false
    }
    setData(items, recipes, planets, modules, buildings, belts, fuels, itemGroups) {
        this.items = items
        this.recipes = recipes
        this.planets = planets
        this.modules = modules
        this.buildings = getBuildingGroups(buildings)
        this.buildingKeys = new Map()
        for (let building of buildings) {
            this.buildingKeys.set(building.key, building)
        }
        this.belts = belts
        this.belt = belts.get(DEFAULT_BELT)
        this.fuels = fuels
        this.fuel = fuels.get(DEFAULT_FUEL)
        this.miningProd = zero
        this.itemGroups = itemGroups
        this.defaultPriority = this.getDefaultPriorityArray()
        this.priority = null
    }
    setDefaultDisable() {
        this.disable.clear()
    }
    _addItemToMaxPriority(item) {
        let resource = this.priority.getResource(item.disableRecipe)
        // The item might already be in the priority list due to being
        // ignored. In this case, do nothing.
        if (resource === null) {
            let level = this.priority.getLastLevel()
            let makeNew = true
            for (let r of level) {
                if (r.recipe.isDisable()) {
                    makeNew = false
                    break
                }
            }
            if (makeNew) {
                level = this.priority.addPriorityBefore(null)
            }
            let hundred = Rational.from_float(100)
            this.priority.addRecipe(item.disableRecipe, hundred, level)
        }
    }
    setDisable(recipe) {
        if (spec.disable.has(recipe)) {
            console.log("disabling already-disabled recipe:", recipe)
            return
        }
        let candidates = new Set()
        let items = new Set()
        for (let ing of recipe.products) {
            let item = ing.item
            items.add(item)
            if (!this.isItemDisabled(item) && !this.ignore.has(item)) {
                candidates.add(item)
            }
        }
        this.disable.add(recipe)
        for (let item of candidates) {
            if (this.isItemDisabled(item)) {
                this._addItemToMaxPriority(item)
            }
        }
        // Update build targets.
        for (let target of this.buildTargets) {
            if (items.has(target.item)) {
                target.displayRecipes()
            }
        }
    }
    setEnable(recipe) {
        if (!spec.disable.has(recipe)) {
            return
        }
        // Enabling this recipe could potentially remove these items'
        // disableRecipe from the priority list. The item is only removed if it
        // goes from being disabled to not disabled, and is not ignored.
        //
        // Note that enabling a recipe for an item does not inherently mean the
        // item is not considered "disabled" in this sense. For example, if the
        // enabled recipe is net-negative in its use of the item.
        let candidates = new Set()
        let items = new Set()
        for (let ing of recipe.products) {
            let item = ing.item
            items.add(item)
            if (this.isItemDisabled(item) && !this.ignore.has(item)) {
                candidates.add(item)
            }
        }
        this.disable.delete(recipe)
        for (let item of candidates) {
            if (!this.isItemDisabled(item)) {
                this.priority.removeRecipe(item.disableRecipe)
            }
        }
        // Update build targets.
        for (let target of this.buildTargets) {
            if (items.has(target.item)) {
                target.displayRecipes()
            }
        }
    }
    _syncPlanetDisable() {
        let allDisable
        if (this.selectedPlanets.size === 0) {
            allDisable = new Set()
        } else {
            let planets = Array.from(this.selectedPlanets)
            allDisable = new Set(planets[0].disable)
            for (let i = 1; i < planets.length; i++) {
                let p = planets[i]
                let newDisable = new Set()
                for (let r of p.disable) {
                    if (allDisable.has(r)) {
                        newDisable.add(r)
                    }
                }
                allDisable = newDisable
            }
        }
        this.planetaryBaseline = allDisable
        let toEnable = new Set()
        for (let r of this.disable) {
            if (!allDisable.has(r)) {
                toEnable.add(r)
            }
        }
        for (let r of toEnable) {
            this.setEnable(r)
        }
        for (let r of allDisable) {
            if (!this.disable.has(r)) {
                this.setDisable(r)
            }
        }
    }
    isDefaultPlanet() {
        if (!this.planets || this.planets.size === 1) {
            return true
        }
        let a = Array.from(this.selectedPlanets)
        if (a.length !== 1 || a[0].key !== DEFAULT_PLANET) {
            return false
        }
        return true
    }
    getNetDisable() {
        if (!this.planetaryBaseline) {
            return {disable: this.disable, enable: new Set()}
        }
        let disable = new Set()
        let enable = new Set()
        for (let r of this.disable) {
            if (!this.planetaryBaseline.has(r)) {
                disable.add(r)
            }
        }
        for (let r of this.planetaryBaseline) {
            if (!this.disable.has(r)) {
                enable.add(r)
            }
        }
        return {disable, enable}
    }
    selectOnePlanet(planet) {
        this.selectedPlanets.clear()
        this.selectPlanet(planet)
    }
    selectPlanet(planet) {
        this.selectedPlanets.add(planet)
        this._syncPlanetDisable()
    }
    unselectPlanet(planet) {
        this.selectedPlanets.delete(planet)
        this._syncPlanetDisable()
    }
    getDefaultPriorityArray() {
        let a = []
        for (let [recipeKey, recipe] of this.recipes) {
            if (recipe.defaultPriority !== undefined) {
                let pri = recipe.defaultPriority
                while (a.length < pri + 1) {
                    a.push(new Map())
                }
                let item = recipe.products[0].item
                let weight = recipe.defaultWeight
                // Fluids operate on a ten-fold scale compared to other items.
                if (item.phase === "fluid") {
                    weight = weight.div(Rational.from_float(10))
                }
                a[pri].set(recipe, weight)
            }
        }
        return a
    }
    setDefaultPriority() {
        this.priority = PriorityList.fromArray(this.defaultPriority)
        // It is possible that an item has no net producers at all. Ensure it
        // is placed at the proper priority level.
        for (let item of this.items.values()) {
            if (this.isItemDisabled(item)) {
                this._addItemToMaxPriority(item)
            }
        }
    }
    isValidPriorityKey(key) {
        if (key.startsWith(DISABLED_RECIPE_PREFIX)) {
            let itemKey = key.slice(DISABLED_RECIPE_PREFIX.length)
            return this.items.has(itemKey)
        }
        let recipe = this.recipes.get(key)
        if (recipe === undefined) {
            return false
        }
        return recipe.defaultPriority !== undefined
    }
    setPriorities(tiers) {
        let a = []
        for (let tier of tiers) {
            let m = new Map()
            for (let [recipeKey, weight] of tier) {
                let recipe = this.recipes.get(recipeKey)
                if (recipe === undefined && recipeKey.startsWith(DISABLED_RECIPE_PREFIX)) {
                    let itemKey = recipeKey.slice(DISABLED_RECIPE_PREFIX.length)
                    recipe = this.items.get(itemKey).disableRecipe
                }
                m.set(recipe, weight)
            }
            a.push(m)
        }
        this.priority.applyArray(a)
    }
    isDefaultPriority() {
        return this.priority.equalArray(this.defaultPriority)
    }
    getUses(item) {
        let recipes = []
        for (let recipe of item.uses) {
            if (!this.disable.has(recipe)) {
                recipes.push(recipe)
            }
        }
        return recipes
    }
    // Returns whether the current item requires the use of its DisabledRecipe
    // as a consequence of its recipes being disabled. (It may still require it
    // as a consequence of the item being ignored, independent of this.)
    //
    // It's worth mentioning that this is insufficent to guarantee that no
    // infeasible solutions exist. Catching net-negative single recipes ought
    // to account for the most common cases, but net-negative recipe loops are
    // still possible.
    isItemDisabled(item) {
        for (let recipe of item.recipes) {
            if (!this.disable.has(recipe)) {
                if (recipe.isNetProducer(item)) {
                    return false
                }
            }
        }
        return true
    }
    getRecipes(item) {
        let recipes = []
        for (let recipe of item.recipes) {
            if (!this.disable.has(recipe)) {
                recipes.push(recipe)
            }
        }
        // The disableRecipe's purpose is to provide an item ex nihilo, in
        // cases where solutions are infeasible otherwise. This happens in two
        // cases: When enough recipes have been disabled to prevent its
        // production in any other way, and when the item is being ignored.
        if (this.isItemDisabled(item) || this.ignore.has(item)) {
            let result = [item.disableRecipe]
            // Still consider any recipes which produce both this item and any
            // other un-ignored items.
            for (let r of recipes) {
                for (let ing of r.products) {
                    if (!this.ignore.has(ing.item)) {
                        result.push(r)
                        break
                    }
                }
            }
            return result
        }
        return recipes
    }
    _getItemGraph(item, recipes) {
        for (let recipe of this.getRecipes(item)) {
            if (recipes.has(recipe)) {
                continue
            }
            recipes.add(recipe)
            for (let ing of recipe.getIngredients()) {
                this._getItemGraph(ing.item, recipes)
            }
        }
    }
    // Returns the set of recipes which may contribute to the production of
    // the given collection of items.
    getRecipeGraph(items) {
        let graph = new Set()
        for (let [item, rate] of items) {
            this._getItemGraph(item, graph)
        }
        return graph
    }
    isFactoryTarget(recipe) {
        for (let target of this.buildTargets) {
            if (target.recipe === recipe && target.changedBuilding) {
                return true
            }
        }
        return false
    }
    getBuilding(recipe) {
        if (recipe.category === null || recipe.category === undefined) {
            return null
        } else {
            return this.pickFor(recipe).building
        }
    }
    pickFor(recipe) {
        let chosen = this.buildingKeys.get(this.recipeBuildings.get(recipe.key))
        return this.buildings.get(recipe.category).pick(recipe, this.excludedBuildings, chosen)
    }
    // The machines that can make `recipe`, slowest first.
    capableBuildings(recipe) {
        if (recipe.category === null || recipe.category === undefined) {
            return []
        }
        return capableBuildings(this.buildings.get(recipe.category).buildings, recipe.category)
    }
    // Pins `recipe` to `building`, or back to the automatic pick when null.
    setRecipeBuilding(recipe, building) {
        if (building === null) {
            this.recipeBuildings.delete(recipe.key)
        } else {
            this.recipeBuildings.set(recipe.key, building.key)
        }
        this.reapplyModules()
    }
    setRecipeBuildings(map) {
        this.recipeBuildings = new Map(map)
        this.reapplyModules()
    }
    // True when every machine that can make `recipe` is excluded, so
    // getBuilding fell back to one anyway.
    isFallbackBuilding(recipe) {
        if (recipe.category === null || recipe.category === undefined) {
            return false
        }
        return this.pickFor(recipe).fallback
    }
    setExcludedBuildings(keys) {
        this.excludedBuildings = new Set(keys)
        this.reapplyModules()
    }
    toggleExcludedBuilding(building) {
        let keys = new Set(this.excludedBuildings)
        if (keys.has(building.key)) {
            keys.delete(building.key)
        } else {
            keys.add(building.key)
        }
        this.setExcludedBuildings(keys)
    }
    getBuildingGroup(building) {
        let cat = Array.from(building.categories)[0]
        return this.buildings.get(cat)
    }
    setMinimumBuilding(building) {
        let group = this.getBuildingGroup(building)
        group.building = building
        this.reapplyModules()
    }
    initModuleSpec(recipe, building) {
        if (!this.spec.has(recipe) && building !== null && building.canBeacon()) {
            let m = new ModuleSpec(recipe, this)
            m.applyResolved(building, this.resolveFor(recipe, building))
            this.spec.set(recipe, m)
            return m
        }
    }
    populateModuleSpec(totals) {
        for (let [recipe, rate] of totals.rates) {
            let building = this.getBuilding(recipe)
            this.initModuleSpec(recipe, building)
        }
    }
    getModuleSpec(recipe) {
        let m = this.spec.get(recipe)
        if (m === undefined) {
            let building = this.getBuilding(recipe)
            return this.initModuleSpec(recipe, building)
        }
        return m
    }
    getProdEffect(recipe) {
        let m = this.getModuleSpec(recipe)
        if (m === undefined) {
            return one
        }
        return this.getModuleSpec(recipe).prodEffect(this)
    }
    // --- modules: three layers, the most specific wins -------------------
    // Plan (defaultModule & co., `dm`/`dm2`/`db`/`dbc`), machine
    // (machineModules, `mm`), row (handSet, `modules`). None of the edits
    // below re-solves: callers wrap them in commitModules().
    planLayer() {
        return {
            defaultModule: this.defaultModule,
            secondaryDefaultModule: this.secondaryDefaultModule,
            defaultBeacon: [this.defaultBeacon[0], this.defaultBeacon[1]],
            defaultBeaconCount: this.defaultBeaconCount,
        }
    }
    // What `recipe` gets from the plan and machine layers in `building`,
    // ignoring any modules set by hand on its row.
    resolveFor(recipe, building = this.getBuilding(recipe)) {
        return resolveModules({recipe, machine: building, plan: this.planLayer(), machineLayer: this.machineModules})
    }
    // Where `recipe`'s modules come from now: "hand", "machine" or "plan".
    moduleSource(recipe) {
        if (this.handSet.has(recipe.key)) {
            return "hand"
        }
        let building = this.getBuilding(recipe)
        return building !== null && this.machineModules.has(building.key) ? "machine" : "plan"
    }
    // Rebuilds every ModuleSpec not set by hand from the layers, and fits
    // the hand-set ones to their (possibly new) machine. Runs after every
    // layer edit and every machine pick.
    reapplyModules() {
        for (let [recipe, moduleSpec] of this.spec) {
            let building = this.getBuilding(recipe)
            if (building === null) {
                continue
            }
            if (this.handSet.has(recipe.key)) {
                moduleSpec.setBuilding(building, this)
            } else {
                moduleSpec.applyResolved(building, this.resolveFor(recipe, building))
            }
        }
    }
    setDefaultModule(module) {
        this.defaultModule = module
        this.reapplyModules()
    }
    setSecondaryDefaultModule(module) {
        this.secondaryDefaultModule = module
        this.reapplyModules()
    }
    isDefaultDefaultBeacon() {
        return this.defaultBeacon[0] === null && this.defaultBeacon[1] === null
    }
    setDefaultBeacon(module, i) {
        this.defaultBeacon[i] = module
        this.reapplyModules()
    }
    setDefaultBeaconCount(count) {
        this.defaultBeaconCount = toCount(count)
        this.reapplyModules()
    }
    // The whole plan layer at once (Settings' strategy, the editor's
    // "Every row"): {defaultModule, secondaryDefaultModule, defaultBeacon,
    // defaultBeaconCount}, the count a number or a Rational.
    setPlanLayer(plan) {
        this.defaultModule = plan.defaultModule
        this.secondaryDefaultModule = plan.secondaryDefaultModule
        this.defaultBeacon = [plan.defaultBeacon[0], plan.defaultBeacon[1]]
        this.defaultBeaconCount = toCount(plan.defaultBeaconCount)
        this.reapplyModules()
    }
    // One machine's entry, or null to drop it ("Use plan").
    setMachineModules(machineKey, entry) {
        if (entry === null) {
            this.machineModules.delete(machineKey)
        } else {
            this.machineModules.set(machineKey, normalEntry(entry))
        }
        this.reapplyModules()
    }
    // The whole machine layer (fragment `mm=`): Map machine key -> entry.
    setMachineLayer(map) {
        this.machineModules = new Map([...map].map(([key, entry]) => [key, normalEntry(entry)]))
        this.reapplyModules()
    }
    // Sets `recipe`'s modules by hand and marks it hand-set.
    setRowModules(recipe, entry) {
        let moduleSpec = this.getModuleSpec(recipe)
        if (moduleSpec === undefined) {
            return
        }
        let e = normalEntry(entry)
        let slots = moduleSpec.building.moduleSlots
        moduleSpec.modules = e.modules.slice(0, slots)
        while (moduleSpec.modules.length < slots) {
            moduleSpec.modules.push(null)
        }
        moduleSpec.beaconModules = e.beaconModules
        moduleSpec.beaconCount = e.beaconCount
        this.handSet.add(recipe.key)
    }
    // "Back to plan default" / Settings' Reset: the row takes the layers again.
    releaseRow(recipe) {
        this.handSet.delete(recipe.key)
        let moduleSpec = this.spec.get(recipe)
        let building = this.getBuilding(recipe)
        if (moduleSpec !== undefined && building !== null) {
            moduleSpec.applyResolved(building, this.resolveFor(recipe, building))
        }
    }
    releaseAllRows() {
        this.handSet.clear()
        this.reapplyModules()
    }
    // Runs `change` (any of the layer edits above), then re-solves when a
    // recipe's productivity moved -- that changes the recipe ratios the
    // solver works out -- and otherwise only re-renders: speed and power
    // change machine counts and power, which every renderer recomputes from
    // the ModuleSpecs. Like toggleIgnore(), the edits never solve on their own.
    commitModules(change) {
        this.modulesVersion++
        let before = new Map()
        for (let [recipe, moduleSpec] of this.spec) {
            before.set(recipe, moduleSpec.prodEffect(this).toString())
        }
        change()
        let resolve = false
        for (let [recipe, moduleSpec] of this.spec) {
            if (before.get(recipe) !== moduleSpec.prodEffect(this).toString()) {
                resolve = true
                break
            }
        }
        if (resolve) {
            this.updateSolution()
        } else {
            this.display()
        }
    }
    // Returns the recipe-rate at which a single building can produce a recipe.
    // Returns null for recipes that do not have a building.
    getRecipeRate(recipe) {
        let building = this.getBuilding(recipe)
        if (building === null) {
            return null
        }
        return building.getRecipeRate(this, recipe)
    }
    setMiner(recipe, miner, purity) {
        this.minerSettings.set(recipe, {miner, purity})
    }
    getCount(recipe, rate) {
        let building = this.getBuilding(recipe)
        if (building === null) {
            return zero
        }
        return building.getCount(this, recipe, rate)
    }
    getBeltCount(rate) {
        return rate.div(this.belt.rate)
    }
    getPowerUsage(recipe, rate) {
        let building = this.getBuilding(recipe)
        if (building === null) {
            return {fuel: null, power: zero}
        }
        let count = this.getCount(recipe, rate)
        if (building.fuel !== null) {
            return {fuel: building.fuel, power: building.power.mul(count)}
        }
        let modules = this.getModuleSpec(recipe)
        let powerEffect
        if (modules) {
            powerEffect = modules.powerEffect(this)
        } else {
            powerEffect = one
        }
        let power = building.power.mul(count).mul(powerEffect).add(building.drain().mul(count.ceil()))
        return {"fuel": "electric", "power": power}
    }
    addTarget(itemKey) {
        if (itemKey === undefined) {
            itemKey = DEFAULT_ITEM_KEY
        }
        let item = this.items.get(itemKey)
        let target = new BuildTarget(this.buildTargets.length, itemKey, item, this.itemGroups)
        this.buildTargets.push(target)
        d3.select("#targets").insert(() => target.element, "#plusButton")
        return target
    }
    removeTarget(target) {
        this.buildTargets.splice(target.index, 1)
        for (let i=target.index; i < this.buildTargets.length; i++) {
            this.buildTargets[i].index--
        }
        d3.select(target.element).remove()
    }
    toggleIgnore(item) {
        let updateTargets = false
        if (this.ignore.has(item)) {
            this.ignore.delete(item)
            if (!this.isItemDisabled(item)) {
                this.priority.removeRecipe(item.disableRecipe)
                updateTargets = true
            }
        } else {
            this.ignore.add(item)
            if (!this.isItemDisabled(item)) {
                let level = this.priority.getFirstLevel()
                let makeNew = true
                for (let r of level) {
                    if (r.recipe.isDisable()) {
                        makeNew = false
                        break
                    }
                }
                if (makeNew) {
                    level = this.priority.addPriorityBefore(level)
                }
                let hundred = Rational.from_float(100)
                this.priority.addRecipe(item.disableRecipe, hundred, level)
                updateTargets = true
            }
        }
        if (updateTargets) {
            // Update build targets.
            for (let target of this.buildTargets) {
                if (target.item === item) {
                    target.displayRecipes()
                    target.rateChanged()
                }
            }
        }
    }
    // A build target is an explicit ask, so it must never be "supplied from
    // elsewhere" (nothing to compute) or locked by a followed save's research
    // state (blank page). Undo either before solving and record a note the
    // Targets frame shows, so the correction is visible rather than silent.
    ensureTargetsProducible() {
        this.targetNotes = []
        for (let target of this.buildTargets) {
            let item = target.item
            if (this.ignore.has(item)) {
                this.toggleIgnore(item)
                this.targetNotes.push(`${item.name} is a target, so it is built here rather than supplied from elsewhere.`)
            }
            if (this.isItemDisabled(item)) {
                let enabled = []
                for (let recipe of item.recipes) {
                    if (this.disable.has(recipe) && recipe.isNetProducer(item)) {
                        this.setEnable(recipe)
                        enabled.push(recipe)
                    }
                }
                if (enabled.length > 0) {
                    let fetched = this.saveState.fetched
                    let saveName = (fetched && fetched.save && fetched.save.name) || this.saveState.save
                    let why = saveName ? `${saveName} has not researched it` : "its recipe was disabled"
                    this.targetNotes.push(`${item.name} is a target, so its recipe is enabled even though ${why}.`)
                }
            }
        }
    }
    solve() {
        this.ensureTargetsProducible()
        let outputs = []
        for (let target of this.buildTargets) {
            let item = target.item
            let rate = target.getRate()
            let recipe
            if (target.changedBuilding) {
                recipe = target.recipe
            } else {
                recipe = null
            }
            outputs.push([item, rate, recipe])
        }
        // JS isn't good at using tuples as Map keys/Set items, so just do this
        // quadratically. It's fine.
        let dedupedOutputs = []
        outer: for (let [origItem, origRate, origRecipe] of outputs) {
            for (let i = 0; i < dedupedOutputs.length; i++) {
                let {item, rate, recipe} = dedupedOutputs[i]
                if (recipe === origRecipe && item === origItem) {
                    rate = rate.add(origRate)
                    dedupedOutputs[i] = {item, rate, recipe}
                    continue outer
                }
            }
            dedupedOutputs.push({
                item: origItem,
                rate: origRate,
                recipe: origRecipe,
            })
        }
        let totals = solve(this, dedupedOutputs)
        return totals
    }
    setHash() {
        writeHash("#" + formatSettings())
    }
    // The top-level calculation function. Called whenever the solution
    // requires recalculation.
    updateSolution() {
        this.lastTotals = this.solve()
        this.populateModuleSpec(this.lastTotals)
        this.display()
    }
    // Re-renders the current solution, without re-computing it.
    //
    // This is useful for when settings can be applied without altering the
    // solution. In general, if something would alter recipe-rate ratios, then
    // it requires a new solution. If it only alters building counts (e.g.
    // from changing the speed of a building), then we need merely re-display
    // the existing solution.
    display() {
        renderAll(this, this.lastTotals)
    }
}

export function resetSpec() {
    spec = new FactorySpecification()
    window.spec = spec
}

export let spec = new FactorySpecification()
window.spec = spec
