// calc/power.js — shared by building.js, table.js and whereitgoes.js.
import { Rational } from "./rational.js"

const THOUSAND = Rational.from_float(1000)
const SUFFIXES = [" W", "kW", "MW", "GW", "TW", "PW"]

export function powerRepr(x) {
    let i = 0
    while (THOUSAND.less(x) && i < SUFFIXES.length - 1) {
        x = x.div(THOUSAND)
        i++
    }
    return {power: x, suffix: SUFFIXES[i]}
}

export function formatPower(x, format) {
    const {power, suffix} = powerRepr(x)
    return `${format.count(power)} ${suffix.trim()}`
}
