import QualityBadge from "../components/QualityBadge.svelte"
import QualityIcon from "../components/QualityIcon.svelte"
import TierPicker from "../components/TierPicker.svelte"
import { mountNode } from "./legacy-mount.js"
import { isNormal, tierOf } from "./quality-core.js"

// Legacy builders (itemtable.js, details.js, flow.js) draw quality badges and pickers through these until they migrate.
export function addQualityBadge(wrapper, tierKey, size) {
    let badge = mountNode(QualityBadge, { tier: tierKey, size })
    if (badge) {
        wrapper.classList.add("qwrap")
        wrapper.appendChild(badge)
    }
    return wrapper
}

export function qualityIcon(thing, size, tierKey, badge) {
    return mountNode(QualityIcon, { thing, size, tier: tierKey, badge })
}

export function tierPicker(current, onPick, { label = "Quality", id = null } = {}) {
    return mountNode(TierPicker, { tier: tierOf(current), label, id: id ?? undefined, onpick: tier => onPick(tier.key) })
}

// Legacy adapters kept for compatibility with existing flow.js calls until W2 migration.
export function qualityBadge(tierKey, size = 12) {
    return mountNode(QualityBadge, { tier: tierKey, size })
}

export function withQualityBadge(icon, tierKey, size) {
    if (isNormal(tierKey)) {
        return icon
    }
    let wrap = document.createElement("span")
    wrap.className = "qwrap qwrap-inline"
    wrap.appendChild(icon)
    return addQualityBadge(wrap, tierKey, size)
}
