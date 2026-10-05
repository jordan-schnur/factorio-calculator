// calc/modules-core.js — which modules each row gets, and what they do.
// Pure: no DOM, no spec, no Rational, so tests/js/calc_modules_check.mjs
// runs it under node. The page's Module/Building/Recipe objects carry the
// fields read here:
//   module:  {key, name, category, effect: {speed, productivity, consumption, pollution, quality}}
//   machine: {key, name, moduleSlots, allowedEffects: Set<string> | null}
//            (null: the data names no allowed_effects, so all are allowed)
//   recipe:  {key, name, allow_productivity}
//   plan:    {defaultModule, secondaryDefaultModule, defaultBeacon: [m, m], defaultBeaconCount}
// A count may be a number or a Rational (anything with toFloat()); one
// handed to resolveModules comes back untouched.
// Layers (docs/superpowers/specs/2026-10-04-per-recipe-modules-design.md):
// a row set by hand wins over its machine's entry, which wins over the plan.

// The direction in which each effect helps. The game checks only the
// effects a module improves against allowed_effects: a speed module's -10%
// quality does not keep it out of a beacon, which has no "quality".
const HELPS = {speed: 1, productivity: 1, quality: 1, consumption: -1, pollution: -1}

// What the page calls each effect when one is refused.
const WORD = {speed: "speed", productivity: "productivity", quality: "quality", consumption: "efficiency", pollution: "pollution"}

const KIND_LABEL = {productivity: "Productivity", speed: "Speed", efficiency: "Efficiency", quality: "Quality"}

// The palette's row order.
export const KINDS = ["productivity", "speed", "efficiency", "quality"]

export function num(x) {
    return typeof x === "number" ? x : x.toFloat()
}

// "efficiency", also for 1.1's "effectivity" modules.
export function kindOf(module) {
    return module.category === "effectivity" ? "efficiency" : module.category
}

// 3 for "speed-module-3", 1 for "speed-module".
export function tierOf(module) {
    let match = /-(\d+)$/.exec(module.key)
    return match ? Number(match[1]) : 1
}

// "Productivity 3", "Speed 1".
export function moduleLabel(module) {
    if (module === null) {
        return "Empty"
    }
    let kind = KIND_LABEL[kindOf(module)]
    return kind ? `${kind} ${tierOf(module)}` : module.name
}

// The effects `module` improves, e.g. ["productivity"] for a productivity
// module (its speed, power and pollution penalties are not asked for).
export function benefits(module) {
    let out = []
    for (let [name, sign] of Object.entries(HELPS)) {
        let value = (module.effect && module.effect[name]) || 0
        if (value * sign > 0) {
            out.push(name)
        }
    }
    return out
}

// A machine or beacon definition's allowed_effects as a Set, or null when
// the data leaves it out (the game then allows every effect).
export function allowedEffectsOf(def) {
    return Array.isArray(def.allowed_effects) ? new Set(def.allowed_effects) : null
}

function refusedEffect(module, allowed) {
    if (allowed === null || allowed === undefined) {
        return null
    }
    for (let effect of benefits(module)) {
        if (!allowed.has(effect)) {
            return effect
        }
    }
    return null
}

// Why `module` can't go in `machine` making `recipe`, or null when it can.
// `recipe` is null in Settings' By machine, where no one recipe is meant.
export function whyNot(module, recipe, machine) {
    if (module === null) {
        return null
    }
    if (recipe && !recipe.allow_productivity && benefits(module).includes("productivity")) {
        return `${recipe.name} can't take productivity`
    }
    let effect = refusedEffect(module, machine.allowedEffects)
    return effect ? `${machine.name} can't take ${WORD[effect]}` : null
}

export function canUse(module, recipe, machine) {
    return whyNot(module, recipe, machine) === null
}

// Why a beacon can't hold `module` (data.beacon.allowed_effects), or null.
export function beaconWhyNot(module, beaconAllowed) {
    if (module === null) {
        return null
    }
    return refusedEffect(module, beaconAllowed) ? `Beacons can't hold ${kindOf(module)} modules` : null
}

export function canBeacon(module, beaconAllowed) {
    return beaconWhyNot(module, beaconAllowed) === null
}

