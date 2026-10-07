// SPDX-License-Identifier: Apache-2.0 · Copyright 2019-2021 Kirk McDonald
import * as d3 from "d3"
import { makeDropdown, addInputs } from "./dropdown.js"
import { spec } from "./factory.js"
import { beltsToRate } from "./search-core.js"
import { Rational, zero, one } from "./rational.js"

// Seconds per display-unit menu entry, used to convert a typed number in
// "/s"/"/min"/"/h" mode into the per-second Rational the solver wants.
const UNIT_SECONDS = new Map([
    ["/s", 1],
    ["/min", 60],
    ["/h", 3600],
])

function removeHandler(target) {
    return function() {
        spec.removeTarget(target)
        spec.updateSolution()
    }
}

// numInput's own change applies the typed value, in whichever unit is
// currently selected.
function inputChangedHandler(target) {
    return function() {
        if (target.unitSelect.value === "machines") {
            target.buildingsChanged()
        } else {
            target.rateChanged()
        }
        spec.updateSolution()
    }
}

// unitSelect's change must never reinterpret numInput's digits under the
// new unit (switching a "120" from /min to belts is not "120 belts"): it
// only converts the underlying value across the machines/rate boundary
// (deriving a building count from the current rate, or vice versa) and
// otherwise just asks for a re-render, which redisplays the same rate in
// the newly picked unit.
function unitChangedHandler(target) {
    return function() {
        if (target.unitSelect.value === "machines") {
            let recipe = target.recipe
            let baseRate = recipe ? spec.getRecipeRate(recipe) : null
            if (baseRate !== null) {
                baseRate = baseRate.mul(recipe.gives(target.item))
            }
            let count = (baseRate === null || baseRate.isZero()) ? one : target.rate.div(baseRate)
            target.setBuildings(count, recipe)
        } else if (target.changedBuilding) {
            target.setRate(target.rate)
        }
        spec.updateSolution()
    }
}

let recipeSelectorCount = 0

