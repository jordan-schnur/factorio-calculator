// calc/modules-editor.js — the module editor (calculator 1.2.0; spec
// docs/superpowers/specs/2026-10-04-per-recipe-modules-design.md, artboard
// 2). One component in two places: a row's details (scope "row", a
// full-width band under Needs / Goes to / Make here, details.js) and
// Settings -> Modules -> By machine (scope "machine", modules-settings.js).
//
// Picking a module or a beacon count writes straight to the layer the "Use
// these modules for" radio currently names, inside spec.commitModules(), so
// the page re-renders and the editor is mounted again from spec. The radio
// itself only chooses that layer for the *next* edit -- switching it never
// writes anything on its own (see scopeBlock). Its state of its own, the
// selected slot (`selection`) and the chosen radio (`chosenTarget`), lives
// across those re-renders; picking a slot or flipping the radio re-renders
// only the editor. Styles: calc/modules-editor.css.
import { spec } from "./factory.js"
import { isOwnHash } from "./fragment.js"
import { sprites } from "./icon.js"
import { beaconData } from "./module.js"
import {
    beaconWhyNot, effectsOf, kindOf, moduleFor, moduleLabel, num, paletteRows, percentWords,
    powerWords, resolveModules, rowMachines, tierOf, whyNot,
} from "./modules-core.js"
import { handTag } from "./modules-strip.js"
import { beaconPowerMultiplier, isNormal, tierOf as qualityTier } from "./quality-core.js"
import { addQualityBadge, tierPicker, withQualityBadge } from "./quality-ui.js"
import { RATE_LABEL } from "./table-core.js"

const MAX_BEACONS = 16
// A module going into a beacon slot while the count is 0 brings this many
// beacons, Settings' rule for the plan (modules-settings.js's pickBeacon).
const FIRST_BEACONS = 8

// Mount key ("row:<recipe key>" / "machine:<machine key>") -> the selected
// slot, {kind: "slot" | "beacon", index}. Cleared once a module goes in.
const selection = new Map()

// Mount key -> the "Use these modules for" radio the editor is showing, for
// scope "row" (scope "machine" has only one target). Seeded from where a
// row's modules come from the moment its details open (see currentTarget),
// then sticky -- picking "Every row" and making several more edits keeps
// editing the plan rather than resetting on every re-render -- until the
// row closes: cleared wholesale on "calc:select" (dispatched only when the
// open/selected row changes, never by an edit inside this editor), so
// reopening any row re-seeds it fresh. Also cleared when Back/Forward or a
// pasted link reloads the page from the fragment (init.js's hashchange
// listener), which never fires "calc:select".
const chosenTarget = new Map()
document.addEventListener("calc:select", () => chosenTarget.clear())
window.addEventListener("hashchange", () => {
    if (!isOwnHash(window.location.hash)) {
        chosenTarget.clear()
    }
})

// Mount key -> the quality tier the next picked module goes in at (the
// "Module quality" picker above the palette, calculator 1.3.0). Normal
// until picked; kept across re-renders like `selection`.
const pickTier = new Map()

function nextTier(opts) {
    return pickTier.get(mountKey(opts)) || "normal"
}

function el(tag, className, text) {
    let node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
}

function button(className, text, onClick) {
    let b = el("button", className, text)
    b.type = "button"
    b.addEventListener("click", event => {
        event.stopPropagation()
        onClick()
    })
    return b
}

function mountKey(opts) {
    return opts.scope === "row" ? `row:${opts.recipe.key}` : `machine:${opts.machine.key}`
}

