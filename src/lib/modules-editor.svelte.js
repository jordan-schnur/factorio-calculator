// The module editor's state (selected slot, "Use these modules for" choice, next module tier) and the edits it makes.
import { on as onEvent } from "svelte/events"
import { SvelteMap } from "svelte/reactivity"
import { isOwnHash } from "./fragment.js"
import { beaconData } from "./module.js"
import {
    beaconWhyNot, effectsOf, kindOf, moduleFor, moduleLabel, num, paletteRows, resolveModules, rowMachines, tierOf, whyNot,
} from "./modules-core.js"
import { beaconPowerMultiplier, isNormal, tierOf as qualityTier } from "./quality-core.js"

export const MAX_BEACONS = 16
const FIRST_BEACONS = 8

const selection = new SvelteMap()
const chosenTarget = new SvelteMap()
const pickTier = new SvelteMap()

// init.js calls this once in the browser: opening another row, or a link from outside, forgets every scope choice.
export function initModulesEditor() {
    onEvent(document, "calc:select", () => chosenTarget.clear())
    onEvent(window, "hashchange", () => {
        if (!isOwnHash(window.location.hash)) chosenTarget.clear()
    })
}

function mountKey(opts) {
    return opts.scope === "row" ? `row:${opts.recipe.key}` : `machine:${opts.machine.key}`
}

export function nextTier(opts) {
    return pickTier.get(mountKey(opts)) || "normal"
}

// What an edit starts from: the row's own ModuleSpec, or a layer's raw entry, never the row's fallback.
export function currentEntry(spec, opts, target) {
    let source
    if (target === "row" || (opts.scope === "row" && spec.handSet.has(opts.recipe.key))) {
        source = spec.getModuleSpec(opts.recipe)
    } else if (target === "machine") {
        source = spec.machineModules.get(opts.machine.key) ||
            resolveModules({ recipe: null, machine: opts.machine, plan: spec.planLayer(), machineLayer: null })
    } else {
        const layer = spec.planLayer()
        source = {
            modules: new Array(opts.machine.moduleSlots).fill(layer.defaultModule),
            moduleTiers: new Array(opts.machine.moduleSlots).fill(layer.defaultModuleTier),
            beaconModules: layer.defaultBeacon,
            beaconModuleTiers: layer.defaultBeaconTiers,
            beaconCount: layer.defaultBeaconCount,
            beaconTier: layer.defaultBeaconTier,
        }
    }
    const tiers = source.moduleTiers || []
    const beaconTiers = source.beaconModuleTiers || []
    const beaconModules = [source.beaconModules[0] ?? null, source.beaconModules[1] ?? null]
    return {
        modules: source.modules.slice(),
        moduleTiers: source.modules.map((m, i) => m ? qualityTier(tiers[i]).key : "normal"),
        beaconModules,
        beaconModuleTiers: beaconModules.map((m, i) => m ? qualityTier(beaconTiers[i]).key : "normal"),
        beaconCount: num(source.beaconCount),
        beaconTier: qualityTier(source.beaconTier).key,
    }
}

// Whether the next edit could go to the plan: one module in every slot, and no single slot selected.
function planWritable(spec, opts, sel) {
    const entry = currentEntry(spec, opts, "plan")
    return !(sel && sel.kind === "slot") &&
        entry.modules.every(m => m === entry.modules[0]) &&
        entry.moduleTiers.every(t => t === entry.moduleTiers[0])
}

function defaultTarget(spec, opts) {
    return spec.moduleSource(opts.recipe) === "machine" ? "machine" : "row"
}

// Pins a row editor's scope the first time it draws, and moves a stale "plan" back to "row"; call inside untrack().
export function rememberTarget(spec, opts) {
    if (opts.scope !== "row" || spec === null) return
    const key = mountKey(opts)
    const chosen = chosenTarget.get(key)
    if (chosen === undefined) chosenTarget.set(key, defaultTarget(spec, opts))
    else if (chosen === "plan" && !planWritable(spec, opts, null)) chosenTarget.set(key, "row")
}

// Where the next edit goes: "row", "machine" or "plan"; never "plan" while the plan can't hold what the row has.
export function currentTarget(spec, opts) {
    if (opts.scope === "machine") return "machine"
    const chosen = chosenTarget.get(mountKey(opts)) ?? defaultTarget(spec, opts)
    return chosen === "plan" && !planWritable(spec, opts, null) ? "row" : chosen
}

// The selected slot {kind: "slot" | "beacon", index}, or null; one slot can't be selected while editing the plan.
export function selectedSlot(opts, target) {
    const sel = selection.get(mountKey(opts)) ?? null
    return sel?.kind === "slot" && target === "plan" ? null : sel
}

