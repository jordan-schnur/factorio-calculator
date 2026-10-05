// calc/quality-ui.js — quality on the page (calculator 1.3.0): the tier
// badge drawn bottom-left on a machine or module icon, and the five-button
// tier picker. DOM only; the numbers live in quality-core.js. Styles:
// calc/quality.css. Icons: calc/images/quality/<tier>.png, the game's own
// (scripts/extract_quality_icons.py).
import { TIERS, isNormal, tierOf } from "./quality-core.js"

export function qualityIconUrl(tierKey) {
    return `images/quality/${tierOf(tierKey).key}.png`
}

// The tier's icon, `size` px, for the bottom-left corner of an icon's
// wrapper (which needs class "qwrap"; addQualityBadge adds it). Null for
// normal: a normal machine or module carries no badge.
export function qualityBadge(tierKey, size = 12) {
    if (isNormal(tierKey)) {
        return null
    }
    let tier = tierOf(tierKey)
    let img = document.createElement("img")
    img.className = "qbadge"
    img.src = qualityIconUrl(tier.key)
    img.width = size
    img.height = size
    img.alt = tier.name
    img.title = tier.name
    img.dataset.tier = tier.key
    return img
}

// Badges `wrapper` (a slot, a button, any element already around one icon)
// in place. Returns `wrapper`.
export function addQualityBadge(wrapper, tierKey, size) {
    let badge = qualityBadge(tierKey, size)
    if (badge) {
        wrapper.classList.add("qwrap")
        wrapper.appendChild(badge)
    }
    return wrapper
}

// For a bare icon with no wrapper of its own: the icon itself at normal,
// else a span holding the icon and its badge.
export function withQualityBadge(icon, tierKey, size) {
    if (isNormal(tierKey)) {
        return icon
    }
    let wrap = document.createElement("span")
    wrap.className = "qwrap qwrap-inline"
    wrap.appendChild(icon)
    return addQualityBadge(wrap, tierKey, size)
}

// Five buttons, normal to legendary, each the tier's icon; the current one
// lit the way calc.css lights a .seg button. A click never reaches the
// row or card underneath (stopPropagation), then calls onPick(tierKey).
export function tierPicker(current, onPick, {label = "Quality", id = null} = {}) {
    let wrap = document.createElement("span")
    wrap.className = "seg tierpick"
    wrap.setAttribute("role", "group")
    wrap.setAttribute("aria-label", label)
    if (id) {
        wrap.id = id
    }
    let chosen = tierOf(current).key
    for (let tier of TIERS) {
        let button = document.createElement("button")
        button.type = "button"
        button.className = tier.key === chosen ? "on" : ""
        button.dataset.tier = tier.key
        button.title = tier.name
        button.setAttribute("aria-label", tier.name)
        button.setAttribute("aria-pressed", String(tier.key === chosen))
        let img = document.createElement("img")
        img.src = qualityIconUrl(tier.key)
        img.alt = ""
        img.width = 18
        img.height = 18
        button.appendChild(img)
        button.addEventListener("click", event => {
            event.stopPropagation()
            onPick(tier.key)
        })
        wrap.appendChild(button)
    }
    return wrap
}