// What pick()/step() start from, {modules, beaconModules, beaconCount} with
// a plain-number count. "row", and a hand-set row on any target, start from
// the row's own ModuleSpec: that is what the editor shows, and it was
// checked when it was set. Otherwise "machine"/"plan" start from that
// layer's own raw entry, never the row's resolved modules -- pipe's
// fallback Speed 3 must not leak into a plan that says Productivity 3.
function currentEntry(opts, target) {
    let source
    if (target === "row" || (opts.scope === "row" && spec.handSet.has(opts.recipe.key))) {
        source = spec.getModuleSpec(opts.recipe)
    } else if (target === "machine") {
        source = spec.machineModules.get(opts.machine.key) ||
            resolveModules({recipe: null, machine: opts.machine, plan: spec.planLayer(), machineLayer: new Map()})
    } else {
        let plan = spec.planLayer()
        source = {
            modules: new Array(opts.machine.moduleSlots).fill(plan.defaultModule),
            moduleTiers: new Array(opts.machine.moduleSlots).fill(plan.defaultModuleTier),
            beaconModules: plan.defaultBeacon,
            beaconModuleTiers: plan.defaultBeaconTiers,
            beaconCount: plan.defaultBeaconCount,
            beaconTier: plan.defaultBeaconTier,
        }
    }
    let tiers = source.moduleTiers || []
    let beaconTiers = source.beaconModuleTiers || []
    let beaconModules = [source.beaconModules[0] ?? null, source.beaconModules[1] ?? null]
    return {
        modules: source.modules.slice(),
        moduleTiers: source.modules.map((m, i) => m ? qualityTier(tiers[i]).key : "normal"),
        beaconModules,
        beaconModuleTiers: beaconModules.map((m, i) => m ? qualityTier(beaconTiers[i]).key : "normal"),
        beaconCount: num(source.beaconCount),
        beaconTier: qualityTier(source.beaconTier).key,
    }
}

// Whether the next edit could go to the plan, which holds one module in
// every slot (its two beacon slots may differ). A selected slot means a
// one-slot edit, so it can't.
function planWritable(opts, sel) {
    let entry = currentEntry(opts, "plan")
    return !(sel && sel.kind === "slot") &&
        entry.modules.every(m => m === entry.modules[0]) &&
        entry.moduleTiers.every(t => t === entry.moduleTiers[0])
}

// Where edits go: "row" (Just <recipe>), "machine" or "plan". A row's
// editor opens on its own row, unless its modules come from a machine
// entry (Jordan's mockup: one click should never silently rewrite the
// whole plan or machine) -- see chosenTarget above. The header below still
// says where the modules come from even when that differs from this.
function currentTarget(opts) {
    if (opts.scope === "machine") {
        return "machine"
    }
    let key = mountKey(opts)
    if (!chosenTarget.has(key)) {
        let source = spec.moduleSource(opts.recipe)
        chosenTarget.set(key, source === "machine" ? "machine" : "row")
    } else if (chosenTarget.get(key) === "plan" && !planWritable(opts, null)) {
        // A choice made before the row's state changed under it (a link,
        // say) must not send its mixed modules to the plan.
        chosenTarget.set(key, "row")
    }
    return chosenTarget.get(key)
}

// Writes `entry` to `target` and re-renders (re-solves when productivity
// moved; see spec.commitModules).
function write(opts, target, entry) {
    if (!entry.beaconModules[0] && !entry.beaconModules[1]) {
        entry = {...entry, beaconCount: 0}
    }
    spec.commitModules(() => {
        if (target === "row") {
            spec.setRowModules(opts.recipe, entry)
        } else if (target === "machine") {
            if (opts.recipe) {
                spec.releaseRow(opts.recipe)
            }
            spec.setMachineModules(opts.machine.key, entry)
        } else {
            // "Every row": the plan layer only. This row leaves its
            // hand-set state, but its machine's own entry (if it has one)
            // stays -- that entry still wins over whatever the plan says,
            // so this row may not even change (scopeNote says as much).
            spec.releaseRow(opts.recipe)
            let plan = spec.planLayer()
            let module = entry.modules[0] ?? null
            spec.setPlanLayer({
                defaultModule: module,
                defaultModuleTier: entry.moduleTiers[0] ?? "normal",
                secondaryDefaultModule: module && kindOf(module) === "productivity" ? plan.secondaryDefaultModule : null,
                secondaryDefaultModuleTier: plan.secondaryDefaultModuleTier,
                defaultBeacon: entry.beaconModules,
                defaultBeaconTiers: entry.beaconModuleTiers,
                defaultBeaconCount: entry.beaconCount,
                defaultBeaconTier: entry.beaconTier,
            })
        }
    })
}

