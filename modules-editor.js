// calc/modules-editor.js — the module editor (calculator 1.2.0; spec
// docs/superpowers/specs/2026-10-04-per-recipe-modules-design.md, artboard
// 2). One component in two places: a row's details (scope "row", a
// full-width band under Needs / Goes to / Make here, details.js) and
// Settings -> Modules -> By machine (scope "machine", modules-settings.js).
//
// Every click writes straight to the layer the "Use these modules for"
// radio names, inside spec.commitModules(), so the page re-renders and the
// editor is mounted again from spec. Its one piece of state of its own,
// the selected slot, lives in `selection` across those re-renders; picking
// a slot re-renders only the editor. Styles: calc/modules-editor.css.
import { spec } from "./factory.js"
import { sprites } from "./icon.js"
import { beaconData } from "./module.js"
import {
    beaconWhyNot, effectsOf, kindOf, moduleFor, moduleLabel, num, paletteRows, percentWords,
    planExpressible, powerWords, resolveModules, rowMachines, tierOf, whyNot,
} from "./modules-core.js"
import { handTag } from "./modules-strip.js"
import { RATE_LABEL } from "./table-core.js"

const MAX_BEACONS = 16

// Mount key ("row:<recipe key>" / "machine:<machine key>") -> the selected
// slot, {kind: "slot" | "beacon", index}. Cleared once a module goes in.
const selection = new Map()

// Mount key -> the "Use these modules for" radio the editor is showing, for
// scope "row" (scope "machine" has only one target). Seeded once, the first
// time a row's details are opened in this page session (see currentTarget),
// from where its modules come from; after that it's whatever the radio was
// last set to, so picking "Every row" and then making several more edits
// keeps editing the plan rather than resetting to "row" on every re-render.
const chosenTarget = new Map()

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

// The modules `target` shows, with a plain-number beacon count. For
// "machine"/"plan" this is the shared layer's own entry (what editing it
// actually changes), not the row's resolved-and-possibly-fallen-back
// modules -- a beacon-only edit on a row that fell back must not write the
// fallback values over the layer it didn't touch. Only "row" (and a
// scope-radio switch away from it, see scopeBlock below) reads the row's
// own ModuleSpec.
function currentEntry(opts, target) {
    let source
    if (target === "machine") {
        source = spec.machineModules.get(opts.machine.key) ||
            resolveModules({recipe: null, machine: opts.machine, plan: spec.planLayer(), machineLayer: new Map()})
    } else if (target === "plan") {
        let plan = spec.planLayer()
        source = {
            modules: new Array(opts.machine.moduleSlots).fill(plan.defaultModule),
            beaconModules: plan.defaultBeacon,
            beaconCount: plan.defaultBeaconCount,
        }
    } else {
        source = spec.getModuleSpec(opts.recipe)
    }
    return {
        modules: source.modules.slice(),
        beaconModules: [source.beaconModules[0], source.beaconModules[1]],
        beaconCount: num(source.beaconCount),
    }
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
    }
    return chosenTarget.get(key)
}

// Writes `entry` to `target` and re-renders (re-solves when productivity
// moved; see spec.commitModules).
function write(opts, target, entry) {
    spec.commitModules(() => {
        if (target === "row") {
            spec.setRowModules(opts.recipe, entry)
        } else if (target === "machine") {
            if (opts.recipe) {
                spec.releaseRow(opts.recipe)
            }
            spec.setMachineModules(opts.machine.key, entry)
        } else {
            // "Every row": the plan layer. This row leaves its hand-set
            // state and its own machine's entry is dropped, or the very row
            // being edited would not change.
            spec.releaseRow(opts.recipe)
            spec.setMachineModules(opts.machine.key, null)
            let plan = spec.planLayer()
            let module = entry.modules[0] ?? null
            let beacon = entry.beaconModules[0] ?? null
            spec.setPlanLayer({
                defaultModule: module,
                secondaryDefaultModule: module && kindOf(module) === "productivity" ? plan.secondaryDefaultModule : null,
                defaultBeacon: [beacon, beacon],
                defaultBeaconCount: beacon ? entry.beaconCount : 0,
            })
        }
    })
}

