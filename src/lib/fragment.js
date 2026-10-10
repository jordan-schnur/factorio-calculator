// SPDX-License-Identifier: Apache-2.0 · Copyright 2019-2021 Kirk McDonald
import pako from "pako"
import { DEFAULT_RATE, DEFAULT_RATE_PRECISION, DEFAULT_COUNT_PRECISION, DEFAULT_FORMAT, DEFAULT_BELT_FORMAT } from "./align.js"
import { spec, DEFAULT_BELT, DEFAULT_FUEL } from "./factory.js"
import { formatRecipeMachines } from "./machines-core.js"
import { formatModuleList } from "./modules-core.js"
import { formatMachineQuality, isNormal, joinModuleToken, tierOf as qualityTier } from "./quality-core.js"
import { Rational } from "./rational.js"
import { currentMod, customTitle } from "./settings.js"
import { sorted } from "./sort.js"

// The page is one screen now; "tab=" is only read/written for links minted before the redesign.
const DEFAULT_TAB = "flow"

// One `mm=`/`modules=` entry with every slot listed in order, so slot
// positions survive a round trip. Each module token carries its tier
// ("p3@legendary"); the beacon part gains a 4th field, the beacon's own
// tier, only when that isn't normal (calculator 1.3.0).
function moduleEntry(key, modules, moduleTiers, beaconModules, beaconModuleTiers, beaconCount, beaconTier) {
    let beacon = [
        moduleToken(beaconModules[0], beaconModuleTiers[0]),
        moduleToken(beaconModules[1], beaconModuleTiers[1]),
        beaconCount.toString(),
    ]
    if (!isNormal(beaconTier)) {
        beacon.push(qualityTier(beaconTier).key)
    }
    return {key, slots: modules.map((m, i) => moduleToken(m, moduleTiers[i])), beacon}
}

// "null" for an empty slot, else the module's short name with "@<tier>"
// when it isn't normal.
function moduleToken(module, tier) {
    return module === null || module === undefined ? "null" : joinModuleToken(module.shortName(), tier)
}