function pick(opts, module) {
    let key = mountKey(opts)
    let target = currentTarget(opts)
    let entry = currentEntry(opts, target)
    let sel = selection.get(key)
    let tier = module ? nextTier(opts) : "normal"
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
    write(opts, target, entry)
}

// The "Module quality" picker: sets the tier of the next module picked;
// with a slot (or beacon slot) selected it also re-tiers that slot now.
function chooseTier(opts, render, tier) {
    let key = mountKey(opts)
    pickTier.set(key, tier)
    let sel = selection.get(key)
    if (!sel) {
        render()
        return
    }
    let target = currentTarget(opts)
    let entry = currentEntry(opts, target)
    if (sel.kind === "beacon") {
        for (let i of target === "plan" ? [0, 1] : [sel.index]) {
            if (entry.beaconModules[i]) {
                entry.beaconModuleTiers[i] = tier
            }
        }
    } else if (target !== "plan" && entry.modules[sel.index]) {
        entry.moduleTiers[sel.index] = tier
    }
    selection.delete(key)
    write(opts, target, entry)
}

function select(opts, render, kind, index) {
    let key = mountKey(opts)
    let sel = selection.get(key)
    if (sel && sel.kind === kind && sel.index === index) {
        selection.delete(key)
    } else {
        selection.set(key, {kind, index})
    }
    render()
}

function slotIcon(module, size) {
    if (module) {
        return module.icon.make(size, true)
    }
    let icon = sprites.get("slot_icon_module").icon.make(size, true)
    icon.title = "Empty slot"
    return icon
}

// Where this row's modules actually come from -- independent of `target`,
// the radio currently showing, which may differ (the editor opens on
// "row" even for a row whose modules still come from the plan).
function header(opts) {
    let head = el("div", "me-head")
    head.appendChild(el("span", "me-title", "Modules"))
    if (opts.scope === "machine") {
        head.appendChild(el("span", "muted me-source", `Every ${opts.machine.name.toLowerCase()} without a row set by hand`))
        return head
    }
    let source = spec.moduleSource(opts.recipe)
    if (source === "hand") {
        head.appendChild(handTag())
        head.appendChild(button("btn btn-sm me-back", "Back to plan default", () => {
            selection.delete(mountKey(opts))
            chosenTarget.set(mountKey(opts), "row")
            spec.commitModules(() => spec.releaseRow(opts.recipe))
        }))
    } else if (source === "machine") {
        head.appendChild(el("span", "muted me-source", `From ${opts.machine.name} settings`))
    } else {
        head.appendChild(el("span", "muted me-source", "From the plan"))
    }
    return head
}

