// calc/byproduct-core.js — every output of a recipe that makes more than one
// thing (advanced oil processing, coal liquefaction, ...) has to be used up:
// a refinery stops the moment any one of its outputs backs up. The solver
// balances that with cracking when it can; what it can't place lands in
// totals.surplus. This file groups those leftovers by the recipe they would
// stop and searches for fixes, each one proven by solving the plan with it
// applied. Pure: reads Totals-shaped Maps and recipe.products, and is handed
// a `trial` callback for the solves (byproducts.js runs the real ones).
import { plural } from "./ratio-core.js"
import { zero } from "./rational.js"

function sum(map) {
    let total = zero
    for (const rate of map.values()) {
        total = total.add(rate)
    }
    return total
}

export function isMultiOutput(recipe) {
    return recipe.products.length > 1
}

// One entry per product of `recipe`: what this recipe makes of it, and how
// much of that is left over -- its share of the item's surplus, split
// between producers in proportion to what each makes.
export function outputsOf(totals, recipe) {
    return recipe.products.map(({ item }) => {
        const producers = totals.producers.get(item) || new Map()
        const rate = producers.get(recipe) || zero
        const surplus = (totals.surplus && totals.surplus.get(item)) || zero
        const made = sum(producers)
        const leftover = surplus.isZero() || made.isZero() ? zero : surplus.mul(rate).div(made)
        return { item, rate, leftover }
    })
}

// The outputs of `recipe` the plan actually uses (made faster than they are
// left over): what "Bring in from another build" on a multi-output row has
// to supply. Bringing in only the first product (uranium-235, which nothing
// uses) would leave the recipe running and the switch flipping straight back.
export function usedOutputs(totals, recipe) {
    return outputsOf(totals, recipe).filter(o => o.rate.sub(o.leftover).toFloat() > 1e-9).map(o => o.item)
}

// What the solver could not use, largest first: [{item, rate, makers}] with
// `makers` the real recipes that produce it.
export function leftovers(totals) {
    const out = []
    for (const [item, rate] of totals.surplus || new Map()) {
        const makers = [...(totals.producers.get(item) || new Map()).keys()].filter(r => r.isReal())
        out.push({ item, rate, makers })
    }
    return out.sort((a, b) => b.rate.toFloat() - a.rate.toFloat())
}

// Leftovers not sent out (`sendOut`: item keys), one block per recipe they
// would stop -- the maker of most of each item: [{recipe, items: [{item,
// rate}]}]. `recipe` is null for an item no real recipe makes.
export function stalls(totals, sendOut = new Set()) {
    const groups = new Map()
    for (const { item, rate, makers } of leftovers(totals)) {
        if (sendOut.has(item.key)) continue
        const producers = totals.producers.get(item) || new Map()
        let maker = null
        for (const m of makers) {
            if (maker === null || maker && producers.get(maker).less(producers.get(m))) maker = m
        }
        const key = maker ? maker.key : ""
        if (!groups.has(key)) groups.set(key, { recipe: maker, items: [] })
        groups.get(key).items.push({ item, rate })
    }
    return [...groups.values()]
}

// The leftovers that are sent out: [{item, rate}].
export function sentOut(totals, sendOut) {
    return leftovers(totals).filter(l => sendOut.has(l.item.key)).map(({ item, rate }) => ({ item, rate }))
}

// A fix holds when none of the block's items is left over any more and it
// leaves nothing over, or brings nothing in, that the plan didn't already.
function holds(result, base, blockKeys) {
    for (const key of result.surplus.keys()) {
        if (blockKeys.has(key) || !base.surplus.has(key)) return false
    }
    for (const key of result.imports) {
        if (!base.imports.has(key)) return false
    }
    return true
}

