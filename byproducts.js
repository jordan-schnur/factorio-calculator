// calc/byproducts.js — the Byproducts bar (#byproducts): while the plan
// leaves something over that nothing uses, one block per recipe it would
// stop, with fixes the solver has already tried (byproduct-core.js'
// findFixes) and, after a fix, a status strip with Undo. A trial switches
// recipes on/off, solves, and switches them back exactly; trials run on a
// 0 ms timer after the page renders so the plan never waits for them.
import { allowLabel, cheapest, findFixes, joinWords, machineDiff, shortName, stalls } from "./byproduct-core.js"
import { spec } from "./factory.js"
import { plural } from "./ratio-core.js"
import { registerRenderer } from "./render.js"
import { markOverride } from "./savesettings.js"
import { relevantRecipes } from "./source.js"
import { RATE_LABEL } from "./table-core.js"
import { buildingCount, buildRows } from "./table.js"

let generation = 0
// The fixes found for one totals object, so a redisplay without a re-solve
// (a module edit, a rate-unit switch) doesn't run the trials again.
let fixesFor = null
let fixesCache = null
// The last fix applied, with its Undo, until the plan changes some other way.
let applied = null

function rateText(rate) {
    return `${spec.format.rate(rate)}${RATE_LABEL[spec.format.rateName] || "/min"}`
}

// Machines in a solution: total and per building name, counted the way the
// footer counts them.
function summarize(totals) {
    let machines = 0
    let byBuilding = new Map()
    for (let row of buildRows(totals)) {
        if (!row.isReal) continue
        let count = buildingCount(row)
        if (count === 0) continue
        let name = spec.getBuilding(row.recipe).name
        byBuilding.set(name, (byBuilding.get(name) || 0) + count)
        machines += count
    }
    let surplus = new Map()
    for (let item of totals.surplus.keys()) surplus.set(item.key, item)
    let imports = new Set()
    for (let [recipe, rate] of totals.rates) {
        if (recipe.isReal() && recipe.isDisable() && !rate.isZero()) imports.add(recipe.products[0].item.key)
    }
    return {surplus, imports, machines, byBuilding}
}

// Puts spec.disable back to `snapshot`, enabling before disabling so no
// item passes through a state with no producer (setDisable's bookkeeping).
function restoreDisable(snapshot) {
    for (let r of [...spec.disable]) if (!snapshot.has(r)) spec.setEnable(r)
    for (let r of snapshot) if (!spec.disable.has(r)) spec.setDisable(r)
}

function trial({enable, disable}) {
    let disabled = new Set(spec.disable)
    let ignored = new Set(spec.ignore)
    let saved = [spec.targetNotes, spec.lastTableau, spec.lastMetadata, spec.lastPartial, spec.lastSolution]
    try {
        for (let r of enable) if (spec.disable.has(r)) spec.setEnable(r)
        for (let r of disable) if (!spec.disable.has(r)) spec.setDisable(r)
        return summarize(spec.solve())
    } finally {
        restoreDisable(disabled)
        for (let item of [...spec.ignore]) if (!ignored.has(item)) spec.toggleIgnore(item)
        for (let item of ignored) if (!spec.ignore.has(item)) spec.toggleIgnore(item)
        ;[spec.targetNotes, spec.lastTableau, spec.lastMetadata, spec.lastPartial, spec.lastSolution] = saved
    }
}

function consumersOf(item) {
    return item.uses.filter(r => !r.isDisable())
}

function isBlocked(recipe) {
    return Boolean(spec.planetaryBaseline && spec.planetaryBaseline.has(recipe))
}

function makesTarget(recipe) {
    return spec.buildTargets.some(t => recipe.products.some(p => p.item === t.item))
}

function unresearched() {
    let fetched = spec.saveState && spec.saveState.fetched
    return new Set((fetched && fetched.disabled_recipes) || [])
}

function computeFixes(totals, blocks) {
    let base = summarize(totals)
    return blocks.map(block => {
        let fixes = findFixes(block, {
            base,
            trial,
            consumersOf,
            producersOf: relevantRecipes,
            isOff: r => spec.disable.has(r),
            isBlocked,
            makesTarget: block.recipe ? makesTarget(block.recipe) : false,
        })
        return {fixes, base, best: cheapest(fixes)}
    })
}

