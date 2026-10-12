import { num } from "./modules-core.js"

// A quality badge half the icon's size, never under 8px.
export function badgeSize(size) {
    return Math.max(8, Math.round(size / 2))
}

// The filled beacon slots as {module, tier}, in slot order.
export function beaconSlots(beaconModules, tiers) {
    return beaconModules.map((module, i) => ({ module, tier: tiers[i] })).filter(slot => slot.module)
}

// A beacon count as a plain number, from a number or a Rational.
export function beaconNumber(count) {
    return num(count)
}
