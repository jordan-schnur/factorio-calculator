// calc/ratio-core.js — the machine-ratio wording under each Needs/Goes to
// line in details.js ("1 offshore pump feeds 9.6 foundries · block 5 : 48").
// Pure: plain numbers in, strings out; details.js does the Rational maths.

// Largest side of a whole-number block worth printing; above it the block
// is no longer something you would lay down, so only the per-machine
// figure is shown.
const MAX_BLOCK = 50

// Lower-cased building name, pluralised on the noun when count !== 1. A
// trailing tier number stays after the noun: "assembling machines 3".
export function plural(name, count) {
    let lower = name.toLowerCase()
    if (count === 1) {
        return lower
    }
    let m = lower.match(/^(.*?)( \d+)?$/)
    let noun = m[1]
    let tier = m[2] || ""
    if (/[^aeiou]y$/.test(noun)) {
        noun = noun.slice(0, -1) + "ies"
    } else if (/(s|x|ch|sh)$/.test(noun)) {
        noun += "es"
    } else {
        noun += "s"
    }
    return noun + tier
}

// Two decimals at most from 1 up, two significant digits below 1, trailing
// zeros trimmed.
export function ratioNumber(value) {
    let text = value >= 1 ? value.toFixed(2) : value.toPrecision(2)
    return text.includes(".") ? text.replace(/\.?0+$/, "") : text
}

// `p/q` consumers per supplier, already reduced -> "q : p" (suppliers :
// consumers), or null when either side exceeds MAX_BLOCK.
export function block(p, q) {
    if (p > MAX_BLOCK || q > MAX_BLOCK) {
        return null
    }
    return `${q} : ${p}`
}

// The line under a Goes to row: how many consumers one supplier keeps busy.
// `p/q` is consumers per supplier machine, reduced.
export function goesToRatio(supplier, consumer, p, q) {
    let perSupplier = p / q
    let text = `1 ${plural(supplier, 1)} feeds ${ratioNumber(perSupplier)} ${plural(consumer, perSupplier)}`
    return withBlock(text, q === 1, p, q)
}

// The line under a Needs row: how many suppliers one consumer needs.
export function needsRatio(supplier, consumer, p, q) {
    let perConsumer = q / p
    let text = `${ratioNumber(perConsumer)} ${plural(supplier, perConsumer)} per ${plural(consumer, 1)}`
    return withBlock(text, p === 1, p, q)
}

// The block is redundant when the per-machine figure is already whole.
function withBlock(text, whole, p, q) {
    let b = whole ? null : block(p, q)
    return b === null ? text : `${text} · block ${b}`
}

// The hover card on a Needs/Goes to rate: how many belts the flow fills and
// how many machines on each side it accounts for. `suppliers` (one per
// recipe making the item) and `consumer` are {building, recipe, count,
// total} -- `count` of the recipe's `total` machines that this one flow
// keeps busy; `consumer` is null when that side has no machine.
export function flowLines({ belts, beltName, fluid, suppliers, consumer, beltFormat }) {
    let lines = [fluid ? "Fluid, by pipe" : namedBelts(belts, beltName, beltFormat)]
    for (let supplier of suppliers) {
        lines.push(`Made by ${machinesOf(supplier)}`)
    }
    if (consumer) {
        lines.push(`Used by ${machinesOf(consumer)}`)
    }
    return lines
}

// "1/3 transport belt", "1 1/3 transport belts": beltAmount with the belt's
// own name as the noun.
function namedBelts(belts, beltName, format) {
    let { text, many } = beltAmount(belts, format)
    return `${text} ${plural(beltName, many ? 2 : 1)}`
}

function machinesOf({ building, recipe, count, total }) {
    let whole = ratioNumber(count) === ratioNumber(total)
    let share = whole ? `${ratioNumber(total)}` : `${ratioNumber(count)} of the ${ratioNumber(total)}`
    return `${share} ${plural(building, total)} on ${recipe}`
}

