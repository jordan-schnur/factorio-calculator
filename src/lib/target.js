// SPDX-License-Identifier: Apache-2.0 · Copyright 2019-2021 Kirk McDonald
import { spec } from "./factory.js"
import { beltsToRate } from "./search-core.js"
import { Rational, zero, one } from "./rational.js"

// Seconds per rate unit, to turn a number typed in "/s", "/min" or "/h" into the per-second Rational the solver wants.
const UNIT_SECONDS = new Map([
    ["/s", 1],
    ["/min", 60],
    ["/h", 3600],
])

// The units a target row's <select> offers, in order.
export const UNITS = ["/s", "/min", "/h", "belts", "machines"]

// The one way to add a target and re-solve: `perSecond` for a rate, `machines` for a building count.
export function addTarget(spec, itemKey, { perSecond, machines } = {}) {
    const target = spec.addTarget(itemKey)
    if (machines !== undefined) {
        target.setBuildings(Rational.from_float(machines), target.recipe)
    } else {
        target.setRate(perSecond)
    }
    spec.updateSolution()
    return target
}

// A typed number, read in the row's current unit.
export function changeAmount(spec, target, text) {
    target.amount = text
    if (target.unit === "machines") {
        target.buildingsChanged()
    } else {
        target.rateChanged()
    }
    spec.updateSolution()
}

// A new unit converts only across the machines/rate boundary; any other switch redraws the same rate in the new unit.
export function changeUnit(spec, target, unit) {
    target.unit = unit
    if (unit === "machines") {
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

export function pickRecipe(spec, target, recipe) {
    target.recipe = recipe
    spec.updateSolution()
}

export function dropTarget(spec, target) {
    spec.removeTarget(target)
    spec.updateSolution()
}

// What the Make panel draws per target: fresh objects on every call, so each row redraws after a solve.
export function targetRows(spec) {
    return spec.buildTargets.map(target => ({ target, amount: target.amount, unit: target.unit, recipe: target.recipe, recipes: target.recipeChoices }))
}

export class BuildTarget {
    constructor(index, itemKey, item, itemGroups) {
        this.index = index
        this.itemKey = itemKey
        this.item = item
        this.recipe = null
        this.defaultRecipe = null
        this.recipeChoices = []
        this.changedBuilding = true
        this.buildings = one
        this.rate = zero
        this.unit = "/min"
        this.amount = ""
        // Only for fragment.js's `${target.buildingInput.value}` (the items= "f:" form); not an input.
        this.buildingInput = { value: "1" }
        this.displayRecipes()
    }
    // The recipes the row's picker offers (only when more than one applies), keeping `recipe` among them.
    displayRecipes() {
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
        this.defaultRecipe = recipes.length > 0 ? recipes[0] : null
        if (recipes.length === 1 || (recipes.length > 1 && this.recipe === null)) {
            this.recipe = recipes[0]
        }
        this.recipeChoices = recipes.length > 1 ? recipes : []
    }
    // Re-reads `amount` as a rate; a machines-mode row that toggleIgnore() forces out keeps the rate getRate() last worked out.
    rateChanged() {
        if (this.unit === "machines") {
            this.unit = "/min"
            this.setRate(this.rate)
            return
        }
        let n = Number(this.amount) || 0
        if (this.unit === "belts") {
            this.setRate(Rational.from_float(beltsToRate(n, spec.belt.rate.toFloat())))
        } else {
            let seconds = UNIT_SECONDS.get(this.unit) || UNIT_SECONDS.get("/min")
            this.setRate(Rational.from_float(n / seconds))
        }
    }
    buildingsChanged() {
        this.setBuildings(Rational.from_float(Number(this.amount) || 0), this.recipe)
    }
    // `rate` is a per-second Rational, or (settings.js's items= "r:" form) a decimal string in the display-rate unit.
    setRate(rate) {
        this.rate = (rate instanceof Rational) ? rate : Rational.from_string(rate).div(spec.format.rateFactor)
        this.changedBuilding = false
        this.buildingInput.value = ""
        if (this.unit === "machines") {
            this.unit = "/min"
        }
    }
    // `count` is a Rational, or (settings.js's items= "f:" form) a decimal string.
    setBuildings(count, recipe) {
        this.buildings = (count instanceof Rational) ? count : Rational.from_string(count)
        this.recipe = recipe
        this.changedBuilding = true
        this.buildingInput.value = this.buildings.toString()
    }
    // Every render (init.js's renderHousekeeping): the per-second rate to solve for, with `unit` and `amount` brought in line.
    getRate() {
        let recipe = this.recipe
        if ((recipe === null || recipe === undefined || recipe.category === null) && this.changedBuilding) {
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
            this.unit = "machines"
            this.amount = spec.format.count(this.buildings)
        } else {
            rate = this.rate
            if (this.unit === "belts") {
                this.amount = spec.getBeltCount(rate).toDecimal(2)
            } else {
                let seconds = UNIT_SECONDS.get(this.unit) || UNIT_SECONDS.get("/min")
                this.amount = rate.mul(Rational.from_float(seconds)).toDecimal(spec.format.ratePrecision)
            }
        }
        this.rate = rate
        return rate
    }
}
