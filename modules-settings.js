// calc/modules-settings.js — Settings -> Modules (calculator 1.2.0; spec
// docs/superpowers/specs/2026-10-04-per-recipe-modules-design.md, artboard
// 3), drawn into calc.html's #settings-modules: the plan layer as a
// strategy, By machine (each machine the plan uses, its modules, Change /
// Use plan) and Set by hand (each hand-set row, Reset / Reset all).
// Rebuilt from spec on every render; every click is one
// spec.commitModules(), which re-renders or re-solves the page. Styles:
// calc/modules-settings.css.
import { spec } from "./factory.js"
import { mountModuleEditor } from "./modules-editor.js"
import { moduleFor, num, planFromStrategy, strategyOf, summarySentence, withKind } from "./modules-core.js"
import { beaconBadge, moduleStrip } from "./modules-strip.js"
import { registerRenderer } from "./render.js"

const MAX_BEACONS = 16
const KINDS = [["none", "None"], ["productivity", "Productivity"], ["speed", "Speed"], ["efficiency", "Efficiency"]]
const FALLBACKS = [["speed", "Speed"], ["efficiency", "Efficiency"], ["none", "Leave empty"]]
const BEACONS = [["none", "None"], ["speed", "Speed"], ["efficiency", "Efficiency"]]

// The machine whose editor is open under its By machine row. Kept across
// renders: every edit in that editor re-renders the drawer.
let openMachine = null
let lastTotals = null

function el(tag, className, text) {
    let node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
}

function button(className, text, onClick) {
    let b = el("button", className, text)
    b.type = "button"
    b.addEventListener("click", onClick)
    return b
}

// A settings line: the 110px muted label calc.html's other .kv rows use.
function kv(label, ...children) {
    let row = el("div", "kv")
    let head = el("span", "muted", label)
    head.style.width = "110px"
    head.style.flex = "none"
    row.append(head, ...children)
    return row
}

function seg(id, options, current, onPick) {
    let wrap = el("span", "seg")
    wrap.id = id
    for (let [value, label] of options) {
        let b = button(value === current ? "on" : "", label, () => onPick(value))
        b.dataset.value = value
        wrap.appendChild(b)
    }
    return wrap
}

function apply(strategy) {
    spec.commitModules(() => spec.setPlanLayer(planFromStrategy(strategy, spec.modules.values())))
}

// {recipe, building} for every recipe in the solved plan made in a machine
// with module slots.
function planRecipes(totals) {
    let out = []
    if (!totals) {
        return out
    }
    for (let [recipe] of totals.rates) {
        if (!recipe.isReal() || recipe.isDisable()) {
            continue
        }
        let building = spec.getBuilding(recipe)
        if (building !== null && building.moduleSlots > 0) {
            out.push({recipe, building})
        }
    }
    return out
}

function slotIcon(icon) {
    let slot = el("span", "slot sm")
    slot.appendChild(icon.make(24, true))
    return slot
}

function strategyGroup(totals) {
    let box = el("div", "ms-group ms-strategy")
    let plan = spec.planLayer()
    let s = strategyOf(plan)
    box.appendChild(kv("In every machine", seg("ms-kind", KINDS, s.kind, kind => apply(withKind(s, kind)))))

    let tiers = el("span", "seg")
    tiers.id = "ms-tier"
    let iconKind = s.kind === "none" ? "productivity" : s.kind
    for (let tier of [1, 2, 3]) {
        let module = moduleFor(spec.modules.values(), iconKind, tier)
        let b = button(tier === s.tier ? "on" : "", undefined, () => apply({...s, tier}))
        b.dataset.value = String(tier)
        if (module) {
            b.appendChild(module.icon.make(20, true))
        }
        b.appendChild(document.createTextNode(` ${tier}`))
        tiers.appendChild(b)
    }
    box.appendChild(kv("Tier", tiers))

    if (s.kind === "productivity") {
        box.appendChild(kv("If a recipe can't take productivity",
            seg("ms-fallback", FALLBACKS, s.fallback, fallback => apply({...s, fallback}))))
        let fellBack = planRecipes(totals)
            .filter(({recipe, building}) => !spec.handSet.has(recipe.key) && spec.resolveFor(recipe, building).fellBack === "recipe")
            .map(({recipe}) => recipe.name)
        if (fellBack.length > 0) {
            box.appendChild(el("div", "muted ms-fellback", `In this plan that's: ${fellBack.join(", ")}`))
        }
    }

    // A beacon count only means something with a beacon module chosen.
    let fixed = s.beacon === "none" || s.beacon === "mixed"
    let shown = s.beacon === "none" ? 0 : s.beaconCount
    let step = delta => apply({...s, beaconCount: Math.max(0, Math.min(MAX_BEACONS, s.beaconCount + delta))})
    let minus = button("btn btn-sm ms-minus", "−", () => step(-1))
    minus.disabled = fixed || shown <= 0
    let plus = button("btn btn-sm ms-plus", "+", () => step(1))
    plus.disabled = fixed || shown >= MAX_BEACONS
    let pickBeacon = beacon => apply({...s, beacon, beaconCount: beacon !== "none" && s.beaconCount === 0 ? 8 : s.beaconCount})
    box.appendChild(kv("Beacons", seg("ms-beacon", BEACONS, s.beacon, pickBeacon),
        minus, el("span", "num ms-count", String(shown)), plus, el("span", "muted", "around each machine")))

    if (!s.exact) {
        // A link the buttons can't say all of (dm=p3&dm2=e1): its real modules.
        let real = el("span", "ms-real")
        real.appendChild(moduleStrip([plan.defaultModule, plan.secondaryDefaultModule].filter(m => m), 20))
        let badge = beaconBadge(plan.defaultBeacon, plan.defaultBeaconCount, 20)
        if (badge) {
            real.appendChild(badge)
        }
        box.appendChild(kv("From the link", real, el("span", "muted", "Picking any button above replaces these.")))
    }
    box.appendChild(el("div", "ms-summary", summarySentence(plan)))
    return box
}