export class BuildTarget {
    constructor(index, itemKey, item, itemGroups) {
        this.index = index
        this.itemKey = itemKey
        this.item = item
        // When item has multiple recipes.
        this.recipe = null
        this.defaultRecipe = null
        this.changedBuilding = true
        this.buildings = one
        this.rate = zero

        let element = document.createElement("li")
        element.className = "target row"
        this.element = element

        let slot = document.createElement("span")
        slot.className = "slot"
        slot.appendChild(item.icon.make(32, true))
        element.appendChild(slot)

        // A small icon dropdown for picking among an item's several
        // recipes; hidden (left empty) when there is only one, via
        // displayRecipes() below. The search box replaces Kirk's old
        // per-row item picker entirely.
        this.recipeSelector = document.createElement("span")
        element.appendChild(this.recipeSelector)

        let name = document.createElement("span")
        name.className = "h"
        name.style.flex = "1"
        name.textContent = item.name
        element.appendChild(name)

        this.numInput = document.createElement("input")
        this.numInput.className = "num"
        this.numInput.style.width = "56px"
        this.numInput.style.textAlign = "right"
        this.numInput.addEventListener("change", inputChangedHandler(this))
        element.appendChild(this.numInput)

        this.unitSelect = document.createElement("select")
        this.unitSelect.className = "muted"
        for (let unit of ["/s", "/min", "/h", "belts", "machines"]) {
            let option = document.createElement("option")
            option.value = unit
            option.textContent = unit
            this.unitSelect.appendChild(option)
        }
        this.unitSelect.value = "/min"
        this.unitSelect.addEventListener("change", unitChangedHandler(this))
        element.appendChild(this.unitSelect)

        let removeButton = document.createElement("span")
        removeButton.className = "btn btn-red btn-sm"
        removeButton.textContent = "×"
        removeButton.title = "Remove this item."
        removeButton.addEventListener("click", removeHandler(this))
        element.appendChild(removeButton)

        // Kept only so fragment.js's `${target.buildingInput.value}` (the
        // "f:" items= format) still has something to read; it is not a
        // real input any more.
        this.buildingInput = { value: "1" }

        this.displayRecipes()
    }
    displayRecipes() {
        this.recipeSelector.replaceChildren()
        let recipes = []
        let found = false
        if (!spec.ignore.has(this.item)) {
            for (let recipe of this.item.recipes) {
                if (spec.disable.has(recipe) || !recipe.isNetProducer(this.item)) {
                    continue
                }
                if (recipe === this.recipe) {
                    found = true
                }
                recipes.push(recipe)
            }
        }
        if (!found) {
            this.recipe = null
        }
        if (recipes.length > 0) {
            this.defaultRecipe = recipes[0]
        }
        if (recipes.length === 0) {
            this.defaultRecipe = null
            return
        } else if (recipes.length === 1) {
            this.recipe = recipes[0]
            return
        }
        // If there are multiple valid recipes, render the small dropdown.
        if (this.recipe === null) {
            this.recipe = recipes[0]
        }
        let self = this
        let dropdown = makeDropdown(d3.select(this.recipeSelector))
        dropdown.classed("recipePicker", true)
        let inputs = dropdown.selectAll("div").data(recipes).join("div")
        let labels = addInputs(
            inputs,
            "target-recipe-" + recipeSelectorCount,
            d => self.recipe === d,
            d => {
                self.recipe = d
                spec.updateSolution()
            },
        )
        labels.append(d => d.icon.make(20, false, dropdown.node()))
        recipeSelectorCount++
    }
    rateChanged() {
        if (this.unitSelect.value === "machines") {
            // factory.js's toggleIgnore() calls this directly (after
            // displayRecipes() may have already cleared this.recipe) to force
            // a machines-mode target out of that mode when its recipe stops
            // being usable; numInput still holds a machine count then, not a
            // rate, so preserve the rate getRate() last computed (kept in
            // sync on this.rate) instead of misreading the count as one.
            this.unitSelect.value = "/min"
            this.setRate(this.rate)
            return
        }
        let n = Number(this.numInput.value) || 0
        let unit = this.unitSelect.value
        if (unit === "belts") {
            this.setRate(Rational.from_float(beltsToRate(n, spec.belt.rate.toFloat())))
        } else {
            let seconds = UNIT_SECONDS.get(unit) || UNIT_SECONDS.get("/min")
            this.setRate(Rational.from_float(n / seconds))
        }
    }
    buildingsChanged() {
        this.setBuildings(Rational.from_float(Number(this.numInput.value) || 0), this.recipe)
    }
    // `rate` is a per-second Rational when called from the unit-select
    // handlers above or from search.js; settings.js's renderTargets (the
    // items= "r:" fragment format) still calls this with a plain decimal
    // string in the *current display rate* unit, exactly like Kirk's
    // original setRate(rate) did -- both forms are accepted.
    setRate(rate) {
        this.rate = (rate instanceof Rational) ? rate : Rational.from_string(rate).div(spec.format.rateFactor)
        this.changedBuilding = false
        this.buildingInput.value = ""
        if (this.unitSelect.value === "machines") {
            this.unitSelect.value = "/min"
        }
    }
    // `count` is a Rational from the "machines" unit handler; settings.js's
    // renderTargets (the items= "f:" fragment format) still calls this with
    // a plain decimal string, like Kirk's original setBuildings did.
    setBuildings(count, recipe) {
        this.buildings = (count instanceof Rational) ? count : Rational.from_string(count)
        this.recipe = recipe
        this.changedBuilding = true
        this.buildingInput.value = this.buildings.toString()
    }
    // Called by every render (calc/init.js's renderHousekeeping): computes
    // the per-second rate the solver should use for this target, and syncs
    // the row's number input/unit select to match the current mode.
    getRate() {
        let recipe = this.recipe
        if ((recipe === null || recipe === undefined || recipe.category === null) && this.changedBuilding) {
            // No usable recipe to size building counts against (e.g. a raw
            // resource with no crafting recipe) -- fall back to rate mode.
            this.changedBuilding = false
        }
        let baseRate = null
        if (recipe !== null && recipe !== undefined) {
            baseRate = spec.getRecipeRate(recipe)
            if (baseRate !== null) {
                baseRate = baseRate.mul(recipe.gives(this.item))
            }
        }
        let rate
        if (this.changedBuilding) {
            rate = baseRate === null ? zero : baseRate.mul(this.buildings)
            this.unitSelect.value = "machines"
            this.numInput.value = spec.format.count(this.buildings)
        } else {
            rate = this.rate
            let unit = this.unitSelect.value
            if (unit === "belts") {
                this.numInput.value = spec.getBeltCount(rate).toDecimal(2)
            } else {
                let seconds = UNIT_SECONDS.get(unit) || UNIT_SECONDS.get("/min")
                this.numInput.value = rate.mul(Rational.from_float(seconds)).toDecimal(spec.format.ratePrecision)
            }
        }
        // Kept current in both modes: rateChanged() reads this back when
        // toggleIgnore() forces a machines-mode target out of that mode.
        this.rate = rate
        return rate
    }
}
