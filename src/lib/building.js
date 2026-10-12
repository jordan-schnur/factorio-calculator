// SPDX-License-Identifier: Apache-2.0 · Copyright 2019-2021 Kirk McDonald
import { Icon } from "./icon.js"
import { allowedEffectsOf } from "./modules-core.js"
import { speedMultiplier } from "./quality-core.js"
import { spec } from "./factory.js"
import { Rational, zero, one } from "./rational.js"

let thirty = Rational.from_float(30)

class Building {
    constructor(key, name, col, row, categories, speed, prodBonus, moduleSlots, power, fuel) {
        this.key = key
        this.name = name
        this.categories = new Set(categories)
        this.speed = speed
        this.prodBonus = prodBonus
        this.moduleSlots = moduleSlots
        this.power = power
        this.fuel = fuel
        // The data's allowed_effects as a Set (modules-core.js's
        // allowedEffectsOf); null when it names none, which allows all.
        this.allowedEffects = null
        // Quality speeds up crafting machines only (calculator 1.3.0):
        // getBuildings sets this for the data's crafting_machines, never for
        // drills, offshore pumps, boilers, the reactor or the rocket silo.
        this.takesQuality = false

        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
        this.tooltipKind = "building"
    }
    less(other) {
        if (!this.speed.equal(other.speed)) {
            return this.speed.less(other.speed)
        }
        return this.moduleSlots < other.moduleSlots
    }
    getCount(spec, recipe, rate) {
        return rate.div(this.getRecipeRate(spec, recipe))
    }
    getRecipeRate(spec, recipe) {
        let modules = spec.getModuleSpec(recipe)
        let speedEffect
        if (modules) {
            speedEffect = modules.speedEffect()
        } else {
            speedEffect = one
        }
        let rate = recipe.time.reciprocate().mul(this.speed).mul(speedEffect)
        // A crafting machine's quality multiplies its crafting speed
        // (spec.machineQuality, `mq=`).
        if (this.takesQuality && spec.machineTier) {
            rate = rate.mul(speedMultiplier(spec.machineTier(this)))
        }
        return rate
    }
    canBeacon() {
        return this.moduleSlots > 0
    }
    prodEffect(spec) {
        return this.prodBonus
    }
    drain() {
        return this.power.div(thirty)
    }
}

class Miner extends Building {
    constructor(key, name, col, row, categories, miningSpeed, moduleSlots, power, fuel) {
        super(key, name, col, row, categories, zero, zero, moduleSlots, power, fuel)
        this.miningSpeed = miningSpeed
        this.tooltipKind = "miner"
    }
    less(other) {
        return this.miningSpeed.less(other.miningSpeed)
    }
    drain() {
        return zero
    }
    getRecipeRate(spec, recipe) {
        let modules = spec.getModuleSpec(recipe)
        let speedEffect
        if (modules) {
            speedEffect = modules.speedEffect()
        } else {
            speedEffect = one
        }
        return this.miningSpeed.div(recipe.miningTime).mul(speedEffect)
    }
    prodEffect(spec) {
        return spec.miningProd
    }
}

class OffshorePump extends Building {
    constructor(key, name, col, row, pumpingSpeed) {
        super(key, name, col, row, ["offshore-pumping"], zero, zero, 0, zero, null)
        this.pumpingSpeed = pumpingSpeed
        this.tooltipKind = "pump"
    }
    less(other) {
        return this.pumpingSpeed.less(other.pumpingSpeed)
    }
    getRecipeRate(spec, recipe) {
        return this.pumpingSpeed
    }
}

let rocketLaunchDuration = Rational.from_floats(2434, 60)

function launchRate(spec) {
    let partRecipe = spec.recipes.get("rocket-part")
    let partFactory = spec.getBuilding(partRecipe)
    let partItem = spec.items.get("rocket-part")
    let gives = partRecipe.gives(partItem)
    // The base rate at which the silo can make rocket parts.
    let rate = Building.prototype.getRecipeRate.call(partFactory, spec, partRecipe)
    // Number of times to complete the rocket part recipe per launch.
    let perLaunch = Rational.from_float(100).div(gives)
    // Total length of time required to launch a rocket.
    let time = perLaunch.div(rate).add(rocketLaunchDuration)
    let launchRate = time.reciprocate()
    let partRate = perLaunch.div(time)
    return {part: partRate, launch: launchRate}
}