// Writes `entry` to the `target` layer in one spec.commitModules(), which re-renders or re-solves.
export function write(spec, opts, target, entry) {
    if (!entry.beaconModules[0] && !entry.beaconModules[1]) {
        entry = { ...entry, beaconCount: 0 }
    }
    spec.commitModules(() => {
        if (target === "row") {
            spec.setRowModules(opts.recipe, entry)
        } else if (target === "machine") {
            if (opts.recipe) spec.releaseRow(opts.recipe)
            spec.setMachineModules(opts.machine.key, entry)
        } else {
            spec.releaseRow(opts.recipe)
            const layer = spec.planLayer()
            const module = entry.modules[0] ?? null
            spec.setPlanLayer({
                defaultModule: module,
                defaultModuleTier: entry.moduleTiers[0] ?? "normal",
                secondaryDefaultModule: module && kindOf(module) === "productivity" ? layer.secondaryDefaultModule : null,
                secondaryDefaultModuleTier: layer.secondaryDefaultModuleTier,
                defaultBeacon: entry.beaconModules,
                defaultBeaconTiers: entry.beaconModuleTiers,
                defaultBeaconCount: entry.beaconCount,
                defaultBeaconTier: entry.beaconTier,
            })
        }
    })
}

// A palette click: fills the selected slot (or beacon slot), or every slot when none is selected.
export function pick(spec, opts, module) {
    const key = mountKey(opts)
    const target = currentTarget(spec, opts)
    const entry = currentEntry(spec, opts, target)
    const sel = selection.get(key)
    const tier = module ? nextTier(opts) : "normal"
    if (sel && sel.kind === "beacon") {
        if (target === "plan") {
            entry.beaconModules = [module, module]
            entry.beaconModuleTiers = [tier, tier]
        } else {
            entry.beaconModules[sel.index] = module
            entry.beaconModuleTiers[sel.index] = tier
        }
        if (module && entry.beaconCount === 0) {
            entry.beaconCount = FIRST_BEACONS
        }
    } else if (sel && sel.kind === "slot" && target !== "plan") {
        entry.modules[sel.index] = module
        entry.moduleTiers[sel.index] = tier
    } else {
        entry.modules = entry.modules.map(() => module)
        entry.moduleTiers = entry.modules.map(() => tier)
    }
    selection.delete(key)
    write(spec, opts, target, entry)
}

// The "Module quality" picker: the tier of the next module, and with a slot selected that slot's tier now.
export function chooseTier(spec, opts, tier) {
    const key = mountKey(opts)
    pickTier.set(key, tier)
    const sel = selection.get(key)
    if (!sel) return
    const target = currentTarget(spec, opts)
    const entry = currentEntry(spec, opts, target)
    if (sel.kind === "beacon") {
        for (const i of target === "plan" ? [0, 1] : [sel.index]) {
            if (entry.beaconModules[i]) entry.beaconModuleTiers[i] = tier
        }
    } else if (target !== "plan" && entry.modules[sel.index]) {
        entry.moduleTiers[sel.index] = tier
    }
    selection.delete(key)
    write(spec, opts, target, entry)
}

export function selectSlot(opts, kind, index) {
    const key = mountKey(opts)
    const sel = selection.get(key)
    if (sel && sel.kind === kind && sel.index === index) selection.delete(key)
    else selection.set(key, { kind, index })
}

export function backToPlan(spec, opts) {
    selection.delete(mountKey(opts))
    chosenTarget.set(mountKey(opts), "row")
    spec.commitModules(() => spec.releaseRow(opts.recipe))
}

// The radio only chooses where the next edit goes; it never writes by itself.
export function chooseScope(opts, target, value) {
    if (value === target) return
    selection.delete(mountKey(opts))
    chosenTarget.set(mountKey(opts), value)
}

// Beacon +/-: from empty, + fills both beacon slots with Speed so the count isn't dropped by write().
export function stepBeacons(spec, opts, target, entry, delta) {
    const next = Math.max(0, Math.min(MAX_BEACONS, entry.beaconCount + delta))
    if (next === entry.beaconCount) return
    const patch = { beaconCount: next }
    if (delta > 0 && !entry.beaconModules[0] && !entry.beaconModules[1]) {
        const layer = spec.planLayer()
        const tier = layer.defaultModule ? tierOf(layer.defaultModule) : 3
        const fill = moduleFor(spec.modules.values(), "speed", tier) || moduleFor(spec.modules.values(), "speed", 3)
        patch.beaconModules = [fill, fill]
    }
    write(spec, opts, target, { ...entry, ...patch })
}

export function hintText(sel, target) {
    if (sel && sel.kind === "beacon") {
        return target === "plan"
            ? "Beacons: the next module goes in both beacon slots."
            : `Beacon slot ${sel.index + 1} is selected: the next module goes in that beacon slot only.`
    }
    if (target === "plan") {
        return "Every slot takes the same module while it's the plan default."
    }
    if (sel) {
        return `Slot ${sel.index + 1} is selected: the next module goes in that slot only.`
    }
    return "Click a module to fill every slot, or click a slot first to change just that one."
}

