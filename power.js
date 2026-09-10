// calc/power.js — the one powerRepr, shared by building.js (tooltips),
// table.js (Totals line, re-exported for inputs.js) and whereitgoes.js
// (what-if power delta). Ported from the retired calc/display.js: steps a
// watt Rational up through W/kW/MW/GW/TW/PW until the mantissa is under
// 1000 of the current unit.
import { Rational } from "./rational.js"

const THOUSAND = Rational.from_float(1000)
const SUFFIXES = [" W", "kW", "MW", "GW", "TW", "PW"]

export function powerRepr(x) {
    let i = 0
    while (THOUSAND.less(x) && i < SUFFIXES.length - 1) {
        x = x.div(THOUSAND)
        i++
    }
    return {power: x, suffix: SUFFIXES[i]}
}

// e.g. "5.8 MW" -- a ready-to-display, fixed one-decimal rendering for call
// sites that want a string rather than the raw {power, suffix} pair.
export function formatPower(x) {
    const {power, suffix} = powerRepr(x)
    return `${power.toDecimal(1)} ${suffix.trim()}`
}
