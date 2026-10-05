/*Copyright 2015-2024 Kirk McDonald

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.*/
import { makeDropdown, addInputs } from "./dropdown.js"
import { Icon, sprites } from "./icon.js"
import { useLegacyCalculation } from "./init.js"
import { allowedEffectsOf, canBeacon as beaconTakes, canUse } from "./modules-core.js"
import { Rational, zero, half, one } from "./rational.js"
import { sorted } from "./sort.js"

let hundred = Rational.from_float(100)
function percent(x) {
    let sign = ""
    if (!x.less(zero)) {
        sign = "+"
    }
    return `${sign}${x.mul(hundred).toDecimal()}%`
}

class Module {
    constructor(key, name, col, row, category, order, productivity, speed, power, effect) {
        // Other module effects not modeled by this calculator.
        this.key = key
        this.name = name
        this.category = category
        this.order = order
        this.productivity = productivity
        this.speed = speed
        this.power = power
        // Every effect as a float, {speed, productivity, consumption,
        // pollution, quality}: modules-core.js reads it to decide which
        // machines and beacons take this module.
        this.effect = effect

        this.icon_col = col
        this.icon_row = row
        this.icon = new Icon(this)
    }
    // This naming scheme is some older cruft, which works in the vanilla
    // dataset, but it's possible other datasets would render it unworkable.
    shortName() {
        return this.key[0] + this.key[this.key.length - 1]
    }
    // Whether a beacon can hold this module: the data's beacon
    // allowed_effects (speed and efficiency in 2.0), so quality modules
    // stay out as well as productivity.
    canBeacon() {
        return beaconTakes(this, beaconData.allowedEffects)
    }
    hasProdEffect() {
        return !this.productivity.isZero()
    }
    renderTooltip() {
        let self = this
        let t = d3.create("div")
            .classed("frame", true)
        let header = t.append("h3")
        header.append(() => self.icon.make(32, true))
        header.append(() => new Text(self.name))
        let line
        if (!this.power.isZero()) {
            line = t.append("div")
            line.append("b")
                .text("Energy consumption: ")
            line.append("span")
                .text(percent(this.power))
        }
        if (!this.speed.isZero()) {
            line = t.append("div")
            line.append("b")
                .text("Speed: ")
            line.append("span")
                .text(percent(this.speed))
        }
        if (!this.productivity.isZero()) {
            line = t.append("div")
            line.append("b")
                .text("Productivity: ")
            line.append("span")
                .text(percent(this.productivity))
        }
        return t.node()
    }
}

export function moduleDropdown(selector, data) {
    let moduleDropdownSpan = selector.selectAll("span.module-wrapper")
        .data(data)
        .join(
            enter => {
                let s = enter.append("span")
                    .classed("module-wrapper", true)
                makeDropdown(s)
                return s
            }
        )
    let moduleDropdown = moduleDropdownSpan.selectAll("div.dropdown")
    moduleDropdown.selectAll("div.moduleRow")
        .data(d => d.inputRows)
        .join("div")
            .classed("moduleRow", true)
            .selectAll("span.input")
            .data(d => d)
            .join(
                enter => {
                    let s = enter.append("span")
                        .classed("input", true)
                    let label = addInputs(
                        s,
                        d => d.cell.name,
                        d => d.checked(),
                        d => d.choose(),
                    )
                    label.append(function(d) {
                        if (d.module === null) {
                            return sprites.get("slot_icon_module").icon.make(32)
                        } else {
                            return d.module.icon.make(32, false, this.parentNode.parentNode.parentNode)
                        }
                    })
                    return s
                },
                update => {
                    update.selectAll("input").property("checked", d => d.checked())
                    return update
                },
            )
}

