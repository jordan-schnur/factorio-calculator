// calc/colorblind.js — the Display setting "Colour-blind labels": remembered
// in this browser (localStorage, not the page link) and applied as a class
// on <html>, which calc.css uses to layer icon.js's tier labels over the
// belt-family and inserter icons -- every icon already on the page updates
// at once, nothing is redrawn.

import { tierOf } from "./colorblind-core.js"

const KEY = "calc.colorblind"

export function colorblindOn() {
    try {
        return localStorage.getItem(KEY) === "1"
    } catch (e) {
        return false
    }
}

export function setColorblind(on) {
    try {
        if (on) {
            localStorage.setItem(KEY, "1")
        } else {
            localStorage.removeItem(KEY)
        }
    } catch (e) {
        // private window / blocked storage: still applies for this visit
    }
    applyColorblind(on)
}

export function applyColorblind(on = colorblindOn()) {
    document.documentElement.classList.toggle("colorblind", on)
}

// The colour word as text, for places where an icon is drawn too small for
// its badge to read (a graph line's label and chip): hidden by calc.css
// unless html.colorblind, so the toggle still switches it live. null for
// an icon that isn't told apart by colour.
export function tierWord(obj) {
    let word = obj && tierOf(obj.key)
    if (!word) {
        return null
    }
    let span = document.createElement("span")
    span.className = "tier-word"
    span.textContent = word
    return span
}