function hintText(sel, target) {
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

function machineSlots(opts, entry, target, sel, render) {
    let box = el("div", "me-block me-machine")
    box.appendChild(el("span", "lbl", "In the machine"))
    let row = el("div", "me-row")
    entry.modules.forEach((module, i) => {
        let on = sel && sel.kind === "slot" && sel.index === i
        let b = button("slot slot-lg me-slot" + (on ? " sel" : ""), undefined, () => select(opts, render, "slot", i))
        b.dataset.slot = String(i)
        let tier = entry.moduleTiers[i]
        b.title = `Slot ${i + 1}: ${moduleLabel(module)}` + (module && !isNormal(tier) ? ` (${qualityTier(tier).name})` : "")
        b.disabled = target === "plan"
        b.appendChild(slotIcon(module, 34))
        if (module) {
            addQualityBadge(b, tier, 14)
        }
        row.appendChild(b)
    })
    box.appendChild(row)
    box.appendChild(el("div", "muted me-hint", hintText(sel, target)))
    return box
}

// `entry` is what +/- start from (currentEntry), so their limits read its
// count too; `disp` is what's shown. For scope "machine" (no row) the two
// are the same thing.
function beaconSlots(opts, entry, disp, target, sel, render) {
    let box = el("div", "me-block me-beacons")
    box.appendChild(el("span", "lbl", "Beacons around each machine"))
    let row = el("div", "me-row")
    let step = delta => {
        let next = Math.max(0, Math.min(MAX_BEACONS, entry.beaconCount + delta))
        if (next === entry.beaconCount) {
            return
        }
        let patch = {beaconCount: next}
        // write() keeps no count without a beacon module, so + from empty
        // fills both slots, or it would silently do nothing.
        if (delta > 0 && !entry.beaconModules[0] && !entry.beaconModules[1]) {
            let plan = spec.planLayer()
            let tier = plan.defaultModule ? tierOf(plan.defaultModule) : 3
            let fill = moduleFor(spec.modules.values(), "speed", tier) || moduleFor(spec.modules.values(), "speed", 3)
            patch.beaconModules = [fill, fill]
        }
        write(opts, target, {...entry, ...patch})
    }
    let minus = button("btn btn-sm me-minus", "−", () => step(-1))
    minus.disabled = entry.beaconCount <= 0
    let plus = button("btn btn-sm me-plus", "+", () => step(1))
    plus.disabled = entry.beaconCount >= MAX_BEACONS
    row.append(minus, el("span", "num me-count", String(disp.beaconCount)), plus)
    let beacon = spec.items.get("beacon")
    if (beacon) {
        row.appendChild(withQualityBadge(beacon.icon.make(28, true), disp.beaconTier, 12))
    }
    disp.beaconModules.forEach((module, i) => {
        let on = sel && sel.kind === "beacon" && sel.index === i
        let b = button("slot me-bslot" + (on ? " sel" : ""), undefined, () => select(opts, render, "beacon", i))
        b.dataset.beacon = String(i)
        b.title = `Beacon slot ${i + 1}: ${moduleLabel(module)}`
        b.appendChild(slotIcon(module, 28))
        if (module) {
            addQualityBadge(b, disp.beaconModuleTiers[i], 12)
        }
        row.appendChild(b)
    })
    box.appendChild(row)
    let quality = el("div", "me-tierpick me-beacon-tier")
    quality.appendChild(el("span", "muted", "Beacon quality"))
    quality.appendChild(tierPicker(disp.beaconTier, tier => write(opts, target, {...entry, beaconTier: tier}), {label: "Beacon quality"}))
    box.appendChild(quality)
    return box
}

// `target` decides what the palette greys out: a pick lands on that
// layer, shared by every row in the machine (or the whole plan), so only
// the machine's own allowed_effects applies -- this row's recipe is
// irrelevant there (productivity can go into a layer from pipe's row; the
// row itself still falls back, same as any other row that can't use it).
// Only "row" filters by this row's own recipe too.
function palette(opts, sel, target, render) {
    let box = el("div", "me-block me-palette")
    let quality = el("div", "me-tierpick me-module-tier")
    quality.appendChild(el("span", "muted", "Module quality"))
    quality.appendChild(tierPicker(nextTier(opts), tier => chooseTier(opts, render, tier), {label: "Module quality"}))
    box.appendChild(quality)
    let forBeacon = sel && sel.kind === "beacon"
    let reasonFor = module => forBeacon
        ? beaconWhyNot(module, beaconData.allowedEffects)
        : whyNot(module, target === "row" ? opts.recipe : null, opts.machine)
    let addPick = (row, module, title) => {
        let reason = reasonFor(module)
        let b = button("slot me-pick", undefined, () => pick(opts, module))
        b.dataset.module = module ? module.key : "null"
        b.disabled = reason !== null
        b.title = reason || title
        b.appendChild(slotIcon(module, 28))
        if (module) {
            addQualityBadge(b, nextTier(opts), 12)
        }
        row.appendChild(b)
    }
    for (let line of paletteRows(spec.modules.values())) {
        let row = el("div", "me-prow")
        row.appendChild(el("span", "muted me-plabel", line.label))
        for (let module of line.modules) {
            addPick(row, module, moduleLabel(module))
        }
        box.appendChild(row)
    }
    let empty = el("div", "me-prow")
    empty.appendChild(el("span", "muted me-plabel", "Empty"))
    addPick(empty, null, "Empty slot")
    box.appendChild(empty)
    box.appendChild(el("div", "muted me-note", "Quality modules only slow the machine here; planning for quality output isn't supported yet."))
    return box
}

function effectsBlock(opts, entry) {
    let box = el("div", "me-block me-effects")
    box.appendChild(el("span", "lbl", "What they do, per machine"))
    let fx = effectsOf({...entry, machineProd: num(opts.machine.prodEffect(spec)), beacon: beaconData})
    for (let [key, label, value] of [["speed", "Speed", fx.speed], ["prod", "Productivity", fx.prod], ["power", "Power", fx.power]]) {
        let line = el("div", "me-eff")
        line.dataset.effect = key
        let pct = (value - 1) * 100
        // green when it helps: faster, more productive, or less power
        let good = key === "power" ? pct <= 0 : pct >= 0
        let bar = el("span", "me-bar")
        let fill = el("span", "me-fill" + (good ? "" : " bad"))
        fill.style.width = `${Math.min(Math.abs(pct), 300) / 3}%`
        bar.appendChild(fill)
        line.append(el("span", "me-ename", label), bar, el("span", "num me-pct", percentWords(value)))
        box.appendChild(line)
    }
    if (fx.floored) {
        box.appendChild(el("div", "muted me-floor", "Speed stops at −80%, as in the game."))
    }
    return box
}

function rateText(rate) {
    return spec.format.rate(rate) + (RATE_LABEL[spec.format.rateName] || "/min")
}

// The row's machines and power three ways, from its output rate without
// re-solving (modules-core.js's rowMachines): no modules, what the layers
// would give it, and the modules shown.
function compareBlock(opts, entry) {
    let {recipe, machine} = opts
    let item = opts.row.item
    let output = opts.row.recipeRate.mul(recipe.gives(item))
    let amount = recipe.products.find(p => p.item === item).amount.toFloat()
    let speedNow = spec.getModuleSpec(recipe).speedEffect().toFloat()
    let base = {
        output: output.toFloat(),
        amount,
        net: amount - recipe.uses(item).toFloat(),
        baseRate: machine.getRecipeRate(spec, recipe).toFloat() / speedNow,
        powerW: machine.power.toFloat(),
        drainW: machine.drain().toFloat(),
    }
    let machineProd = num(machine.prodEffect(spec))
    let fx = e => effectsOf({...e, machineProd, beacon: beaconData})
    let layers = spec.resolveFor(recipe, machine)
    let cells = [
        ["none", "No modules", {modules: entry.modules.map(() => null), beaconModules: [null, null], beaconCount: 0}],
        ["plan", "Plan default", layers],
        ["these", "These modules", entry],
    ]
    let box = el("div", "me-block me-compare")
    box.appendChild(el("span", "lbl", `For ${rateText(output)}`))
    let row = el("div", "me-cells")
    for (let [key, label, e] of cells) {
        let {machines, watts} = rowMachines({...base, effects: fx(e)})
        let cell = el("div", "me-cell" + (key === "these" ? " cur" : ""))
        cell.dataset.cell = key
        cell.append(el("span", "me-clabel", label), el("span", "num me-machines", `${machines.toFixed(1)} machines`), el("span", "muted me-mw", powerWords(watts)))
        row.appendChild(cell)
    }
    box.appendChild(row)
    let beaconWatts = beaconData.powerW * beaconPowerMultiplier(entry.beaconTier).toFloat()
    box.appendChild(el("div", "muted me-note", `Machines on this row, and their power. Beacons draw their own ${powerWords(beaconWatts)} each on top.`))
    return box
}

const SCOPE_NOTE = {
    row: "Only this row changes. It is marked set by hand, and changes to the plan or the machine leave it alone.",
    machine: "Every row made in this machine changes, except rows set by hand.",
    plan: "Every row without its own setting changes. Machines with their own setting and rows set by hand keep theirs.",
}

// What an edit on `target` would actually do to this row, since the radio
// itself never writes: "Every row"/"Every row made in..." on a hand-set
// row releases it on its next edit there (write()'s "machine"/"plan"
// branches both call releaseRow) -- a pick looking like it changed nothing
// otherwise. And "Every row" never drops a machine's own entry, which
// still wins over the plan once the row is released, so even that release
// may not change what this row runs.
function scopeNote(opts, target) {
    let hasMachineEntry = spec.machineModules.has(opts.machine.key)
    if (spec.handSet.has(opts.recipe.key) && (target === "machine" || target === "plan")) {
        let destination = target === "machine" ? `${opts.machine.name}'s setting` : "the plan"
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

function scopeBlock(opts, target, sel, render) {
    let box = el("div", "me-block me-scope")
    box.appendChild(el("span", "lbl", "Use these modules for"))
    let name = `me-scope-${opts.recipe.key}`
    let expressible = target === "plan" || planWritable(opts, sel)
    let choices = [
        ["row", `Just ${opts.recipe.name.toLowerCase()}`, true, ""],
        ["machine", `Every row made in ${opts.machine.name.toLowerCase()}`, true, ""],
        ["plan", "Every row (makes them the plan default)", expressible, expressible ? "" : "Mixed modules can't be a plan default"],
    ]
    for (let [value, text, enabled, why] of choices) {
        let label = el("label", "me-radio")
        let input = el("input")
        input.type = "radio"
        input.name = name
        input.value = value
        input.checked = target === value
        input.disabled = !enabled
        if (why) label.title = why
        input.addEventListener("change", () => {
            if (input.checked && value !== target) {
                // The radio only decides where the *next* edit goes -- it
                // never itself writes. Carrying over "what's currently
                // shown" here used to write a fallen-back row's or a
                // machine's modules into the wider scope (or the layer's
                // raw modules into the row) before the user had asked for
                // any particular change.
                selection.delete(mountKey(opts))
                chosenTarget.set(mountKey(opts), value)
                render()
            }
        })
        label.append(input, document.createTextNode(" " + text))
        box.appendChild(label)
    }
    box.appendChild(el("div", "muted me-scope-note", scopeNote(opts, target)))
    return box
}

// Empties `container`, mounts the editor in it and returns its root,
// div.modeditor[data-scope]. opts: {scope: "row" | "machine", machine,
// recipe (row), row: {recipeRate, itemRate, item} (row)}.
export function mountModuleEditor(container, opts) {
    container.textContent = ""
    let root = el("div", "modeditor")
    root.dataset.scope = opts.scope
    container.appendChild(root)
    let render = () => {
        root.textContent = ""
        let target = currentTarget(opts)
        let entry = currentEntry(opts, target)
        // Everything shown is what this row runs, whatever the radio says.
        // Scope "machine" (Settings' By machine) has no row, so it shows
        // the machine's entry.
        let disp = opts.scope === "row" ? currentEntry(opts, "row") : entry
        let sel = selection.get(mountKey(opts)) || null
        if (sel && sel.kind === "slot" && target === "plan") {
            sel = null
        }
        root.appendChild(header(opts))
        let body = el("div", "me-body")
        let left = el("div", "me-col")
        left.append(machineSlots(opts, disp, target, sel, render), beaconSlots(opts, entry, disp, target, sel, render), palette(opts, sel, target, render))
        let right = el("div", "me-col")
        right.appendChild(effectsBlock(opts, disp))
        if (opts.scope === "row") {
            right.append(compareBlock(opts, disp), scopeBlock(opts, target, sel, render))
        }
        body.append(left, right)
        root.appendChild(body)
    }
    render()
    return root
}