// The fixes for one stall `block` ({recipe, items}), each proven with
// `trial({enable, disable})` -> {surplus: Map<key, item>, imports:
// Set<key>, machines, byBuilding: Map<name, count>}; `base` is the same for
// the plan as it stands. `consumersOf(item)` and `producersOf(item)` list
// recipes; `isOff(recipe)` says it is switched off by the user or the save,
// `isBlocked(recipe)` that the selected planet can't run it, `makesTarget`
// that the block's recipe makes a build target.
//
// Allow: switched-off consumers of what's stuck, round after round (allowing
// heavy oil cracking just moves the problem to light oil), then every one
// that turns out not to be needed is dropped again. Avoid: when the block's
// recipe has exactly one wanted output, each other recipe for it that makes
// none of the leftovers, used instead the way the recipe picker's "use only
// this" does it. Returns [{kind, enable, disable, result, item?, recipe?}].
export function findFixes(block, { base, trial, consumersOf, producersOf, isOff, isBlocked, makesTarget = false }) {
    const blockKeys = new Set(block.items.map(({ item }) => item.key))
    const fixes = []

    const enable = []
    let stuck = block.items.map(({ item }) => item)
    let result = null
    for (let round = 0; round < 4 && stuck.length > 0; round++) {
        const add = []
        for (const item of stuck) {
            for (const r of consumersOf(item)) {
                if (isOff(r) && !isBlocked(r) && !enable.includes(r) && !add.includes(r)) add.push(r)
            }
        }
        if (add.length === 0) break
        enable.push(...add)
        result = trial({ enable: [...enable], disable: [] })
        if (holds(result, base, blockKeys)) break
        stuck = [...result.surplus.values()].filter(item => !base.surplus.has(item.key) || blockKeys.has(item.key))
    }
    if (result && holds(result, base, blockKeys)) {
        for (const r of [...enable]) {
            if (enable.length === 1) break
            const without = enable.filter(x => x !== r)
            const smaller = trial({ enable: without, disable: [] })
            if (holds(smaller, base, blockKeys)) {
                enable.splice(enable.indexOf(r), 1)
                result = smaller
            }
        }
        fixes.push({ kind: "allow", enable: [...enable], disable: [], result })
    }

    const recipe = block.recipe
    if (recipe && !makesTarget) {
        const wanted = recipe.products.map(p => p.item).filter(item => !blockKeys.has(item.key))
        if (wanted.length === 1) {
            const item = wanted[0]
            const all = producersOf(item)
            for (const alt of all) {
                if (alt === recipe || isBlocked(alt)) continue
                if (alt.products.some(p => blockKeys.has(p.item.key))) continue
                const on = isOff(alt) ? [alt] : []
                const off = all.filter(r => r !== alt && !isOff(r))
                const res = trial({ enable: on, disable: off })
                if (holds(res, base, blockKeys)) {
                    fixes.push({ kind: "avoid", item, recipe: alt, enable: on, disable: off, result: res })
                }
            }
        }
    }
    return fixes
}

// The cheaper of two or more allow/avoid fixes, by machines; null otherwise.
export function cheapest(fixes) {
    if (fixes.length < 2) return null
    return fixes.reduce((a, b) => (b.result.machines < a.result.machines ? b : a))
}

// A recipe's name without its "to ..." tail, lower case: "Light oil
// cracking to petroleum gas" -> "light oil cracking".
export function shortName(recipe) {
    return recipe.name.replace(/ to .*$/, "").toLowerCase()
}

// "Allow cracking" when every recipe shares its last word, else each name.
export function allowLabel(recipes) {
    const names = recipes.map(shortName)
    const last = names.map(n => n.split(" ").pop())
    if (names.length > 1 && last.every(w => w === last[0])) return `Allow ${last[0]}`
    return "Allow " + joinWords(names)
}

export function joinWords(words) {
    if (words.length <= 1) return words.join("")
    return words.slice(0, -1).join(", ") + " and " + words[words.length - 1]
}

// What a fix does to the machines: the three biggest changes by building
// ("87 → 49 oil refineries", "+55 chemical plants"), then the total.
export function machineDiff(base, result) {
    const names = new Set([...base.byBuilding.keys(), ...result.byBuilding.keys()])
    const changes = []
    for (const name of names) {
        const before = base.byBuilding.get(name) || 0
        const after = result.byBuilding.get(name) || 0
        if (before !== after) changes.push({ name, before, after })
    }
    changes.sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    const parts = changes.slice(0, 3).map(({ name, before, after }) =>
        before === 0 ? `+${after} ${plural(name, after)}` : `${before} → ${after} ${plural(name, after === 1 ? 1 : 2)}`)
    const delta = result.machines - base.machines
    const total = delta === 0 ? `${result.machines} machines, no change` :
        `${result.machines} machines, ${Math.abs(delta)} ${delta < 0 ? "fewer" : "more"}`
    return { parts, total, delta }
}