// What `recipe` in `machine` gets from the machine and plan layers. Per
// slot: the machine's entry if it has one, else the plan's default module;
// if the recipe or machine can't use that, the plan's secondary default if
// it can; else empty. Beacons come whole from the machine's entry if it has
// one, else from the plan. `fellBack` says why the first choice was
// refused somewhere: "recipe" (no productivity on this recipe), "machine",
// or null.
export function resolveModules({recipe, machine, plan, machineLayer}) {
    let entry = machineLayer ? machineLayer.get(machine.key) : undefined
    let modules = []
    let fellBack = null
    for (let i = 0; i < machine.moduleSlots; i++) {
        let first = entry ? (entry.modules[i] ?? null) : plan.defaultModule
        if (first === null || canUse(first, recipe, machine)) {
            modules.push(first)
            continue
        }
        if (fellBack === null) {
            let noProd = recipe && !recipe.allow_productivity && benefits(first).includes("productivity")
            fellBack = noProd ? "recipe" : "machine"
        }
        let second = plan.secondaryDefaultModule
        modules.push(second !== null && canUse(second, recipe, machine) ? second : null)
    }
    let beacons = entry || {beaconModules: plan.defaultBeacon, beaconCount: plan.defaultBeaconCount}
    return {
        modules,
        beaconModules: [beacons.beaconModules[0] ?? null, beacons.beaconModules[1] ?? null],
        beaconCount: beacons.beaconCount,
        source: entry ? "machine" : "plan",
        fellBack,
    }
}

// The table's muted line under a row whose recipe refused productivity.
export function fallbackNote(resolved) {
    if (resolved.fellBack !== "recipe") {
        return null
    }
    let module = resolved.modules.find(m => m !== null)
    return module ? `No productivity on this recipe, so ${moduleLabel(module)}` : "No productivity on this recipe, so no modules"
}

// Speed, productivity and power multipliers (1 = unchanged), the same sums
// as ModuleSpec's speedEffect/prodEffect/powerEffect: beacons count only on
// a machine with module slots, scaled by the beacon's distribution
// effectivity and its profile entry for that count; speed and power never
// fall below 20% (the game's -80% floor). `machineProd` is the machine's
// own bonus (a foundry's +50%, or mining productivity on a drill).
// beacon: {distributionEffectivity, profile: number[] | null}
export function effectsOf({modules, beaconModules, beaconCount, machineProd = 0, beacon}) {
    let speed = 1
    let prod = 1 + machineProd
    let power = 1
    for (let module of modules) {
        if (!module) continue
        speed += module.effect.speed || 0
        prod += module.effect.productivity || 0
        power += module.effect.consumption || 0
    }
    let count = num(beaconCount)
    if (modules.length > 0 && count > 0) {
        let scale = count * beacon.distributionEffectivity
        if (beacon.profile) {
            scale *= beacon.profile[Math.min(Math.ceil(count), beacon.profile.length) - 1]
        }
        for (let module of beaconModules) {
            if (!module) continue
            speed += (module.effect.speed || 0) * scale
            power += (module.effect.consumption || 0) * scale
        }
    }
    return {speed: Math.max(speed, 0.2), prod, power: Math.max(power, 0.2), floored: speed < 0.2}
}

// Machines and watts for one row making `output` items/s of a product the
// recipe yields `amount` of per craft, `net` of them beyond what the recipe
// also consumes (productivity applies to the net), where one machine with
// no modules does `baseRate` crafts/s, draws `powerW` and idles at `drainW`.
export function rowMachines({output, amount, net, baseRate, powerW, drainW, effects}) {
    let perCraft = amount + Math.max(net, 0) * (effects.prod - 1)
    let machines = output / perCraft / (baseRate * effects.speed)
    let watts = powerW * machines * effects.power + drainW * Math.ceil(machines - 1e-9)
    return {machines, watts}
}

export function powerWords(watts) {
    if (watts >= 1e6) {
        return `${(watts / 1e6).toFixed(1)} MW`
    }
    return `${Math.round(watts / 1e3)} kW`
}

// A multiplier as the signed percent the editor shows: 0.4 -> "−60%".
export function percentWords(multiplier) {
    let p = Math.round((multiplier - 1) * 100)
    return `${p < 0 ? "−" : "+"}${Math.abs(p)}%`
}

// The palette: one row per kind in KINDS order, tiers ascending, kinds the
// data set lacks (1.1 has no quality) left out.
export function paletteRows(modules) {
    let all = [...modules]
    return KINDS
        .map(kind => ({kind, label: KIND_LABEL[kind], modules: all.filter(m => kindOf(m) === kind).sort((a, b) => tierOf(a) - tierOf(b))}))
        .filter(row => row.modules.length > 0)
}

export function moduleFor(modules, kind, tier) {
    for (let module of modules) {
        if (kindOf(module) === kind && tierOf(module) === tier) {
            return module
        }
    }
    return null
}

// "Every row" in the editor takes only what the plan layer can say: every
// slot the same module (or all empty), and both beacon slots the same.
export function planExpressible(entry) {
    let first = entry.modules[0] ?? null
    if (!entry.modules.every(m => (m ?? null) === first)) {
        return false
    }
    return (entry.beaconModules[0] ?? null) === (entry.beaconModules[1] ?? null)
}

