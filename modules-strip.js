// calc/modules-strip.js — the module icons every view shows for a row (the
// table's Modules column, a graph card, Settings' By machine and Set by
// hand lines), the beacon badge after them, and the SET BY HAND tag.
// Styles: calc/modules.css.
import { spec } from "./factory.js"
import { sprites } from "./icon.js"

// One icon per slot, `size` px, in slot order; an empty slot shows the
// game's empty module-slot icon, dimmed.
export function moduleStrip(modules, size) {
    let strip = document.createElement("span")
    strip.className = "modstrip"
    for (let module of modules) {
        let slot = document.createElement("span")
        slot.className = module ? "modslot" : "modslot empty"
        let icon = module ? module.icon.make(size, true) : sprites.get("slot_icon_module").icon.make(size, true)
        if (!module) {
            icon.title = "Empty slot"
        }
        slot.appendChild(icon)
        strip.appendChild(slot)
    }
    return strip
}

// The beacon icon, "×N" and (unless `withModules` is false) the beacon
// modules' icons. Null when no beacon module is set or the count is 0.
export function beaconBadge(beaconModules, beaconCount, size, withModules = true) {
    let count = typeof beaconCount === "number" ? beaconCount : beaconCount.toFloat()
    let modules = beaconModules.filter(m => m)
    if (!(count > 0) || modules.length === 0) {
        return null
    }
    let badge = document.createElement("span")
    badge.className = "beaconbadge"
    badge.title = `${count} beacon${count === 1 ? "" : "s"} around each machine`
    let beacon = spec.items.get("beacon")
    if (beacon) {
        badge.appendChild(beacon.icon.make(size, true))
    }
    let n = document.createElement("span")
    n.className = "num"
    n.textContent = `×${count}`
    badge.appendChild(n)
    if (withModules) {
        for (let module of modules) {
            badge.appendChild(module.icon.make(size, true))
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