function pick(opts, module) {
    let key = mountKey(opts)
    let target = currentTarget(opts)
    let entry = currentEntry(opts, target)
    let sel = selection.get(key)
    if (sel && sel.kind === "beacon") {
        if (target === "plan") {
            entry.beaconModules = [module, module]
        } else {
            entry.beaconModules[sel.index] = module
        }
    } else if (sel && sel.kind === "slot" && target !== "plan") {
        entry.modules[sel.index] = module
    } else {
        entry.modules = entry.modules.map(() => module)
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
        b.title = `Slot ${i + 1}: ${moduleLabel(module)}`
        b.disabled = target === "plan"
        b.appendChild(slotIcon(module, 34))
        row.appendChild(b)
    })
    box.appendChild(row)
    box.appendChild(el("div", "muted me-hint", hintText(sel, target)))
    return box
}

function beaconSlots(opts, entry, target, sel, render) {
    let box = el("div", "me-block me-beacons")
    box.appendChild(el("span", "lbl", "Beacons around each machine"))
    let row = el("div", "me-row")
    let step = delta => {
        let next = Math.max(0, Math.min(MAX_BEACONS, entry.beaconCount + delta))
        if (next === entry.beaconCount) {
            return
        }
        let patch = {beaconCount: next}
        // "Every row": the plan layer only keeps a beacon count alongside a
        // beacon module (write() below zeroes the count otherwise), so +
        // from empty needs a module too, or it would silently do nothing.
        if (target === "plan" && delta > 0 && !entry.beaconModules[0] && !entry.beaconModules[1]) {
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
    row.append(minus, el("span", "num me-count", String(entry.beaconCount)), plus)
    let beacon = spec.items.get("beacon")
    if (beacon) {
        row.appendChild(beacon.icon.make(28, true))
    }
    entry.beaconModules.forEach((module, i) => {
        let on = sel && sel.kind === "beacon" && sel.index === i
        let b = button("slot me-bslot" + (on ? " sel" : ""), undefined, () => select(opts, render, "beacon", i))
        b.dataset.beacon = String(i)
        b.title = `Beacon slot ${i + 1}: ${moduleLabel(module)}`
        b.appendChild(slotIcon(module, 28))
        row.appendChild(b)
    })
    box.appendChild(row)
    return box
}

function palette(opts, sel) {
    let box = el("div", "me-block me-palette")
    let forBeacon = sel && sel.kind === "beacon"
    let reasonFor = module => forBeacon
        ? beaconWhyNot(module, beaconData.allowedEffects)
        : whyNot(module, opts.scope === "row" ? opts.recipe : null, opts.machine)
    let addPick = (row, module, title) => {
        let reason = reasonFor(module)
        let b = button("slot me-pick", undefined, () => pick(opts, module))
        b.dataset.module = module ? module.key : "null"
        b.disabled = reason !== null
        b.title = reason || title
        b.appendChild(slotIcon(module, 28))
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
    box.appendChild(el("div", "muted me-note", "Quality modules only slow the machine here; quality itself isn't planned yet."))
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
    box.appendChild(el("div", "muted me-note", `Machines on this row, and their power. Beacons draw their own ${powerWords(beaconData.powerW)} each on top.`))
    return box
}

const SCOPE_NOTE = {
    row: "Only this row changes. It is marked set by hand, and changes to the plan or the machine leave it alone.",
    machine: "Every row made in this machine changes, except rows set by hand.",
    plan: "Every row without its own setting changes. Machines with their own setting and rows set by hand keep theirs.",
}

function scopeBlock(opts, entry, target) {
    let box = el("div", "me-block me-scope")
    box.appendChild(el("span", "lbl", "Use these modules for"))
    let name = `me-scope-${opts.recipe.key}`
    let expressible = planExpressible(entry)
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
                selection.delete(mountKey(opts))
                chosenTarget.set(mountKey(opts), value)
                // Carries over what's currently shown (the old target's own
                // entry), not the new target's: switching scope is "apply
                // what I see onto a wider scope", not "read that scope".
                write(opts, value, currentEntry(opts, target))
            }
        })
        label.append(input, document.createTextNode(" " + text))
        box.appendChild(label)
    }
    box.appendChild(el("div", "muted me-scope-note", SCOPE_NOTE[target]))
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
        let sel = selection.get(mountKey(opts)) || null
        if (sel && sel.kind === "slot" && target === "plan") {
            sel = null
        }
        root.appendChild(header(opts))
        let body = el("div", "me-body")
        let left = el("div", "me-col")
        left.append(machineSlots(opts, entry, target, sel, render), beaconSlots(opts, entry, target, sel, render), palette(opts, sel))
        let right = el("div", "me-col")
        right.appendChild(effectsBlock(opts, entry))
        if (opts.scope === "row") {
            right.append(compareBlock(opts, entry), scopeBlock(opts, entry, target))
        }
        body.append(left, right)
        root.appendChild(body)
    }
    render()
    return root
}
