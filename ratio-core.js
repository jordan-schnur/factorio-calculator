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