// The Settings strategy the plan layer reads as. `exact` is false when the
// buttons can't say all of it (dm=p3&dm2=e1, quality, two beacon kinds):
// the page then shows the real icons until a button is picked.
export function strategyOf(plan) {
    let dm = plan.defaultModule
    let dm2 = plan.secondaryDefaultModule
    let [b1, b2] = plan.defaultBeacon
    let kind = dm ? kindOf(dm) : "none"
    let tier = dm ? tierOf(dm) : b1 ? tierOf(b1) : b2 ? tierOf(b2) : 3
    let exact = kind !== "quality"
    let fallback = "none"
    if (kind === "productivity" && dm2) {
        fallback = kindOf(dm2)
        if (tierOf(dm2) !== tier || (fallback !== "speed" && fallback !== "efficiency")) exact = false
    } else if (dm2) {
        exact = false
    }
    let beacon
    if (!b1 && !b2) {
        beacon = "none"
    } else if (b1 && b1 === b2 && (kindOf(b1) === "speed" || kindOf(b1) === "efficiency")) {
        beacon = kindOf(b1)
        if (tierOf(b1) !== tier) exact = false
    } else {
        beacon = "mixed"
        exact = false
    }
    return {kind, tier, fallback, beacon, beaconCount: num(plan.defaultBeaconCount), exact}
}

// Picking "In every machine": Productivity starts out with Speed where it
// isn't allowed, unless it was already Productivity.
export function withKind(strategy, kind) {
    let fallback = "none"
    if (kind === "productivity") {
        fallback = strategy.kind === "productivity" ? strategy.fallback : "speed"
    }
    return {...strategy, kind, fallback}
}

// The plan layer for a strategy. `modules` is every Module in the data set.
export function planFromStrategy(strategy, modules) {
    let all = [...modules]
    let pick = kind => moduleFor(all, kind, strategy.tier)
    let dm = strategy.kind === "none" ? null : pick(strategy.kind)
    let dm2 = strategy.kind === "productivity" && strategy.fallback !== "none" ? pick(strategy.fallback) : null
    let beacon = strategy.beacon === "speed" || strategy.beacon === "efficiency" ? pick(strategy.beacon) : null
    return {
        defaultModule: dm,
        secondaryDefaultModule: dm2,
        defaultBeacon: [beacon, beacon],
        defaultBeaconCount: beacon ? strategy.beaconCount : 0,
    }
}

// "Productivity 3 in every slot of every machine, Speed 3 where
// productivity isn't allowed" (no full stop).
export function planSentence(plan) {
    let dm = plan.defaultModule
    let dm2 = plan.secondaryDefaultModule
    if (!dm) {
        return "No modules"
    }
    let sentence = `${moduleLabel(dm)} in every slot of every machine`
    if (dm2) {
        return `${sentence}, ${moduleLabel(dm2)} where ${kindOf(dm)} isn't allowed`
    }
    if (kindOf(dm) === "productivity") {
        return `${sentence}, left empty where productivity isn't allowed`
    }
    return sentence
}

// "8 beacons of Speed 3", "no beacons".
export function beaconPhrase(beaconModules, beaconCount) {
    let modules = beaconModules.filter(m => m)
    let count = num(beaconCount)
    if (modules.length === 0 || !(count > 0)) {
        return "no beacons"
    }
    let names = modules.length === 1 || modules[0] === modules[1]
        ? moduleLabel(modules[0])
        : `${moduleLabel(modules[0])} and ${moduleLabel(modules[1])}`
    return `${count} beacon${count === 1 ? "" : "s"} of ${names}`
}

// Settings' one-line summary of the plan layer.
export function summarySentence(plan) {
    let beacons = beaconPhrase(plan.defaultBeacon, plan.defaultBeaconCount)
    let tail = beacons === "no beacons" ? "No beacons." : `${beacons[0].toUpperCase()}${beacons.slice(1)} around each one.`
    return `${planSentence(plan)}. ${tail}`
}

// The `modules=` / `mm=` fragment values: comma-separated entries
// "<key>:<m>:<m>...;<b1>:<b2>:<count>", the beacon part optional. Kirk's
// legacy beacon form "<m>:<count>" has two parts; parts come back raw.
export function parseModuleList(text) {
    let out = []
    if (!text) {
        return out
    }
    for (let part of text.split(",")) {
        let [slotsText, beaconText] = part.split(";")
        let [key, ...slots] = slotsText.split(":")
        if (!key) continue
        out.push({key, slots, beacon: beaconText === undefined ? null : beaconText.split(":")})
    }
    return out
}

// Entries {key, slots: [string], beacon: [string] | null}, sorted by key so
// the fragment is stable.
export function formatModuleList(entries) {
    return [...entries]
        .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
        .map(e => [e.key, ...e.slots].join(":") + (e.beacon ? ";" + e.beacon.join(":") : ""))
        .join(",")
}
