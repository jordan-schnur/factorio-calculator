// calc/modules-strip.js — the module icons every view shows for a row (the
// table's Modules column, a graph card, Settings' By machine and Set by
// hand lines), the beacon badge after them, and the SET BY HAND tag.
// Styles: calc/modules.css.
import { spec } from "./factory.js"
import { sprites } from "./icon.js"
import { addQualityBadge, withQualityBadge } from "./quality-ui.js"

// A badge half the icon's size, never under 8px.
function badgeSize(size) {
    return Math.max(8, Math.round(size / 2))
}

// One icon per slot, `size` px, in slot order; an empty slot shows the
// game's empty module-slot icon, dimmed. `tiers` parallels `modules`
// (calculator 1.3.0): a module above normal carries its tier's badge.
export function moduleStrip(modules, size, tiers = []) {
    let strip = document.createElement("span")
    strip.className = "modstrip"
    modules.forEach((module, i) => {
        let slot = document.createElement("span")
        slot.className = module ? "modslot" : "modslot empty"
        let icon = module ? module.icon.make(size, true) : sprites.get("slot_icon_module").icon.make(size, true)
        if (!module) {
            icon.title = "Empty slot"
        }
        slot.appendChild(icon)
        if (module) {
            addQualityBadge(slot, tiers[i], badgeSize(size))
        }
        strip.appendChild(slot)
    })
    return strip
}

// The beacon icon, "×N" and (unless `withModules` is false) the beacon
// modules' icons. Null when no beacon module is set or the count is 0.
// `tiers` parallels `beaconModules`; `beaconTier` badges the beacon itself.
export function beaconBadge(beaconModules, beaconCount, size, withModules = true, tiers = [], beaconTier = "normal") {
    let count = typeof beaconCount === "number" ? beaconCount : beaconCount.toFloat()
    let slots = beaconModules.map((module, i) => [module, tiers[i]]).filter(([module]) => module)
    if (!(count > 0) || slots.length === 0) {
        return null
    }
    let badge = document.createElement("span")
    badge.className = "beaconbadge"
    badge.title = `${count} beacon${count === 1 ? "" : "s"} around each machine`
    let beacon = spec.items.get("beacon")
    if (beacon) {
        badge.appendChild(withQualityBadge(beacon.icon.make(size, true), beaconTier, badgeSize(size)))
    }
    let n = document.createElement("span")
    n.className = "num"
    n.textContent = `×${count}`
    badge.appendChild(n)
    if (withModules) {
        for (let [module, tier] of slots) {
            badge.appendChild(withQualityBadge(module.icon.make(size, true), tier, badgeSize(size)))
        }
    }
    return badge
}

export function handTag() {
    let tag = document.createElement("span")
    tag.className = "tag hand"
    tag.textContent = "Set by hand"
    return tag
}