// One place a table row's item goes, for the Need-column hover card: a
// title and the machines line -- how many of the machines making the item
// (`suppliers`, {building, count}, one per recipe) feed how many of the
// `consumer`'s ({building, count}, or null for what you asked for itself).
// `belts` is null for a fluid.
export function destinationLines({ name, rate, percent, belts, beltName, suppliers, consumer, beltFormat }) {
    let title = `${name} · ${rate} · ${percent}`
    let parts = []
    if (belts !== null) {
        parts.push(namedBelts(belts, beltName, beltFormat))
    }
    if (suppliers.length > 0) {
        let from = suppliers.map(s => `${ratioNumber(s.count)} ${plural(s.building, s.count)}`).join(" + ")
        let single = suppliers.length === 1 && ratioNumber(suppliers[0].count) === "1"
        if (consumer) {
            parts.push(`${from} ${single ? "feeds" : "feed"} ${ratioNumber(consumer.count)} ${plural(consumer.building, consumer.count)}`)
        } else {
            parts.push(from)
        }
    } else if (consumer) {
        parts.push(`into ${ratioNumber(consumer.count)} ${plural(consumer.building, consumer.count)}`)
    }
    return { title, detail: parts.join(" · ") }
}

// Belt counts the way the Display setting asks: "fraction" (the default)
// reads "1/3 belt", "2/3 belt", "1 1/3 belts", "1/15 belt"; "decimal" reads
// "0.33 belts". A fraction is a unit fraction 1/x when one is within 4%,
// else the simplest n/d within 0.01 of it (a denominator people count in:
// no sevenths or elevenths), else decimals.
const FRIENDLY_DENOMINATORS = [2, 3, 4, 5, 6, 8, 9, 10, 12]

function beltFraction(rest) {
    let x = Math.round(1 / rest)
    if (x >= 2 && Math.abs(1 / x - rest) <= rest * 0.04) {
        return `1/${x}`
    }
    for (let d of FRIENDLY_DENOMINATORS) {
        let n = Math.round(rest * d)
        if (n >= 1 && n < d && Math.abs(n / d - rest) <= 0.01) {
            return `${n}/${d}`
        }
    }
    return null
}

// {text, many}: the number as the setting writes it, and whether it is
// more than one belt (so the noun is plural).
export function beltAmount(belts, format) {
    if (format !== "decimal" && belts > 0) {
        let whole = Math.floor(belts)
        let rest = belts - whole
        let text = null
        if (rest < 0.01) {
            text = whole > 0 ? `${whole}` : beltFraction(belts)
        } else if (rest > 0.99) {
            text = `${whole + 1}`
        } else {
            let f = beltFraction(rest)
            if (f) text = whole > 0 ? `${whole} ${f}` : f
        }
        if (text !== null) {
            return { text, many: belts > 1.01 }
        }
    }
    let text = ratioNumber(belts)
    return { text, many: text !== "1" }
}

export function beltWords(belts, format) {
    let { text, many } = beltAmount(belts, format)
    return `${text} ${many ? "belts" : "belt"}`
}

// The two cards at the ends of a hovered graph line: how many of the
// sending recipe's machines this line takes, and how many of the receiving
// recipe's machines it feeds. `count` of `total` machines, plain numbers.
export function lineEnd(count, total, verb) {
    let n = ratioNumber(count)
    let t = ratioNumber(total)
    let [one, many] = verb === "send" ? ["sends this", "send this"] : ["uses it", "use it"]
    if (n === t) {
        return t === "1" ? `the only one ${one}` : `all ${t} ${many}`
    }
    return `${n} of ${t} ${many}`
}

// A focused line's machine row: how many of the sending recipe's machines
// (`from`) feed how many of the receiving recipe's (`to`), each {count,
// total} with `total` the whole machines its card shows, and the ratio
// between them with the focused card's side (`root`, "from" or "to") as 1:
// copper cable focused, "13.33 of 134" foundries -> "480" assembling
// machines, "1 : 36".
export function lineRatio(from, to, root) {
    let side = ({ count, total }) => {
        let n = ratioNumber(count)
        let t = ratioNumber(total)
        return n === t ? t : `${n} of ${t}`
    }
    let ratio = root === "from"
        ? `1 : ${ratioNumber(to.count / from.count)}`
        : `${ratioNumber(from.count / to.count)} : 1`
    return { from: side(from), to: side(to), ratio }
}

// How many machines at each end of a line one full belt covers: `from` and
// `to` are the line's machine counts (null for an end with no machine),
// `belts` the belts the line fills. 13.33 foundries -> 480 assemblers on
// 2 2/3 belts is {from: "5", to: "180"}; null when the line fills no belt.
export function perBelt(from, to, belts) {
    if (!(belts > 0)) {
        return null
    }
    let each = count => count === null ? null : ratioNumber(count / belts)
    return { from: each(from), to: each(to) }
}
