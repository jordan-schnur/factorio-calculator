// calc/colorblind.js — the "Colour-blind" Display setting: a class on <html> that calc.css uses to label tiered icons.

import { tierOf } from "./colorblind-core.js"
import { storedFlag } from "./stored-flag.js"

const flag = storedFlag("calc.colorblind", "colorblind_toggle", on => document.documentElement.classList.toggle("colorblind", on))

export const colorblindOn = flag.on
export const setColorblind = flag.set
export const applyColorblind = flag.apply

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
