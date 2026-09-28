// calc/colorblind.js — the Display setting "Colour-blind labels": remembered
// in this browser (localStorage, not the page link) and applied as a class
// on <html>, which calc.css uses to layer icon.js's tier labels over the
// belt-family and inserter icons -- every icon already on the page updates
// at once, nothing is redrawn.

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
    let box = document.getElementById("colorblind_toggle")
    if (box) {
        box.checked = on
    }
}
