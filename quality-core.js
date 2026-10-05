// calc/quality-core.js — Factorio 2.0 quality as an input to the plan:
// the five tiers, what a tier does to a crafting machine's speed, to a
// module's effect and to a beacon, and the `mq=` / `@tier` link syntax.
// No DOM; reaches only rational.js, so node can run it once `bigInt` is a
// global (tests/js/bigint_global.mjs). Numbers: the game's, see
// docs/feedback/2026-10-02-reddit-launch.md section 3.
import { Rational } from "./rational.js"

// Ascending by level. Legendary is level 5: the game skips 4.
export const TIERS = [
    {key: "normal",    level: 0, name: "Normal"},
    {key: "uncommon",  level: 1, name: "Uncommon"},
    {key: "rare",      level: 2, name: "Rare"},
    {key: "epic",      level: 3, name: "Epic"},
    {key: "legendary", level: 5, name: "Legendary"},
]

const BY_KEY = new Map(TIERS.map(tier => [tier.key, tier]))

// The direction in which each module effect helps; only a helping effect
// is scaled by quality (the wiki's Quality page).
const HELPS = {speed: 1, productivity: 1, quality: 1, consumption: -1, pollution: -1}

// The TIERS entry for `key`; anything unknown, empty or null is normal.
export function tierOf(key) {
    return BY_KEY.get(key) || TIERS[0]
}

export function isNormal(key) {
    return tierOf(key).level === 0
}

// A crafting machine's speed multiplier: 1 + 0.3 per level.
export function speedMultiplier(key) {
    return Rational.from_floats(10 + 3 * tierOf(key).level, 10)
}

// A beacon's distribution effectivity at its own quality: the data's base
// (1.5 in 2.0) plus 0.2 per level. `base` is a Rational or a number.
export function beaconEffectivity(key, base) {
    let b = typeof base === "number" ? Rational.from_float_approximate(base) : base
    let level = tierOf(key).level
    return level === 0 ? b : b.add(Rational.from_floats(level, 5))
}

// A beacon's own power draw multiplier: 1, 5/6, 2/3, 1/2, 1/6.
export function beaconPowerMultiplier(key) {
    return Rational.from_floats(6 - tierOf(key).level, 6)
}

// The integer core of scaledEffect: {units, scale}, value = units / scale.
// Whole percent (per-mille for "quality"); a helping effect is multiplied
// by (10 + 3 * level) / 10 and rounded down, a penalty is left alone.
function scaledUnits(value, effectName, key) {
    let v = typeof value === "number" ? value : value.toFloat()
    let scale = effectName === "quality" ? 1000 : 100
    let units = Math.round(Math.abs(v) * scale)
    if ((HELPS[effectName] || 0) * v > 0) {
        units = Math.floor(units * (10 + 3 * tierOf(key).level) / 10)
    }
    return {units: v < 0 ? -units : units, scale}
}

// One module effect at a slot's quality, as a Rational: productivity 3's
// +10% is 10/13/16/19/25% at normal..legendary, its -15% speed stays -15%.
export function scaledEffect(value, effectName, key) {
    let {units, scale} = scaledUnits(value, effectName, key)
    return Rational.from_floats(units, scale)
}

// The same as a float, for modules-core.js's effectsOf. Normal returns
// `value` untouched so the 1.2.0 float sums don't move.
export function scaledEffectNumber(value, effectName, key) {
    if (isNormal(key)) {
        return typeof value === "number" ? value : value.toFloat()
    }
    let {units, scale} = scaledUnits(value, effectName, key)
    return units / scale
}

// beaconEffectivity as a float, for effectsOf.
export function beaconEffectivityNumber(key, base) {
    return base + tierOf(key).level / 5
}

// A link's module token, "p3" or "p3@legendary": the module part and the
// tier key (normal when there is no "@" or the tier is unknown).
export function splitModuleToken(text) {
    let at = text.indexOf("@")
    if (at === -1) {
        return {key: text, tier: "normal"}
    }
    return {key: text.slice(0, at), tier: tierOf(text.slice(at + 1)).key}
}

// The token for a module's short name at `tier`; normal is never written.
export function joinModuleToken(shortName, tier) {
    return isNormal(tier) ? shortName : `${shortName}@${tierOf(tier).key}`
}

// `mq=<machine>:<tier>,...` -> Map(machine key -> tier key). Normal and
// unknown tiers are dropped; whether the machine exists is the caller's
// check (factory.js's setMachineQuality).
export function parseMachineQuality(text) {
    let out = new Map()
    for (let pair of (text || "").split(",")) {
        let i = pair.lastIndexOf(":")
        if (i <= 0) {
            continue
        }
        let tier = pair.slice(i + 1)
        if (BY_KEY.has(tier) && !isNormal(tier)) {
            out.set(pair.slice(0, i), tier)
        }
    }
    return out
}

// Map(machine key -> tier key) -> the `mq=` value: non-normal entries only,
// sorted by machine key; "" when there are none.
export function formatMachineQuality(map) {
    return [...map]
        .filter(([, tier]) => !isNormal(tier))
        .map(([key, tier]) => [key, tierOf(tier).key])
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([key, tier]) => `${key}:${tier}`)
        .join(",")
}

// {tierKey: count} -> the tier most copies have. A tie goes to the lower
// tier (never plan faster machines than most of what's built); unknown
// tier names are ignored; nothing counted is normal.
export function majorityTier(counts) {
    let best = "normal"
    let bestCount = 0
    for (let tier of TIERS) {
        let n = (counts && counts[tier.key]) || 0
        if (n > bestCount) {
            best = tier.key
            bestCount = n
        }
    }
    return best
}

// The save's default machine quality for the selected planets, from
// /api/calc/spec's `machine_quality` ({built: {surface: {machine: {tier:
// count}}}}): each machine's majority tier over those planets' surfaces,
// non-normal entries only.
export function qualityFromSave(machineQuality, planets) {
    let built = (machineQuality && machineQuality.built) || {}
    let totals = new Map()
    for (let planet of planets) {
        for (let [machine, counts] of Object.entries(built[planet] || {})) {
            let sum = totals.get(machine) || {}
            for (let [tier, n] of Object.entries(counts)) {
                sum[tier] = (sum[tier] || 0) + n
            }
            totals.set(machine, sum)
        }
    }
    let out = new Map()
    for (let [machine, counts] of totals) {
        let tier = majorityTier(counts)
        if (!isNormal(tier)) {
            out.set(machine, tier)
        }
    }
    return out
}
