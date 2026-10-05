// calc/byproduct-core.js — every output of a recipe that makes more than one
// thing (advanced oil processing, coal liquefaction, ...) has to be used up:
// a refinery stops the moment any one of its outputs backs up, so planning
// it for its petroleum gas alone is only real if the heavy and light oil go
// somewhere too. The solver balances that with cracking when it can; what it
// can't place lands in totals.surplus. Pure: reads a Totals' producers and
// surplus Maps (item -> Rational) and recipe.products, nothing else.
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

// The footer's sentence for `list` (leftovers()), `rate` formatting one
// Rational: "Left over: heavy oil 25909/min, light oil 46636/min. Nothing
// here uses it, so it backs up and stops advanced oil processing."
export function leftoverSentence(list, rate) {
    if (list.length === 0) {
        return ""
    }
    const parts = list.map(({ item, rate: r }) => `${item.name.toLowerCase()} ${rate(r)}`)
    const makers = []
    for (const { makers: ms } of list) {
        for (const m of ms) {
            if (!makers.includes(m)) makers.push(m)
        }
    }
    const one = list.length === 1
    const names = makers.map(m => m.name.toLowerCase()).join(" and ")
    const stops = makers.length === 0 ? "" : one ? `, so it backs up and stops ${names}` : `, so they back up and stop ${names}`
    return `Left over: ${parts.join(", ")}. Nothing here uses ${one ? "it" : "them"}${stops}.`
}