function machineGroup(totals) {
    let box = el("div", "ms-group ms-machines")
    box.appendChild(el("div", "ms-head", "By machine"))
    let recipes = planRecipes(totals)
    let machines = [...new Map(recipes.map(({building}) => [building.key, building])).values()]
        .sort((a, b) => a.name.localeCompare(b.name))
    if (machines.length === 0) {
        box.appendChild(el("div", "muted", "No machine in this plan takes modules."))
        return box
    }
    for (let machine of machines) {
        let row = el("div", "ms-row")
        row.dataset.machine = machine.key
        row.appendChild(slotIcon(machine.icon))
        let text = el("span", "ms-text")
        text.append(el("span", "ms-name", machine.name), el("span", "muted", ` ${machine.moduleSlots} slot${machine.moduleSlots === 1 ? "" : "s"}`))
        row.appendChild(text)
        let resolved = spec.resolveFor(null, machine)
        row.appendChild(moduleStrip(resolved.modules, 20))
        let count = num(resolved.beaconCount)
        if (count > 0 && resolved.beaconModules.some(m => m)) {
            row.appendChild(el("span", "muted", `+ ${count} beacon${count === 1 ? "" : "s"}`))
        }
        let hand = recipes.filter(r => r.building === machine && spec.handSet.has(r.recipe.key)).map(r => r.recipe.name)
        if (hand.length > 0) {
            row.appendChild(el("span", "muted ms-hand", `${hand.length} recipe${hand.length === 1 ? "" : "s"} set by hand: ${hand.join(", ")}`))
        }
        let actions = el("span", "ms-actions")
        let open = openMachine === machine.key
        actions.appendChild(button("btn btn-sm ms-change", open ? "Close" : "Change", () => {
            openMachine = open ? null : machine.key
            renderModulesSettings(spec, lastTotals)
        }))
        if (spec.machineModules.has(machine.key)) {
            actions.appendChild(button("btn btn-sm ms-useplan", "Use plan", () => {
                spec.commitModules(() => spec.setMachineModules(machine.key, null))
            }))
        }
        row.appendChild(actions)
        box.appendChild(row)
        if (open) {
            let host = el("div", "ms-editor")
            mountModuleEditor(host, {scope: "machine", machine})
            box.appendChild(host)
        }
    }
    return box
}

function handGroup(totals) {
    let box = el("div", "ms-group ms-handset")
    box.appendChild(el("div", "ms-head", "Set by hand"))
    let rows = planRecipes(totals).filter(({recipe}) => spec.handSet.has(recipe.key))
    if (rows.length === 0) {
        box.appendChild(el("div", "muted", "No rows set by hand."))
    }
    for (let {recipe} of rows) {
        let row = el("div", "ms-row")
        row.dataset.recipe = recipe.key
        row.appendChild(slotIcon(recipe.icon))
        row.appendChild(el("span", "ms-name", recipe.name))
        let moduleSpec = spec.getModuleSpec(recipe)
        row.appendChild(moduleStrip(moduleSpec.modules, 20))
        let badge = beaconBadge(moduleSpec.beaconModules, moduleSpec.beaconCount, 16)
        if (badge) {
            row.appendChild(badge)
        }
        let actions = el("span", "ms-actions")
        actions.appendChild(button("btn btn-sm ms-reset", "Reset", () => spec.commitModules(() => spec.releaseRow(recipe))))
        row.appendChild(actions)
        box.appendChild(row)
    }
    if (spec.handSet.size > 0) {
        let all = button("btn btn-sm", "Reset all", () => spec.commitModules(() => spec.releaseAllRows()))
        all.id = "modules-reset-all"
        box.appendChild(all)
    }
    box.appendChild(el("div", "muted ms-foot", "Rows win over machines, machines win over the plan. Open a row in the table to set its modules."))
    return box
}

function renderModulesSettings(_spec, totals) {
    lastTotals = totals
    let host = document.getElementById("settings-modules")
    if (!host || !spec.modules) {
        return
    }
    host.textContent = ""
    host.append(strategyGroup(totals), machineGroup(totals), handGroup(totals))
}

// init.js calls this once at boot.
export function initModulesSettings() {
    registerRenderer(renderModulesSettings)
}