class RocketLaunch extends Building {
    getRecipeRate(spec, recipe) {
        return launchRate(spec).launch
    }
}

class RocketSilo extends Building {
    getRecipeRate(spec, recipe) {
        return launchRate(spec).part
    }
}

export function getBuildings(data, items) {
    let buildings = []
    let reactorDef = items.get("nuclear-reactor")
    let reactor = new Building(
        "nuclear-reactor",
        reactorDef.name,
        reactorDef.icon_col,
        reactorDef.icon_row,
        ["nuclear"],
        one,
        zero,
        0,
        zero,
        null
    )
    reactor.tooltipKind = "plain"
    buildings.push(reactor)
    let boilerItem = items.get("boiler")
    let boilerDef
    for (let d of data.boilers) {
        if (d.key === "boiler") {
            boilerDef = d
            break
        }
    }
    let boiler_energy = Rational.from_float(boilerDef.energy_consumption)
    let boiler = new Building(
        "boiler",
        boilerItem.name,
        boilerItem.icon_col,
        boilerItem.icon_row,
        ["boiler"],
        one,
        zero,
        0,
        boiler_energy,
        "chemical",
        //boilerDef.target_temperature,
    )
    boiler.tooltipKind = "plain"
    buildings.push(boiler)
    let siloDef = items.get("rocket-silo")
    let launch = new RocketLaunch(
        "rocket-silo",
        siloDef.name,
        siloDef.icon_col,
        siloDef.icon_row,
        ["rocket-launch"],
        one,
        zero,
        0,
        zero,
        null
    )
    launch.tooltipKind = "plain"
    buildings.push(launch)
    for (let d of data.crafting_machines) {
        let fuel = null
        if (d.energy_source && d.energy_source.type === "burner") {
            fuel = d.energy_source.fuel_category
        }
        let prod = zero
        if (d.prod_bonus) {
            prod = Rational.from_float_approximate(d.prod_bonus)
        }
        let building = new Building(
            d.key,
            d.localized_name.en,
            d.icon_col,
            d.icon_row,
            d.crafting_categories,
            Rational.from_float_approximate(d.crafting_speed),
            prod,
            d.module_slots,
            Rational.from_float_approximate(d.energy_usage),
            fuel
        )
        building.takesQuality = true
        buildings.push(building)
    }
    for (let d of data.rocket_silo) {
        buildings.push(new RocketSilo(
            d.key,
            d.localized_name.en,
            d.icon_col,
            d.icon_row,
            d.crafting_categories,
            Rational.from_float_approximate(d.crafting_speed),
            zero,
            d.module_slots,
            Rational.from_float_approximate(d.energy_usage),
            null
        ))
    }
    for (let d of data.offshore_pumps) {
        // Pumping speed is given in units/tick.
        let speed = Rational.from_float_approximate(d.pumping_speed).mul(Rational.from_float(60))
        buildings.push(new OffshorePump(
            d.key,
            d.localized_name.en,
            d.icon_col,
            d.icon_row,
            speed,
        ))
    }
    for (let d of data.mining_drills) {
        let fuel = null
        if (d.energy_source && d.energy_source.type === "burner") {
            fuel = d.energy_source.fuel_category
        }
        buildings.push(new Miner(
            d.key,
            d.localized_name.en,
            d.icon_col,
            d.icon_row,
            d.resource_categories,
            Rational.from_float_approximate(d.mining_speed),
            d.module_slots,
            Rational.from_float_approximate(d.energy_usage),
            fuel
        ))
    }
    // allowed_effects by key: crafting machines, silos and drills carry it.
    let defs = new Map([...data.crafting_machines, ...data.rocket_silo, ...data.mining_drills].map(d => [d.key, d]))
    for (let building of buildings) {
        let def = defs.get(building.key)
        if (def !== undefined) {
            building.allowedEffects = allowedEffectsOf(def)
        }
    }
    return buildings
}
