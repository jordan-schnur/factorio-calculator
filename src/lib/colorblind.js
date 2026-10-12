// The "Colour-blind" Display setting: a class on <html> that calc.css uses to label tiered icons.

import { readStore, writeStore } from "./storage.js"

const KEY = "calc.colorblind"

export function colorblindOn() {
    return readStore(KEY) === "1"
}

export function setColorblind(on) {
    writeStore(KEY, on ? "1" : null)
    applyColorblind(on)
}

export function applyColorblind(on = colorblindOn()) {
    document.documentElement.classList.toggle("colorblind", on)
}