// --- applying -------------------------------------------------------------

function apply(change, text) {
    let disabled = new Set(spec.disable)
    let sendOut = new Set(spec.sendOut)
    change()
    spec.updateSolution()
    spec.setHash()
    applied = {
        text,
        totals: spec.lastTotals,
        undo() {
            applied = null
            restoreDisable(disabled)
            spec.sendOut = sendOut
            spec.updateSolution()
            spec.setHash()
        },
    }
    spec.display()
}

function applyRecipes(fix, text) {
    apply(() => {
        for (let r of fix.enable) if (spec.disable.has(r)) spec.setEnable(r)
        for (let r of fix.disable) if (!spec.disable.has(r)) spec.setDisable(r)
        markOverride("recipes")
    }, text)
}

function applySendOut(block, text) {
    apply(() => {
        for (let {item} of block.items) spec.sendOut.add(item.key)
    }, text)
}

// --- markup ---------------------------------------------------------------

function el(tag, className, text) {
    let node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
}

const WARN_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 21h20L12 3z"></path><path d="M12 10v5"></path><path d="M12 18h.01"></path></svg>'
const CHECK_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6"></path></svg>'

const SHOWN_ITEMS = 4

function itemNames(block) {
    return joinWords(block.items.map(({item}) => item.name.toLowerCase()))
}

function blockMarkup(block, found) {
    let div = el("div", "bp-block")
    let count = block.recipe ? Math.ceil(spec.getCount(block.recipe, spec.lastTotals.rates.get(block.recipe)).toFloat()) : 0
    let building = block.recipe ? spec.getBuilding(block.recipe) : null

    let head = el("div", "bp-head")
    head.innerHTML = WARN_SVG
    head.appendChild(el("span", "bp-title", block.recipe ? `${block.recipe.name} will back up and stop` : `Nothing here uses ${itemNames(block)}`))
    div.appendChild(head)

    let line = el("div", "bp-line")
    if (block.recipe) {
        line.appendChild(block.recipe.icon.make(24, true))
        let who = building ? `${count} ${plural(building.name, count)}` : block.recipe.name
        line.appendChild(el("span", "", `${who} also make${building && count === 1 ? "s" : ""}`))
    }
    // Scrap recycling leaves a dozen things over: the first few by rate,
    // then "and 7 more" with the rest in its tooltip.
    let all = block.items
    let shown = all.length > SHOWN_ITEMS + 1 ? all.slice(0, SHOWN_ITEMS) : all
    let rest = all.slice(shown.length)
    shown.forEach(({item, rate}, i) => {
        let lastShown = i === shown.length - 1
        if (i > 0 && lastShown && rest.length === 0) line.appendChild(el("span", "", "and"))
        line.appendChild(item.icon.make(20, true))
        let comma = !lastShown && !(i === shown.length - 2 && rest.length === 0) ? "," : ""
        line.appendChild(el("span", "bp-rate num", `${rateText(rate)} ${item.name.toLowerCase()}${comma}`))
    })
    if (rest.length > 0) {
        let more = el("span", "bp-more", `and ${rest.length} more`)
        more.title = rest.map(({item, rate}) => `${item.name}: ${rateText(rate)}`).join("\n")
        line.appendChild(more)
    }
    line.appendChild(el("span", "", block.recipe ? "that nothing in this plan uses." : "is left over."))
    div.appendChild(line)

    let list = el("div", "bp-fixes")
    if (found === null) {
        list.appendChild(el("span", "muted bp-checking", "Checking fixes…"))
    } else {
        let locked = unresearched()
        for (let fix of found.fixes) {
            list.appendChild(fixRow(block, fix, found, locked))
        }
        if (found.fixes.length === 0) {
            list.appendChild(el("span", "muted bp-none", "No recipe you could switch on uses it up, and no other recipe avoids it."))
        }
        list.appendChild(sendOutRow(block))
    }
    div.appendChild(list)
    return div
}