export function formatSettings(excludeTitle, overrideTab, targets) {
    let settings = ""
    if (!excludeTitle && customTitle !== "") {
        settings += "title=" + encodeURIComponent(customTitle) + "&"
    }
    settings += "data=" + currentMod() + "&"
    let tab = DEFAULT_TAB
    if (overrideTab) {
        tab = overrideTab
    }
    if (tab !== DEFAULT_TAB) {
        settings += "tab=" + tab + "&"
    }
    if (spec.format.rateName !== DEFAULT_RATE) {
        settings += "rate=" + spec.format.rateName + "&"
    }
    if (spec.format.ratePrecision !== DEFAULT_RATE_PRECISION) {
        settings += "rp=" + spec.format.ratePrecision + "&"
    }
    if (spec.format.countPrecision !== DEFAULT_COUNT_PRECISION) {
        settings += "cp=" + spec.format.countPrecision + "&"
    }
    if (spec.format.displayFormat !== DEFAULT_FORMAT) {
        settings += "vf=" + spec.format.displayFormat[0] + "&"
    }
    if (spec.format.beltFormat && spec.format.beltFormat !== DEFAULT_BELT_FORMAT) {
        settings += "bf=d&"
    }
    if (!spec.miningProd.isZero()) {
        let hundred = Rational.from_float(100)
        let mprod = spec.miningProd.mul(hundred).toString()
        settings += "mprod=" + mprod + "&"
    }
    let buildings = []
    let groupSet = new Set(spec.buildings.values())
    for (let group of groupSet) {
        if (group.building !== group.getDefault()) {
            buildings.push(group.building.key)
        }
    }
    if (buildings.length > 0) {
        settings += "buildings=" + buildings.join(",") + "&"
    }
    if (spec.excludedBuildings.size > 0) {
        settings += "nomach=" + [...spec.excludedBuildings].sort().join(",") + "&"
    }
    if (spec.recipeBuildings.size > 0) {
        settings += "mach=" + formatRecipeMachines(spec.recipeBuildings) + "&"
    }
    let mq = formatMachineQuality(spec.machineQuality)
    if (mq !== "") {
        settings += "mq=" + mq + "&"
    }
    if (spec.belt.key !== DEFAULT_BELT) {
        settings += "belt=" + spec.belt.key + "&"
    }
    if (spec.fuel.key !== DEFAULT_FUEL) {
        settings += "fuel=" + spec.fuel.key + "&"
    }
    if (spec.defaultModule !== null) {
        settings += "dm=" + moduleToken(spec.defaultModule, spec.defaultModuleTier) + "&"
    }
    if (spec.secondaryDefaultModule !== null) {
        settings += "dm2=" + moduleToken(spec.secondaryDefaultModule, spec.secondaryDefaultModuleTier) + "&"
    }
    if (!spec.isDefaultDefaultBeacon()) {
        let parts = spec.defaultBeacon.map((module, i) => moduleToken(module, spec.defaultBeaconTiers[i]))
        settings += "db=" + parts.join(":") + "&"
    }
    if (!spec.defaultBeaconCount.isZero()) {
        settings += "dbc=" + spec.defaultBeaconCount.toDecimal(0) + "&"
    }
    if (!isNormal(spec.defaultBeaconTier)) {
        settings += "dbq=" + qualityTier(spec.defaultBeaconTier).key + "&"
    }
    if (spec.machineModules.size > 0) {
        let entries = [...spec.machineModules].map(([key, e]) =>
            moduleEntry(key, e.modules, e.moduleTiers, e.beaconModules, e.beaconModuleTiers, e.beaconCount, e.beaconTier))
        settings += "mm=" + formatModuleList(entries) + "&"
    }
    settings += "items="
    let targetStrings = []
    if (targets) {
        for (let [item, rate] of targets) {
            targetStrings.push(`${item.key}:r:${rate.mul(spec.format.rateFactor).toString()}`)
        }
    } else {
        for (let target of spec.buildTargets) {
            let targetString = ""
            if (target.changedBuilding) {
                targetString = `${target.itemKey}:f:${target.buildingInput.value}`
                if (target.recipe !== null && target.recipe !== target.defaultRecipe) {
                    targetString += `:${target.recipe.key}`
                }
            } else {
                targetString = `${target.itemKey}:r:${target.rate.mul(spec.format.rateFactor).toString()}`
            }
            targetStrings.push(targetString)
        }
    }
    settings += targetStrings.join(",")

    let ignore = []
    for (let item of spec.ignore) {
        ignore.push(item.key)
    }
    if (ignore.length > 0) {
        settings += "&ignore=" + ignore.join(",")
    }
    if (spec.sendOut.size > 0) {
        settings += "&out=" + [...spec.sendOut].sort().join(",")
    }

    // An empty save name means "whichever save is newest", so it is written
    // out as `save=` rather than omitted.
    if (spec.saveState.save !== null) {
        settings += "&save=" + encodeURIComponent(spec.saveState.save)
    }
    if (spec.saveState.follow) {
        settings += "&follow=1"
    }
    if (spec.saveState.overrides.size > 0) {
        settings += "&ov=" + [...spec.saveState.overrides].join(",")
    }
    if (spec.whereItem !== null) {
        settings += "&item=" + spec.whereItem
    }
    if (spec.view === "graph") {
        settings += "&view=graph"
    }

    if (!spec.isDefaultPlanet()) {
        let planets = []
        for (let p of sorted(spec.selectedPlanets, p => p.order)) {
            planets.push(p.key)
        }
        settings += "&planet=" + planets.join(",")
    }
    let {disable, enable} = spec.getNetDisable()
    if (disable.size !== 0) {
        let parts = []
        for (let d of disable) {
            parts.push(d.key)
        }
        settings += "&disable=" + parts.join(",")
    }
    if (enable.size !== 0) {
        let parts = []
        for (let d of enable) {
            parts.push(d.key)
        }
        settings += "&enable=" + parts.join(",")
    }

    // Only rows set by hand, every slot listed; the rest come from the layers.
    let moduleEntries = []
    for (let [recipe, moduleSpec] of spec.spec) {
        if (spec.handSet.has(recipe.key)) {
            moduleEntries.push(moduleEntry(recipe.key, moduleSpec.modules, moduleSpec.moduleTiers,
                moduleSpec.beaconModules, moduleSpec.beaconModuleTiers, moduleSpec.beaconCount, moduleSpec.beaconTier))
        }
    }
    if (moduleEntries.length > 0) {
        settings += "&modules=" + formatModuleList(moduleEntries)
    }

    if (!spec.isDefaultPriority()) {
        let priority = []
        for (let level of spec.priority) {
            let keys = []
            for (let {recipe, weight} of level) {
                keys.push(`${recipe.key}=${weight.toString()}`)
            }
            priority.push(keys.join(","))
        }
        settings += "&priority=" + priority.join(";")
    }

    let zip = "zip=" + window.btoa(String.fromCharCode.apply(null, pako.deflateRaw(settings)))
    if (zip.length < settings.length) {
        return zip
    }
    return settings
}

export function loadSettings(fragment) {
    let settings = new Map()
    fragment = fragment.substr(1)
    let pairs = fragment.split("&")
    for (let pair of pairs) {
        let i = pair.indexOf("=")
        if (i === -1) {
            continue
        }
        let name = pair.substr(0, i)
        let value = pair.substr(i + 1)
        settings.set(name, value)
    }
    if (settings.has("zip")) {
        let z = window.atob(settings.get("zip"))
        let a = z.split("").map(c => c.charCodeAt(0))
        let unzip = pako.inflateRaw(a, {to: "string"})
        return loadSettings("#" + unzip)
    }
    return settings
}

// The last fragment this page wrote or reloaded; isOwnHash() compares against it.
let lastWrittenHash = null

export function rememberHash(hash) {
    lastWrittenHash = hash
}

export function writeHash(hash) {
    rememberHash(hash)
    window.location.hash = hash
}

export function isOwnHash(hash) {
    if (hash === lastWrittenHash) return true
    try {
        return decodeURIComponent(hash || "") === decodeURIComponent(lastWrittenHash || "")
    } catch (err) {
        return false
    }
}