// ModuleSpec represents the set of modules (including beacons) configured for
// a given recipe.
export class ModuleSpec {
    // Empty until FactorySpecification fills it from the layers
    // (applyResolved) or a fragment's `modules=` entry.
    constructor(recipe, spec) {
        this.recipe = recipe
        this.building = null
        this.modules = []
        this.beaconModules = [null, null]
        this.beaconCount = zero
    }
    // Takes what modules-core.js's resolveModules worked out for this recipe
    // in `building`.
    applyResolved(building, resolved) {
        this.building = building
        this.modules = resolved.modules.slice()
        this.beaconModules = [resolved.beaconModules[0], resolved.beaconModules[1]]
        this.beaconCount = resolved.beaconCount
    }
    // A row set by hand moved to `building`: its own modules stay, a slot
    // the new machine adds takes what the layers say, and a module the new
    // machine refuses leaves its slot empty.
    setBuilding(building, spec) {
        this.building = building
        let resolved = spec.resolveFor(this.recipe, building)
        if (this.modules.length > building.moduleSlots) {
            this.modules.length = building.moduleSlots
        }
        while (this.modules.length < building.moduleSlots) {
            this.modules.push(resolved.modules[this.modules.length])
        }
        this.modules = this.modules.map(m => canUse(m, this.recipe, building) ? m : null)
    }
    getModule(index) {
        return this.modules[index]
    }
    // Returns true if the module change requires a recalculation.
    setModule(index, module) {
        if (index >= this.modules.length) {
            return false
        }
        let oldModule = this.modules[index]
        let needRecalc = (oldModule && oldModule.hasProdEffect()) || (module && module.hasProdEffect())
        this.modules[index] = module
        return needRecalc
    }
    setBeaconModule(module, i) {
        this.beaconModules[i] = module
    }
    setBeaconCount(count) {
        this.beaconCount = count
    }
    speedEffect() {
        let speed = one
        for (let module of this.modules) {
            if (!module) {
                continue
            }
            speed = speed.add(module.speed)
        }
        if (this.modules.length > 0 && !this.beaconCount.isZero()) {
            for (let module of this.beaconModules) {
                if (module === null) {
                    continue
                }
                let beacon = module.speed.mul(this.beaconCount).mul(beaconEffect)
                if (!useLegacyCalculation) {
                    let i = this.beaconCount.ceil().toFloat() - 1
                    if (i >= beaconProfile.length) {
                        i = beaconProfile.length - 1
                    }
                    beacon = beacon.mul(beaconProfile[i])
                }
                speed = speed.add(beacon)
            }
        }
        // The game never runs a machine below 20% speed, however many
        // productivity or quality modules slow it. Without the floor, eight
        // productivity modules made a negative speed and a negative count.
        let minimum = Rational.from_floats(1, 5)
        if (speed.less(minimum)) {
            speed = minimum
        }
        return speed
    }
    prodEffect(spec) {
        let prod = one
        for (let module of this.modules) {
            if (!module) {
                continue
            }
            prod = prod.add(module.productivity)
        }
        prod = prod.add(this.building.prodEffect(spec))
        return prod
    }
    powerEffect(spec) {
        let power = one
        for (let module of this.modules) {
            if (!module) {
                continue
            }
            power = power.add(module.power)
        }
        if (this.modules.length > 0 && !this.beaconCount.isZero()) {
            for (let module of this.beaconModules) {
                if (module === null) {
                    continue
                }
                let beacon = module.power.mul(this.beaconCount).mul(beaconEffect)
                if (!useLegacyCalculation) {
                    let i = this.beaconCount.ceil().toFloat() - 1
                    if (i >= beaconProfile.length) {
                        i = beaconProfile.length - 1
                    }
                    beacon = beacon.mul(beaconProfile[i])
                }
                power = power.add(beacon)
            }
        }
        let minimum = Rational.from_floats(1, 5)
        if (power.less(minimum)) {
            power = minimum
        }
        return power
    }
}

export let moduleRows = null
export let shortModules = null

let beaconProfile
let beaconEffect

// The beacon as modules-core.js reads it: which module effects it takes,
// what one draws, and the floats effectsOf() needs. Set by getModules().
export let beaconData = null

export function getModules(data, items) {
    let modules = new Map()
    for (let d of data.modules) {
        let item = items.get(d.item_key)
        let effect = d.effect
        let category = d.category
        let order = item.order
        let speed = Rational.from_float_approximate(effect.speed || 0)
        let productivity = Rational.from_float_approximate(effect.productivity || 0)
        let power = Rational.from_float_approximate(effect.consumption || 0)
        modules.set(d.item_key, new Module(
            d.item_key,
            item.name,
            item.icon_col,
            item.icon_row,
            category,
            order,
            productivity,
            speed,
            power,
            {
                speed: effect.speed || 0,
                productivity: effect.productivity || 0,
                consumption: effect.consumption || 0,
                pollution: effect.pollution || 0,
                quality: effect.quality || 0,
            },
        ))
    }
    let sortedModules = sorted(modules.values(), m => m.order)
    moduleRows = [[null]]
    shortModules = new Map()
    let category = null
    for (let module of sortedModules) {
        if (module.category !== category) {
            category = module.category
            moduleRows.push([])
        }
        moduleRows[moduleRows.length - 1].push(module)
        let shortName = module.shortName()
        if (shortModules.has(shortName)) {
            // This does not occur in the vanilla data, but let's plan ahead.
            module.shortName = function() { return this.key }
            shortName = module.key
        }
        shortModules.set(shortName, module)
    }
    beaconEffect = Rational.from_float_approximate(data.beacon.distribution_effectivity)
    if (useLegacyCalculation) {
        beaconProfile = null
    } else {
        beaconProfile = []
        for (let x of data.beacon.profile) {
            beaconProfile.push(Rational.from_float_approximate(x))
        }
    }
    beaconData = {
        allowedEffects: allowedEffectsOf(data.beacon),
        powerW: data.beacon.energy_usage || 0,
        distributionEffectivity: data.beacon.distribution_effectivity,
        profile: useLegacyCalculation || !data.beacon.profile ? null : data.beacon.profile.slice(),
    }
    return modules
}