export function slotTitle(module, tier, index) {
    return `Slot ${index + 1}: ${moduleLabel(module)}` + (module && !isNormal(tier) ? ` (${qualityTier(tier).name})` : "")
}

// The palette's rows, each pick with why it's greyed out (null when allowed); only "row" also checks this row's recipe.
export function paletteLines(spec, opts, sel, target) {
    const forBeacon = sel?.kind === "beacon"
    const reasonFor = module => forBeacon
        ? beaconWhyNot(module, beaconData.allowedEffects)
        : whyNot(module, target === "row" ? opts.recipe : null, opts.machine)
    const pickOf = (module, title) => ({ module, key: module ? module.key : "null", reason: reasonFor(module), title })
    const lines = paletteRows(spec.modules.values()).map(line => ({ label: line.label, picks: line.modules.map(m => pickOf(m, moduleLabel(m))) }))
    return [...lines, { label: "Empty", picks: [pickOf(null, "Empty slot")] }]
}

// The Speed / Productivity / Power bars: each multiplier, whether it helps, and its bar width (300% fills the bar).
export function effectRows(spec, opts, entry) {
    const fx = effectsOf({ ...entry, machineProd: num(opts.machine.prodEffect(spec)), beacon: beaconData })
    const rows = [["speed", "Speed", fx.speed], ["prod", "Productivity", fx.prod], ["power", "Power", fx.power]].map(([key, label, value]) => {
        const pct = (value - 1) * 100
        return { key, label, value, good: key === "power" ? pct <= 0 : pct >= 0, width: `${Math.min(Math.abs(pct), 300) / 3}%` }
    })
    return { rows, floored: fx.floored }
}

// The row's machines and power with no modules, the layers' modules and these modules, from its output rate.
export function compareCells(spec, opts, entry) {
    const { recipe, machine } = opts
    const item = opts.row.item
    const output = opts.row.recipeRate.mul(recipe.gives(item))
    const amount = recipe.products.find(p => p.item === item).amount.toFloat()
    const speedNow = spec.getModuleSpec(recipe).speedEffect().toFloat()
    const base = {
        output: output.toFloat(),
        amount,
        net: amount - recipe.uses(item).toFloat(),
        baseRate: machine.getRecipeRate(spec, recipe).toFloat() / speedNow,
        powerW: machine.power.toFloat(),
        drainW: machine.drain().toFloat(),
    }
    const machineProd = num(machine.prodEffect(spec))
    const cells = [
        ["none", "No modules", { modules: entry.modules.map(() => null), beaconModules: [null, null], beaconCount: 0 }],
        ["plan", "Plan default", spec.resolveFor(recipe, machine)],
        ["these", "These modules", entry],
    ].map(([key, label, e]) => ({ key, label, ...rowMachines({ ...base, effects: effectsOf({ ...e, machineProd, beacon: beaconData }) }) }))
    return { output, cells, beaconWatts: beaconData.powerW * beaconPowerMultiplier(entry.beaconTier).toFloat() }
}

export function scopeChoices(spec, opts, target, sel) {
    const expressible = target === "plan" || planWritable(spec, opts, sel)
    return [
        { value: "row", text: `Just ${opts.recipe.name.toLowerCase()}`, enabled: true, why: "" },
        { value: "machine", text: `Every row made in ${opts.machine.name.toLowerCase()}`, enabled: true, why: "" },
        { value: "plan", text: "Every row (makes them the plan default)", enabled: expressible, why: expressible ? "" : "Mixed modules can't be a plan default" },
    ]
}

const SCOPE_NOTE = {
    row: "Only this row changes. It is marked set by hand, and changes to the plan or the machine leave it alone.",
    machine: "Every row made in this machine changes, except rows set by hand.",
    plan: "Every row without its own setting changes. Machines with their own setting and rows set by hand keep theirs.",
}

// What an edit on `target` would really do to this row, since the radio itself never writes.
export function scopeNote(spec, opts, target) {
    const hasMachineEntry = spec.machineModules.has(opts.machine.key)
    if (spec.handSet.has(opts.recipe.key) && (target === "machine" || target === "plan")) {
        const destination = target === "machine" ? `${opts.machine.name}'s setting` : "the plan"
        let note = `${opts.recipe.name} is set by hand. An edit here goes to ${destination} and this row follows it from then on.`
        if (target === "plan" && hasMachineEntry) {
            note += ` ${opts.machine.name} has its own setting, so this row will follow that.`
        }
        return note
    }
    if (target === "plan" && hasMachineEntry) {
        return `${opts.machine.name} has its own setting, so this row keeps it. Change it under Every row made in ${opts.machine.name.toLowerCase()}.`
    }
    return SCOPE_NOTE[target]
}