function fixRow(block, fix, found, locked) {
    let row = el("div", "bp-fix")
    let diff = machineDiff(found.base, fix.result)
    let button = el("button", "btn bp-btn" + (fix === found.best || found.fixes.length === 1 ? " btn-green" : ""))
    button.type = "button"
    let label, before, done
    if (fix.kind === "allow") {
        button.dataset.fix = "allow"
        label = allowLabel(fix.enable)
        before = `Turns on ${joinWords(fix.enable.map(shortName))}.`
        done = `${label.replace(/^Allow/, "Allowed")}.`
        button.appendChild(fix.enable[fix.enable.length - 1].icon.make(24, true))
    } else {
        button.dataset.fix = "avoid"
        label = `Use ${fix.recipe.name.toLowerCase()}`
        before = `${fix.item.name} without the ${itemNames(block)}.`
        done = `Switched ${fix.item.name.toLowerCase()} to ${fix.recipe.name.toLowerCase()}.`
        button.appendChild(fix.recipe.icon.make(24, true))
    }
    button.appendChild(document.createTextNode(label))
    let fullDone = `${done} ${diff.delta === 0 ? "No change in machines." : `${Math.abs(diff.delta)} ${diff.delta < 0 ? "fewer" : "more"} machines.`}`
    button.addEventListener("click", () => applyRecipes(fix, fullDone))
    row.appendChild(button)

    let words = el("span", "bp-what")
    words.appendChild(document.createTextNode(`${before} ${diff.parts.join(", ")}${diff.parts.length ? ". " : ""}`))
    words.appendChild(el("strong", "", diff.total + "."))
    if (fix.enable.some(r => locked.has(r.key))) {
        words.appendChild(document.createTextNode(" Not researched in your save yet."))
    }
    row.appendChild(words)
    if (fix === found.best) row.appendChild(el("span", "badge best", "Fewest machines"))
    return row
}

function sendOutRow(block) {
    let one = block.items.length === 1
    let row = el("div", "bp-fix")
    let button = el("button", "btn bp-btn")
    button.type = "button"
    button.dataset.fix = "out"
    button.textContent = one ? "Send it out" : "Send them out"
    let text = `${block.items.map(({item}) => item.name).join(" and ")} ${one ? "is" : "are"} sent out. Take ${one ? "it" : "them"} to storage or another build.`
    button.addEventListener("click", () => applySendOut(block, text))
    row.appendChild(button)
    row.appendChild(el("span", "bp-what", `Keep this plan and take ${one ? "it" : "them"} to storage or another build. No change in machines.`))
    return row
}

function statusMarkup() {
    let strip = el("div", "bp-done")
    strip.setAttribute("role", "status")
    let icon = el("span", "bp-ok")
    icon.innerHTML = CHECK_SVG
    strip.appendChild(icon)
    strip.appendChild(el("span", "bp-done-text", applied.text))
    let undo = el("button", "btn btn-sm bp-undo", "Undo")
    undo.type = "button"
    undo.addEventListener("click", () => applied && applied.undo())
    strip.appendChild(undo)
    return strip
}

function renderBar(_spec, totals) {
    let bar = document.getElementById("byproducts")
    if (!bar) return
    if (applied && applied.totals !== totals) applied = null
    let blocks = totals && spec.buildTargets.length > 0 ? stalls(totals, spec.sendOut) : []
    bar.replaceChildren()
    if (applied) bar.appendChild(statusMarkup())
    bar.hidden = blocks.length === 0 && !applied
    if (blocks.length === 0) return

    let section = el("section", "bp-bar")
    section.setAttribute("aria-label", "Byproducts")
    let cached = fixesFor === totals ? fixesCache : null
    blocks.forEach((block, i) => section.appendChild(blockMarkup(block, cached ? cached[i] : null)))
    bar.appendChild(section)
    if (cached) return

    let mine = ++generation
    setTimeout(() => {
        if (mine !== generation || spec.lastTotals !== totals) return
        fixesCache = computeFixes(totals, blocks)
        fixesFor = totals
        renderBar(spec, totals)
    }, 0)
}

// Scrolls the bar into view: the "backs up" markers on table rows and graph
// cards call this.
export function showByproducts() {
    document.getElementById("byproducts")?.scrollIntoView({block: "nearest", behavior: "smooth"})
}

export function initByproducts() {
    registerRenderer(renderBar)
}
